import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

export function registerUsageTools(server: McpServer): void {
  // ─── cl_get_tts_usage ───
  server.registerTool(
    'cl_get_tts_usage',
    {
      title: 'Get TTS Usage',
      description:
        'Returns TTS (text-to-speech) usage stats — characters consumed per day. Useful for monitoring costs and usage trends.',
      inputSchema: z.object({
        days: z
          .number()
          .min(1)
          .max(365)
          .default(30)
          .describe('Number of days to look back (default 30)'),
      }),
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ days }) => {
      const result = await query(
        `SELECT
          DATE(date) as usage_date,
          SUM(characters_used) as total_characters
        FROM tts_usage
        WHERE date >= NOW() - INTERVAL '1 day' * $1
        GROUP BY DATE(date)
        ORDER BY usage_date DESC`,
        [days]
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
