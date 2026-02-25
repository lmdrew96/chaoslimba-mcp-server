import pg from 'pg';

const connectionString = process.env.CHAOSLIMBA_DATABASE_URL;

if (!connectionString) {
  console.error('Error: CHAOSLIMBA_DATABASE_URL environment variable is required.');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function shutdown(): Promise<void> {
  await pool.end();
}