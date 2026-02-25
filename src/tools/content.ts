import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

export function registerContentTools(server: McpServer): void {
  // ─── cl_get_content ───
  server.registerTool(
    'cl_get_content',
    {
      title: 'Get Content Items',
      description:
        'Returns content items, optionally filtered by difficulty level, topic, or type. When no difficulty filter is set, results are stratified across difficulty levels for even coverage.',
      inputSchema: z.object({
        difficultyLevel: z
          .number()
          .min(1.0)
          .max(9.5)
          .optional()
          .describe('Filter by exact difficulty level (1.0–9.5)'),
        topic: z.string().optional().describe('Filter by topic (partial match, case-insensitive)'),
        type: z.enum(['audio', 'text']).optional().describe('Filter by content type'),
        limit: z.number().min(1).default(50).describe('Max results to return (default 50)'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ difficultyLevel, topic, type, limit }) => {
      const params: unknown[] = [];
      let paramIndex = 1;

      // Build WHERE clauses
      const conditions: string[] = [];

      if (difficultyLevel !== undefined) {
        conditions.push(`difficulty_level = $${paramIndex}`);
        params.push(difficultyLevel);
        paramIndex++;
      }

      if (topic) {
        conditions.push(`topic ILIKE $${paramIndex}`);
        params.push(`%${topic}%`);
        paramIndex++;
      }

      if (type) {
        conditions.push(`type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      let sql: string;

      if (difficultyLevel !== undefined) {
        // Exact difficulty filter: simple query, no stratification needed
        sql = `
          SELECT id, type, title, difficulty_level, topic, language_features, duration_seconds, created_at
          FROM content_items
          ${whereClause}
          ORDER BY created_at
          LIMIT $${paramIndex}
        `;
        params.push(limit);
      } else {
        // No difficulty filter: stratify across CEFR levels for even coverage.
        // Mapping: A1 ≤2.0, A2 2.1–3.5, B1 3.6–5.0, B2 5.1–7.0, C1 7.1–9.0, C2 9.1+
        sql = `
          SELECT id, type, title, difficulty_level, topic, language_features, duration_seconds, created_at
          FROM (
            SELECT *,
              ROW_NUMBER() OVER (
                PARTITION BY CASE
                  WHEN difficulty_level <= 2.0 THEN 'A1'
                  WHEN difficulty_level <= 3.5 THEN 'A2'
                  WHEN difficulty_level <= 5.0 THEN 'B1'
                  WHEN difficulty_level <= 7.0 THEN 'B2'
                  WHEN difficulty_level <= 9.0 THEN 'C1'
                  ELSE 'C2'
                END
                ORDER BY created_at
              ) AS rn
            FROM content_items
            ${whereClause}
          ) ranked
          WHERE rn <= $${paramIndex}
          ORDER BY difficulty_level, created_at
        `;
        // Divide limit evenly across 6 CEFR levels, rounding up
        params.push(Math.ceil(limit / 6));
      }

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

  // ─── cl_coverage_report ───
  server.registerTool(
    'cl_coverage_report',
    {
      title: 'Grammar Coverage Report',
      description:
        'Cross-references grammar_feature_map against content_items.language_features to show which grammar features have content coverage and which are gaps. The core instructional design audit tool.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      // 1. Fetch all grammar features
      const featuresResult = await query<{
        feature_key: string;
        feature_name: string;
        cefr_level: string;
        category: string;
      }>(
        `SELECT feature_key, feature_name, cefr_level, category FROM grammar_feature_map ORDER BY cefr_level, sort_order`
      );

      // 2. Fetch all language_features JSONB from content_items
      const contentResult = await query<{ language_features: { grammar?: string[] } | null }>(
        `SELECT language_features FROM content_items WHERE language_features IS NOT NULL`
      );

      // 3. Count how many content items reference each grammar feature
      const featureCounts = new Map<string, number>();

      for (const row of contentResult.rows) {
        const grammarFeatures = row.language_features?.grammar ?? [];
        for (const feat of grammarFeatures) {
          featureCounts.set(feat, (featureCounts.get(feat) || 0) + 1);
        }
      }

      // 4. Build the report
      const report = featuresResult.rows.map((f) => {
        const count = featureCounts.get(f.feature_key) || 0;
        return {
          feature_key: f.feature_key,
          feature_name: f.feature_name,
          cefr_level: f.cefr_level,
          category: f.category,
          content_count: count,
          is_gap: count === 0,
        };
      });

      // Sort: by cefr_level, then content_count ascending (gaps first within level)
      const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      report.sort((a, b) => {
        const levelDiff = cefrOrder.indexOf(a.cefr_level) - cefrOrder.indexOf(b.cefr_level);
        if (levelDiff !== 0) return levelDiff;
        return a.content_count - b.content_count;
      });

      const totalFeatures = report.length;
      const gaps = report.filter((r) => r.is_gap).length;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                summary: {
                  total_features: totalFeatures,
                  covered: totalFeatures - gaps,
                  gaps,
                  coverage_percent: totalFeatures > 0 ? Math.round(((totalFeatures - gaps) / totalFeatures) * 100) : 0,
                },
                features: report,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}