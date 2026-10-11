import { query, run } from '.';

export type ScheduleBlock = {
  id: number;
  weekday: number; // 0 = Saturday … 6 = Friday
  start_minute: number;
  duration_minutes: number;
  subject_id: number | null;
  mode: 'normal' | 'strict';
  enabled: number;
};

export type ScheduleBlockWithSubject = ScheduleBlock & {
  subject_name: string | null;
  subject_color: string | null;
};

export function listBlocks() {
  return query<ScheduleBlockWithSubject>(
    `SELECT b.*, s.name AS subject_name, s.color AS subject_color
     FROM schedule_blocks b LEFT JOIN subjects s ON s.id = b.subject_id
     ORDER BY b.weekday, b.start_minute`,
  );
}

export type BlockInput = Omit<ScheduleBlock, 'id' | 'enabled'> & { enabled?: number };

/** Returns the block that would overlap the given one (blocks may not overlap, F13). */
export function findOverlap(
  blocks: ScheduleBlock[],
  input: Pick<ScheduleBlock, 'weekday' | 'start_minute' | 'duration_minutes'>,
  ignoreId?: number,
): ScheduleBlock | null {
  const WEEK = 7 * 1440;
  const a0 = input.weekday * 1440 + input.start_minute;
  const a1 = a0 + input.duration_minutes;
  for (const b of blocks) {
    if (b.id === ignoreId) continue;
    const b0 = b.weekday * 1440 + b.start_minute;
    const b1 = b0 + b.duration_minutes;
    // Compare against the block shifted by a week either way so Friday-night blocks
    // that run past midnight into Saturday are caught too.
    for (const shift of [-WEEK, 0, WEEK]) {
      if (a0 < b1 + shift && b0 + shift < a1) return b;
    }
  }
  return null;
}

export async function saveBlock(input: BlockInput, id?: number) {
  const params = [
    input.weekday,
    input.start_minute,
    input.duration_minutes,
    input.subject_id,
    input.mode,
    input.enabled ?? 1,
  ];
  if (id) {
    await run(
      `UPDATE schedule_blocks SET weekday = ?, start_minute = ?, duration_minutes = ?,
         subject_id = ?, mode = ?, enabled = ? WHERE id = ?`,
      [...params, id],
    );
    return id;
  }
  const res = await run(
    `INSERT INTO schedule_blocks (weekday, start_minute, duration_minutes, subject_id, mode, enabled)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params,
  );
  return res.insertId!;
}

export async function setBlockEnabled(id: number, enabled: boolean) {
  await run('UPDATE schedule_blocks SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
}

export async function deleteBlock(id: number) {
  // Past sessions keep their history; their schedule_block_id becomes NULL (FK ON DELETE SET NULL).
  await run('DELETE FROM schedule_blocks WHERE id = ?', [id]);
}

export async function skipsBetween(from: number, to: number) {
  const rows = await query<{ n: number }>(
    'SELECT COUNT(*) AS n FROM schedule_skips WHERE date >= ? AND date < ?',
    [from, to],
  );
  return rows[0].n;
}
