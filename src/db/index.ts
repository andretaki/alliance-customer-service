import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Connect to database
client.connect().catch((err) => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});

export const db = drizzle(client, { schema });
export * from './schema';