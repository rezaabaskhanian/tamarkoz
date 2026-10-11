import { getDb, query, run } from '.';

export type Subject = {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  archived: number;
};

export const SUBJECT_COLORS = [
  '#10B981', // green
  '#3B82F6', // blue
  '#F97316', // orange
  '#8B5CF6', // purple
  '#EF4444', // red
  '#06B6D4', // cyan
  '#EAB308', // mustard
  '#EC4899', // pink
  '#64748B', // slate
  '#A16207', // brown
];

export type Field = 'riazi' | 'tajrobi' | 'ensani' | 'honar' | 'zaban' | 'other';

export const FIELDS: { id: Field; label: string }[] = [
  { id: 'riazi', label: 'ریاضی' },
  { id: 'tajrobi', label: 'تجربی' },
  { id: 'ensani', label: 'انسانی' },
  { id: 'honar', label: 'هنر' },
  { id: 'zaban', label: 'زبان' },
  { id: 'other', label: 'سایر' },
];

// F09 defaults. Not yet checked against the official Konkur booklet — review before release.
export const DEFAULT_SUBJECTS: Record<Field, string[]> = {
  riazi: ['ریاضیات', 'فیزیک', 'شیمی'],
  tajrobi: ['زیست‌شناسی', 'شیمی', 'فیزیک', 'ریاضی', 'زمین‌شناسی'],
  ensani: [
    'ریاضی و آمار',
    'اقتصاد',
    'ادبیات',
    'عربی',
    'تاریخ و جغرافیا',
    'علوم اجتماعی',
    'فلسفه و منطق',
    'روان‌شناسی',
  ],
  honar: [],
  zaban: [],
  other: [],
};

export function listSubjects(includeArchived = false) {
  return query<Subject>(
    `SELECT * FROM subjects ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, sort_order, id`,
  );
}

export async function addSubject(name: string, color?: string) {
  const [{ n, maxOrder }] = await query<{ n: number; maxOrder: number | null }>(
    'SELECT COUNT(*) AS n, MAX(sort_order) AS maxOrder FROM subjects',
  );
  const res = await run(
    'INSERT INTO subjects (name, color, sort_order) VALUES (?, ?, ?)',
    [name.trim(), color ?? SUBJECT_COLORS[n % SUBJECT_COLORS.length], (maxOrder ?? -1) + 1],
  );
  return res.insertId!;
}

/** Replaces the subject list for a field, used only during onboarding. */
export async function seedSubjects(field: Field) {
  const existing = await query<{ n: number }>('SELECT COUNT(*) AS n FROM subjects');
  if (existing[0].n > 0) return;
  const names = DEFAULT_SUBJECTS[field];
  await getDb().transaction(async tx => {
    for (let i = 0; i < names.length; i++) {
      await tx.execute('INSERT INTO subjects (name, color, sort_order) VALUES (?, ?, ?)', [
        names[i],
        SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        i,
      ]);
    }
  });
}

export async function updateSubject(id: number, name: string, color: string) {
  await run('UPDATE subjects SET name = ?, color = ? WHERE id = ?', [name.trim(), color, id]);
}

/** Moves a subject one step up or down in the list. */
export async function moveSubject(id: number, direction: -1 | 1) {
  const list = await listSubjects();
  const i = list.findIndex(s => s.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await getDb().transaction(async tx => {
    for (let k = 0; k < list.length; k++) {
      await tx.execute('UPDATE subjects SET sort_order = ? WHERE id = ?', [k, list[k].id]);
    }
  });
}

/**
 * A subject with sessions (or used by the schedule) is archived, not deleted, so
 * old reports stay correct. Returns what happened.
 */
export async function removeSubject(id: number): Promise<'deleted' | 'archived'> {
  const [{ n }] = await query<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM sessions WHERE subject_id = ?) +
            (SELECT COUNT(*) FROM schedule_blocks WHERE subject_id = ?) AS n`,
    [id, id],
  );
  if (n > 0) {
    await run('UPDATE subjects SET archived = 1 WHERE id = ?', [id]);
    return 'archived';
  }
  await run('DELETE FROM subjects WHERE id = ?', [id]);
  return 'deleted';
}

export async function unarchiveSubject(id: number) {
  await run('UPDATE subjects SET archived = 0 WHERE id = ?', [id]);
}
