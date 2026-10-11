import { jalaliToMs } from './utils/jalali';

// Product decisions that are not user settings. Prices are read from Bazaar, never from here.

export const PRODUCT_PASS = 'konkur_pass_1406'; // one-time "until the exam" pass
export const PRODUCT_MONTHLY = 'premium_monthly'; // monthly subscription

/** The pass is valid until the end of this Jalali day. Next year: new product id and date. */
export const PASS_EXPIRES = { jy: 1406, jm: 5, jd: 31 };
// End of 31 Mordad = one millisecond before 1 Shahrivar.
export const PASS_EXPIRES_AT = jalaliToMs({ jy: 1406, jm: 6, jd: 1 }) - 1;

/**
 * Bazaar can't be asked offline whether a subscription is still active, so after each
 * successful check the subscription counts as valid for this long.
 */
export const SUBSCRIPTION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export const FREE_BLOCKED_APPS_LIMIT = 3;
export const DURATION_PRESETS = [25, 45, 60, 90, 120];
export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 480;
export const STRICT_MAX_MINUTES = 240;
export const EMERGENCY_WAIT_SECONDS = 60;
export const EXTEND_MINUTES = 10;

export const SUPPORT_EMAIL = 'support@example.com'; // TODO: real support address before release
export const APP_VERSION = '1.0';
