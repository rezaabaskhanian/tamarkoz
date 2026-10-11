import type { Scalar } from '@op-engineering/op-sqlite';
import { getDb, query } from '../db';
import { SCHEMA_VERSION } from '../db/migrations';

// F25: export / import every table (except purchases, which are restored from Bazaar)
// into one JSON file, for moving to a new phone.

// Order matters: parents before children for inserts, reverse for deletes.
const TABLES = ['subjects', 'schedule_blocks', 'sessions', 'schedule_skips', 'blocked_apps', 'settings'] as const;

type Backup = {
  app: 'tamarkoz';
  schemaVersion: number;
  exportedAt: number;
  tables: Record<(typeof TABLES)[number], Record<string, Scalar>[]>;
};

export async function exportBackup(): Promise<string> {
  const tables = {} as Backup['tables'];
  for (const t of TABLES) tables[t] = await query<Record<string, Scalar>>(`SELECT * FROM ${t}`);
  const data: Backup = { app: 'tamarkoz', schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), tables };
  return JSON.stringify(data);
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  if (data?.app !== 'tamarkoz' || typeof data.tables !== 'object') {
    throw new Error('not_backup');
  }
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error('newer_version');
  for (const t of TABLES) {
    if (!Array.isArray(data.tables[t])) throw new Error('not_backup');
  }
  return data as Backup;
}

/** Replaces all local data with the backup, in one transaction. */
export async function importBackup(b: Backup) {
  const db = getDb();
  await db.transaction(async tx => {
    for (const t of [...TABLES].reverse()) await tx.execute(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const cols = await tx.execute(`PRAGMA table_info(${t})`);
      const known = new Set(cols.rows.map(r => String(r.name)));
      for (const row of b.tables[t]) {
        const keys = Object.keys(row).filter(k => known.has(k));
        if (keys.length === 0) continue;
        await tx.execute(
          `INSERT OR REPLACE INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
          keys.map(k => row[k]),
        );
      }
    }
  });
}

/** F17: «پاک کردن همه‌ی داده‌ها». */
export async function clearAllData() {
  await getDb().transaction(async tx => {
    for (const t of [...TABLES].reverse()) await tx.execute(`DELETE FROM ${t}`);
    await tx.execute('DELETE FROM entitlement');
  });
}
