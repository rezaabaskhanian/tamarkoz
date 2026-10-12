import { query, run } from '.';

// User-defined activities (premium), referenced by sessions and blocks as `custom:<id>`.
export type CustomActivity = { id: number; name: string; created_at: number };

export function listCustomActivities() {
  return query<CustomActivity>('SELECT * FROM activities ORDER BY created_at');
}

export async function addCustomActivity(name: string) {
  const res = await run('INSERT OR IGNORE INTO activities (name, created_at) VALUES (?, ?)', [
    name.trim(),
    Date.now(),
  ]);
  return res.insertId;
}

export async function deleteCustomActivity(id: number) {
  await run('DELETE FROM activities WHERE id = ?', [id]);
}
