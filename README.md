# chaoslimba-mcp-server

MCP server for [ChaosLimba](https://github.com/lmdrew96) — provides read-only access to the Romanian language learning platform's database via the [Model Context Protocol](https://modelcontextprotocol.io/).

Built with TypeScript, the `@modelcontextprotocol/sdk`, and PostgreSQL.

## Tools

| Tool | Description |
|------|-------------|
| `cl_get_schema` | Returns all tables and columns in the database. Good starting point for orientation. |
| `cl_get_grammar_map` | Lists grammar features from `grammar_feature_map`, optionally filtered by CEFR level (A1–C2). |
| `cl_get_prerequisite_chain` | Traces the full recursive prerequisite tree for a given grammar feature. |
| `cl_get_content` | Browses content items with optional filters for difficulty, topic, and type (audio/text). |
| `cl_coverage_report` | Cross-references grammar features against content items to identify coverage gaps. |
| `cl_get_error_patterns` | Aggregates anonymized error logs to show where learners struggle most. |
| `cl_get_adaptation_summary` | Summarizes fossilization interventions — escalation tiers, counts, and resolution rates. |

## Setup

### Prerequisites

- Node.js 18+
- A PostgreSQL database with the ChaosLimba schema

### Install & Build

```bash
npm install
npm run build
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CHAOSLIMBA_DATABASE_URL` | Yes | PostgreSQL connection string |

### Run

```bash
CHAOSLIMBA_DATABASE_URL="postgresql://..." npm start
```

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chaoslimba": {
      "command": "node",
      "args": ["/absolute/path/to/chaoslimba-mcp-server/dist/index.js"],
      "env": {
        "CHAOSLIMBA_DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```
