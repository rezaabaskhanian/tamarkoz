import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { MIGRATIONS, SCHEMA_VERSION } from './migrations';

const DB_NAME = 'tamarkoz.db';

let db: DB | null = null;
let initPromise: Promise<DB> | null = null;

export function getDb(): DB {
  if (!db) {
    throw new Error('Database used before initDatabase() finished');
  }
  return db;
}

async function getUserVersion(conn: DB): Promise<number> {
  const res = await conn.execute('PRAGMA user_version');
  return Number(res.rows[0]?.user_version ?? 0);
}

async function migrate(conn: DB): Promise<void> {
  const current = await getUserVersion(conn);
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `Database version ${current} is newer than app schema ${SCHEMA_VERSION}`,
    );
  }
  for (let v = current; v < SCHEMA_VERSION; v++) {
    await conn.transaction(async tx => {
      for (const sql of MIGRATIONS[v]) {
        await tx.execute(sql);
      }
      await tx.execute(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Opens the database and applies pending migrations. Safe to call more than once. */
export function initDatabase(): Promise<DB> {
  if (!initPromise) {
    initPromise = (async () => {
      const conn = open({ name: DB_NAME });
      await conn.execute('PRAGMA foreign_keys = ON');
      await conn.execute('PRAGMA journal_mode = WAL');
      await migrate(conn);
      db = conn;
      return conn;
    })();
    initPromise.catch(() => {
      initPromise = null;
    });
  }
  return initPromise;
}

/** Runs a query and returns its rows typed as T. */
export async function query<T>(sql: string, params: Scalar[] = []): Promise<T[]> {
  const res = await getDb().execute(sql, params);
  return res.rows as unknown as T[];
}

/** Runs a write; returns the inserted row id (when there is one) and the affected row count. */
export async function run(
  sql: string,
  params: Scalar[] = [],
): Promise<{ insertId?: number; rowsAffected: number }> {
  const res = await getDb().execute(sql, params);
  return { insertId: res.insertId, rowsAffected: res.rowsAffected };
}
