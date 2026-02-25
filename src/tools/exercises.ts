import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

const cefrEnum = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export function registerExerciseTools(server: McpServer): void {
  // ─── cl_get_reading_questions ───
  server.registerTool(
    'cl_get_reading_questions',
    {
      title: 'Get Reading Questions',
      description:
        'Returns reading comprehension questions, optionally filtered by CEFR level. Shows passage text, question, answer options, and correct index. Useful for auditing question quality and level coverage.',
      inputSchema: z.object({
        level: cefrEnum
          .optional()
          .describe('Filter by CEFR level'),
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
    async ({ level, limit }) => {
      let sql = `SELECT * FROM reading_questions WHERE is_active = true`;
      const params: unknown[] = [];
      let paramIndex = 1;

      if (level) {
        sql += ` AND level = $${paramIndex}`;
        params.push(level);
        paramIndex++;
      }

      sql += ` ORDER BY sort_order LIMIT $${paramIndex}`;
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

  // ─── cl_get_stress_pairs ───
  server.registerTool(
    'cl_get_stress_pairs',
    {
      title: 'Get Stress Minimal Pairs',
      description:
        'Returns stress minimal pairs — words where stress placement changes meaning (e.g., CÁsă vs caSĂ). Core pronunciation training data.',
      inputSchema: z.object({
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
    async ({ limit }) => {
      const result = await query(
        `SELECT * FROM stress_minimal_pairs ORDER BY created_at DESC LIMIT $1`,
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

  // ─── cl_get_suggested_questions ───
  server.registerTool(
    'cl_get_suggested_questions',
    {
      title: 'Get Suggested Questions',
      description:
        'Returns AI tutor conversation starter questions, optionally filtered by CEFR level or category. Useful for auditing prompt quality and topic coverage.',
      inputSchema: z.object({
        cefrLevel: cefrEnum
          .optional()
          .describe('Filter by CEFR level'),
        category: z
          .string()
          .optional()
          .describe('Filter by category'),
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
    async ({ cefrLevel, category, limit }) => {
      let sql = `SELECT * FROM suggested_questions WHERE is_active = true`;
      const params: unknown[] = [];
      let paramIndex = 1;

      if (cefrLevel) {
        sql += ` AND cefr_level = $${paramIndex}`;
        params.push(cefrLevel);
        paramIndex++;
      }

      if (category) {
        sql += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      sql += ` ORDER BY sort_order LIMIT $${paramIndex}`;
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

  // ─── cl_get_tutor_openings ───
  server.registerTool(
    'cl_get_tutor_openings',
    {
      title: 'Get Tutor Opening Messages',
      description:
        'Returns tutor opening messages keyed by self-assessment level. Shows how the AI tutor greets learners at different proficiency levels.',
      inputSchema: z.object({
        selfAssessmentKey: z
          .string()
          .optional()
          .describe('Filter by self-assessment key'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ selfAssessmentKey }) => {
      let sql = `SELECT * FROM tutor_opening_messages WHERE is_active = true`;
      const params: unknown[] = [];

      if (selfAssessmentKey) {
        sql += ` AND self_assessment_key = $1`;
        params.push(selfAssessmentKey);
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
}
