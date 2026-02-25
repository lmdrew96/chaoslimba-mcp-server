import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

export function registerLearnerDataTools(server: McpServer): void {
  // ─── cl_get_session_summary ───
  server.registerTool(
    'cl_get_session_summary',
    {
      title: 'Get Session Summary',
      description:
        'Returns aggregated session data — session counts by type, average duration, and content engagement. All data is anonymized (no user IDs returned). Useful for understanding how learners actually use the app.',
      inputSchema: z.object({
        sessionType: z
          .string()
          .optional()
          .describe('Filter by session type for per-content breakdown'),
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
    async ({ sessionType, limit }) => {
      const summaryResult = await query(
        `SELECT
          session_type,
          COUNT(*) as session_count,
          ROUND(AVG(duration_seconds)) as avg_duration_sec,
          ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))) as avg_wall_time_sec,
          MIN(started_at) as earliest,
          MAX(started_at) as latest
        FROM sessions
        GROUP BY session_type
        ORDER BY session_count DESC`
      );

      const sections: Array<{ type: 'text'; text: string }> = [
        {
          type: 'text' as const,
          text: JSON.stringify(summaryResult.rows, null, 2),
        },
      ];

      if (sessionType) {
        const detailResult = await query(
          `SELECT
            session_type,
            content_id,
            COUNT(*) as session_count,
            ROUND(AVG(duration_seconds)) as avg_duration_sec
          FROM sessions
          WHERE session_type = $1
          GROUP BY session_type, content_id
          ORDER BY session_count DESC
          LIMIT $2`,
          [sessionType, limit]
        );

        sections.push({
          type: 'text' as const,
          text: `\n--- Per-content breakdown for "${sessionType}" ---\n` +
            JSON.stringify(detailResult.rows, null, 2),
        });
      }

      return { content: sections };
    }
  );

  // ─── cl_get_proficiency_trends ───
  server.registerTool(
    'cl_get_proficiency_trends',
    {
      title: 'Get Proficiency Trends',
      description:
        'Returns proficiency score history over time — overall, listening, reading, speaking, writing scores by period. Anonymized across all users. Useful for tracking whether content improvements translate to learner gains.',
      inputSchema: z.object({
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe('Max results (default 20)'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ limit }) => {
      const result = await query(
        `SELECT
          id, overall_score, listening_score, reading_score,
          speaking_score, writing_score, recorded_at
        FROM proficiency_history
        ORDER BY recorded_at DESC
        LIMIT $1`,
        [limit]
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

  // ─── cl_get_feature_exposure ───
  server.registerTool(
    'cl_get_feature_exposure',
    {
      title: 'Get Feature Exposure',
      description:
        'Returns aggregated feature exposure data — how many times each grammar feature has been seen by learners, with correctness rates. Anonymized. Useful for finding undertaught or poorly-performing features.',
      inputSchema: z.object({
        featureKey: z
          .string()
          .optional()
          .describe('Filter by specific feature key'),
        limit: z
          .number()
          .min(1)
          .max(200)
          .default(50)
          .describe('Max results (default 50)'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ featureKey, limit }) => {
      let sql = `
        SELECT
          feature_key,
          exposure_type,
          COUNT(*) as total_exposures,
          SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
          ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as accuracy_pct
        FROM user_feature_exposure
      `;
      const params: unknown[] = [];
      let paramIndex = 1;

      if (featureKey) {
        sql += ` WHERE feature_key = $${paramIndex}`;
        params.push(featureKey);
        paramIndex++;
      }

      sql += ` GROUP BY feature_key, exposure_type ORDER BY total_exposures DESC LIMIT $${paramIndex}`;
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

  // ─── cl_get_mystery_items ───
  server.registerTool(
    'cl_get_mystery_items',
    {
      title: 'Get Mystery Items',
      description:
        'Returns mystery vocabulary items — words learners encountered and flagged for exploration. Shows word, context, definition, examples, grammar info, and whether the learner has explored it. Useful for understanding organic vocabulary discovery.',
      inputSchema: z.object({
        explored: z
          .boolean()
          .optional()
          .describe('Filter by exploration status'),
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
    async ({ explored, limit }) => {
      let sql = `
        SELECT
          id, word, context_sentence, definition, examples,
          grammar_info, is_explored, created_at
        FROM mystery_items
      `;
      const params: unknown[] = [];
      let paramIndex = 1;

      if (explored !== undefined) {
        sql += ` WHERE is_explored = $${paramIndex}`;
        params.push(explored);
        paramIndex++;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
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

  // ─── cl_get_generated_content_summary ───
  server.registerTool(
    'cl_get_generated_content_summary',
    {
      title: 'Get Generated Content Summary',
      description:
        'Returns aggregated stats on AI-generated content — what types are being generated, for which error targets, listening rates, and estimated TTS costs. Anonymized. Useful for auditing the AI tutor\'s output quality and cost.',
      inputSchema: z.object({
        contentType: z
          .string()
          .optional()
          .describe('Filter by content type'),
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
    async ({ contentType, limit }) => {
      let sql = `
        SELECT
          content_type,
          target_error_type,
          target_category,
          COUNT(*) as generated_count,
          SUM(CASE WHEN is_listened THEN 1 ELSE 0 END) as listened_count,
          ROUND(100.0 * SUM(CASE WHEN is_listened THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as listen_rate_pct,
          SUM(audio_estimated_cost) as total_tts_cost,
          SUM(audio_character_count) as total_characters
        FROM generated_content
      `;
      const params: unknown[] = [];
      let paramIndex = 1;

      if (contentType) {
        sql += ` WHERE content_type = $${paramIndex}`;
        params.push(contentType);
        paramIndex++;
      }

      sql += ` GROUP BY content_type, target_error_type, target_category ORDER BY generated_count DESC LIMIT $${paramIndex}`;
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

  // ─── cl_get_learning_narratives ───
  server.registerTool(
    'cl_get_learning_narratives',
    {
      title: 'Get Learning Narratives',
      description:
        'Returns AI-generated learning narrative summaries — periodic reflections on learner progress with stats. Anonymized. Useful for auditing narrative quality and checking if the reflection system captures meaningful patterns.',
      inputSchema: z.object({
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe('Max results (default 10)'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ limit }) => {
      const result = await query(
        `SELECT
          id, narrative_text, stats, created_at
        FROM learning_narratives
        ORDER BY created_at DESC
        LIMIT $1`,
        [limit]
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
