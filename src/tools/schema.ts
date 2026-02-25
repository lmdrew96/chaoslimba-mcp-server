import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '../db.js';

export function registerSchemaTools(server: McpServer): void {
  server.registerTool(
    'cl_get_schema',
    {
      title: 'Get Database Schema',
      description:
        'Returns a summary of all tables and their columns in the ChaosLimba database. Use this to orient yourself when first connecting.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      const result = await query<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>(
        `SELECT table_name, column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`
      );

      // Group by table name
      const tables: Record<string, Array<{ column: string; type: string }>> = {};
      for (const row of result.rows) {
        if (!tables[row.table_name]) {
          tables[row.table_name] = [];
        }
        tables[row.table_name].push({
          column: row.column_name,
          type: row.data_type,
        });
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(tables, null, 2),
          },
        ],
      };
    }
  );
}