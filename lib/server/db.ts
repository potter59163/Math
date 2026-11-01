import 'server-only';
import { MongoClient, type Db } from 'mongodb';
import { ensureIndexes } from './store';

// The only place that reads the database address. It has no NEXT_PUBLIC_ prefix, so it can never reach
// a browser bundle, and this file refuses to be imported by one.

const DEFAULT_DATABASE = 'kidma';

export function databaseConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

async function connect(): Promise<Db> {
  const client = new MongoClient(process.env.MONGODB_URI ?? '', {
    // Each running copy of the app holds its own connections, and a free cluster allows 500 in all.
    maxPoolSize: 5,
    // A student is waiting, and a failed request is safe: the browser keeps its queue and tries again.
    serverSelectionTimeoutMS: 5000,
    // A field left undefined is simply not stored, as it was when every row went through JSON.
    ignoreUndefined: true,
  });
  try {
    const db = client.db(process.env.MONGODB_DB || DEFAULT_DATABASE);
    await ensureIndexes(db);
    return db;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

// On globalThis because a hot reload in development would otherwise open a new pool every time.
const shared = globalThis as typeof globalThis & { kidmaDatabase?: Promise<Db> };

/** Connects once per process. A failure is not remembered, so the next request tries again. */
export function database(): Promise<Db> {
  shared.kidmaDatabase ??= connect().catch((error: unknown) => {
    shared.kidmaDatabase = undefined;
    throw error;
  });
  return shared.kidmaDatabase;
}
