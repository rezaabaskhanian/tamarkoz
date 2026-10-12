// Product decisions that are not user settings. Prices are read from Bazaar, never from here.

// Plans, LingoFlow-style: one-time (in-app) Bazaar products per duration — not subscriptions.
// Prices come from Bazaar, never from here. Create these ids in the Bazaar developer panel.
export type Plan = { productId: string; days: number; title: string; best?: boolean };
export const PLANS: Plan[] = [
  { productId: 'tamarkoz_6m', days: 180, title: 'اشتراک ۶ ماهه', best: true },
  { productId: 'tamarkoz_1m', days: 30, title: 'اشتراک ۱ ماهه' },
];

/** Every new install gets all paid features free for this many days. */
export const TRIAL_DAYS = 7;

export const FREE_BLOCKED_APPS_LIMIT = 3;
export const DURATION_PRESETS = [25, 45, 60, 90, 120];
export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 480;
export const STRICT_MAX_MINUTES = 240;
export const EMERGENCY_WAIT_SECONDS = 60;
export const EXTEND_MINUTES = 10;

export const SUPPORT_EMAIL = 'rezaabaskhanian1367kash@gmail.com';
export const SUPPORT_TELEGRAM = 'RezaAbaskhanian'; // https://t.me/RezaAbaskhanian
