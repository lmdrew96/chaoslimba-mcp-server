import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

export function registerErrorTools(server: McpServer): void {
  // ─── cl_get_error_patterns ───
  server.registerTool(
    'cl_get_error_patterns',
    {
      title: 'Get Error Patterns',
      description:
        'Returns aggregated error patterns from error_logs across all users (anonymized). Useful for understanding where learners actually struggle.',
      inputSchema: z.object({
        errorType: z
          .enum(['grammar', 'pronunciation', 'vocabulary', 'word_order'])
          .optional()
          .describe('Filter by error type'),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(30)
          .describe('Max results (default 30)'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ errorType, limit }) => {
      let sql = `
        SELECT error_type, category, COUNT(*) as frequency, modality
        FROM error_logs
      `;
      const params: unknown[] = [];
      let paramIndex = 1;

      if (errorType) {
        sql += ` WHERE error_type = $${paramIndex}`;
        params.push(errorType);
        paramIndex++;
      }

      sql += ` GROUP BY error_type, category, modality ORDER BY frequency DESC LIMIT $${paramIndex}`;
      params.push(limit);

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

  // ─── cl_get_adaptation_summary ───
  server.registerTool(
    'cl_get_adaptation_summary',
    {
      title: 'Get Adaptation Summary',
      description:
        'Returns a summary of fossilization interventions — which patterns are being escalated and whether they are resolving. Shows max tier reached, total interventions, and resolution counts.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const result = await query(
        `SELECT
          pattern_key,
          error_type,
          category,
          MAX(tier) as max_tier_reached,
          COUNT(*) as total_interventions,
          SUM(CASE WHEN is_resolved THEN 1 ELSE 0 END) as resolved_count
        FROM adaptation_interventions
        GROUP BY pattern_key, error_type, category
        ORDER BY max_tier_reached DESC, total_interventions DESC
        LIMIT 25`
      );

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
}