import type { IconName } from './components/Icon';

// What a session is for. Only "study" counts toward study time, the daily goal, the
// streak and the counselor PDF; the others lock apps the same way and are reported apart.

export type BuiltinActivity = 'study' | 'deep_work' | 'sleep' | 'meal' | 'rest' | 'exercise';
/** Built-in key, or `custom:<id>` for a user-defined activity (premium). */
export type ActivityKey = BuiltinActivity | `custom:${number}`;

export type ActivityInfo = {
  key: ActivityKey;
  label: string;
  icon: IconName;
  color: string;
  free: boolean;
};

export const BUILTIN_ACTIVITIES: ActivityInfo[] = [
  { key: 'study', label: 'درس', icon: 'book', color: '#5B5BD6', free: true },
  { key: 'deep_work', label: 'کار عمیق', icon: 'work', color: '#3B82F6', free: true },
  { key: 'sleep', label: 'خواب', icon: 'moon', color: '#6366F1', free: true },
  { key: 'meal', label: 'غذا', icon: 'meal', color: '#F97316', free: false },
  { key: 'rest', label: 'استراحت بدون گوشی', icon: 'coffee', color: '#10B981', free: false },
  { key: 'exercise', label: 'ورزش', icon: 'fitness', color: '#EF4444', free: false },
];

export const CUSTOM_ACTIVITY_COLOR = '#64748B';

export function activityInfo(key: string, customName?: string | null): ActivityInfo {
  const builtin = BUILTIN_ACTIVITIES.find(a => a.key === key);
  if (builtin) return builtin;
  return {
    key: key as ActivityKey,
    label: customName || 'حالت دلخواه',
    icon: 'sparkle',
    color: CUSTOM_ACTIVITY_COLOR,
    free: false,
  };
}

/** Strict mode cap; sleep is long enough to need more than the usual four hours. */
export function strictMaxFor(key: string) {
  return key === 'sleep' ? 540 : 240;
}

/** Duration presets per activity (minutes). */
export function durationPresets(key: string): number[] {
  switch (key) {
    case 'sleep':
      return [360, 420, 480, 540];
    case 'meal':
      return [20, 30, 45, 60];
    case 'rest':
      return [10, 15, 20, 30];
    case 'exercise':
      return [30, 45, 60, 90];
    default:
      return [25, 45, 60, 90, 120];
  }
}

/** What to do in a phone-free break instead of scrolling. */
export const BREAK_TIPS = [
  { icon: 'fitness', text: 'پنج دقیقه کشش' },
  { icon: 'coffee', text: 'آب یا چای' },
  { icon: 'wave', text: 'قدم‌زدن کوتاه' },
  { icon: 'moon', text: 'چشم‌ها را ببند، فقط نفس بکش' },
  { icon: 'note', text: 'کاغذ افکارت را مرور کن' },
] as const satisfies readonly { icon: IconName; text: string }[];
