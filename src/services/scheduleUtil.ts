import type { ScheduleBlockWithSubject } from '../db/schedule';
import { addDays, startOfDay, weekdayIndex } from '../utils/jalali';

/** Next start (epoch ms) of a weekly block strictly after `from`. Mirrors Scheduler.nextOccurrence in Kotlin. */
export function nextOccurrence(b: { weekday: number; start_minute: number }, from: number): number {
  for (let d = 0; d <= 7; d++) {
    const day = addDays(startOfDay(from), d);
    if (weekdayIndex(day) !== b.weekday) continue;
    const t = new Date(day);
    t.setHours(Math.floor(b.start_minute / 60), b.start_minute % 60, 0, 0);
    if (t.getTime() > from) return t.getTime();
  }
  return -1;
}

export function nextBlock(blocks: ScheduleBlockWithSubject[], now: number) {
  let best: { block: ScheduleBlockWithSubject; at: number } | null = null;
  for (const b of blocks) {
    if (!b.enabled) continue;
    const at = nextOccurrence(b, now);
    if (at > 0 && (!best || at < best.at)) best = { block: b, at };
  }
  return best;
}
