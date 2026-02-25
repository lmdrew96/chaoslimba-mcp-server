import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerGrammarTools } from './tools/grammar.js';
import { registerContentTools } from './tools/content.js';
import { registerErrorTools } from './tools/errors.js';

const server = new McpServer({
  name: 'chaoslimba-mcp-server',
  version: '1.0.0',
});

registerSchemaTools(server);
registerGrammarTools(server);
registerContentTools(server);
registerErrorTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});