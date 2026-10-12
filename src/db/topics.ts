import { query, run } from '.';

// Chapter / topic names per subject (e.g. ریاضیات → «مشتق»، «حد و پیوستگی»).

export type Topic = { id: number; subject_id: number; name: string; last_used_at: number };

export type SessionKind = 'study' | 'practice' | 'test';

export const SESSION_KINDS: { value: SessionKind; label: string }[] = [
  { value: 'study', label: 'مطالعه' },
  { value: 'practice', label: 'تمرین' },
  { value: 'test', label: 'تست' },
];

export const kindLabel = (k: string | null | undefined) =>
  SESSION_KINDS.find(x => x.value === k)?.label ?? 'مطالعه';

export function listTopics(subjectId: number) {
  return query<Topic>(
    'SELECT * FROM topics WHERE subject_id = ? ORDER BY last_used_at DESC, name LIMIT 30',
    [subjectId],
  );
}

export async function addTopic(subjectId: number, name: string) {
  await run('INSERT OR IGNORE INTO topics (subject_id, name, last_used_at) VALUES (?, ?, ?)', [
    subjectId,
    name.trim(),
    Date.now(),
  ]);
}

/** Moves a topic to the front of the picker. */
export async function touchTopic(subjectId: number, name: string) {
  await run(
    `INSERT INTO topics (subject_id, name, last_used_at) VALUES (?, ?, ?)
     ON CONFLICT(subject_id, name) DO UPDATE SET last_used_at = excluded.last_used_at`,
    [subjectId, name.trim(), Date.now()],
  );
}

export async function deleteTopic(id: number) {
  await run('DELETE FROM topics WHERE id = ?', [id]);
}
