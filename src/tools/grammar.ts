import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

export function registerGrammarTools(server: McpServer): void {
  // ─── cl_get_grammar_map ───
  server.registerTool(
    'cl_get_grammar_map',
    {
      title: 'Get Grammar Feature Map',
      description:
        'Returns all entries from grammar_feature_map, optionally filtered by CEFR level. Shows feature keys, names, categories, descriptions, prerequisites, and sort order.',
      inputSchema: z.object({
        cefrLevel: z
          .enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
          .optional()
          .describe('Filter by CEFR level'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ cefrLevel }) => {
      let sql = `
        SELECT feature_key, feature_name, cefr_level, category, description, prerequisites, sort_order
        FROM grammar_feature_map
      `;
      const params: unknown[] = [];

      if (cefrLevel) {
        sql += ` WHERE cefr_level = $1`;
        params.push(cefrLevel);
      }

      sql += ` ORDER BY cefr_level, sort_order`;

      const result = await query(sql, params);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    }
  );

  // ─── cl_get_prerequisite_chain ───
  server.registerTool(
    'cl_get_prerequisite_chain',
    {
      title: 'Get Prerequisite Chain',
      description:
        'For a given grammar feature, returns its full recursive prerequisite chain so you can audit whether the sequencing is pedagogically sound. Caps depth at 10.',
      inputSchema: z.object({
        featureKey: z.string().describe('The feature_key to trace prerequisites for'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ featureKey }) => {
      // Fetch the entire grammar map into memory (it's a small reference table)
      const result = await query<{
        feature_key: string;
        feature_name: string;
        cefr_level: string;
        prerequisites: string[] | null;
      }>(
        `SELECT feature_key, feature_name, cefr_level, prerequisites FROM grammar_feature_map`
      );

      const featureMap = new Map(
        result.rows.map((r) => [r.feature_key, r])
      );

      interface PrereqNode {
        feature_key: string;
        feature_name: string;
        cefr_level: string;
        prerequisites: PrereqNode[];
      }

      function buildTree(key: string, depth: number, visited: Set<string>): PrereqNode | null {
        if (depth > 10 || visited.has(key)) return null;
        visited.add(key);

        const feature = featureMap.get(key);
        if (!feature) {
          return {
            feature_key: key,
            feature_name: '(not found in grammar_feature_map)',
            cefr_level: 'unknown',
            prerequisites: [],
          };
        }

        const prereqs = feature.prerequisites ?? [];
        const children: PrereqNode[] = [];

        for (const prereqKey of prereqs) {
          const child = buildTree(prereqKey, depth + 1, visited);
          if (child) children.push(child);
        }

        return {
          feature_key: feature.feature_key,
          feature_name: feature.feature_name,
          cefr_level: feature.cefr_level,
          prerequisites: children,
        };
      }

      const tree = buildTree(featureKey, 0, new Set());

      if (!tree) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Feature "${featureKey}" not found in grammar_feature_map.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(tree, null, 2),
          },
        ],
      };
    }
  );
}