import { query, run } from '.';

// «کاغذ افکار»: a distracting thought is written down during a session and looked at
// afterwards, in a short «وقت فکر کردن», instead of being followed right away.

export type Thought = {
  id: number;
  text: string;
  created_at: number;
  session_native_id: string | null;
};

export async function addThought(text: string, sessionNativeId: string | null) {
  await run('INSERT INTO thoughts (text, created_at, session_native_id) VALUES (?, ?, ?)', [
    text.trim().slice(0, 200),
    Date.now(),
    sessionNativeId,
  ]);
}

/** All thoughts not dealt with yet, this session's first. */
export function listThoughts(sessionNativeId?: string | null) {
  return query<Thought>(
    'SELECT * FROM thoughts ORDER BY (session_native_id = ?) DESC, created_at',
    [sessionNativeId ?? ''],
  );
}

export async function countThoughts(sessionNativeId: string) {
  const rows = await query<{ n: number }>('SELECT COUNT(*) AS n FROM thoughts WHERE session_native_id = ?', [
    sessionNativeId,
  ]);
  return rows[0].n;
}

/** Thought about it: it leaves the paper. */
export async function deleteThought(id: number) {
  await run('DELETE FROM thoughts WHERE id = ?', [id]);
}
