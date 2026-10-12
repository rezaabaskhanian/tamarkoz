import { PLANS, TRIAL_DAYS } from '../config';

// Entitlement rules (pure, unit-tested). No server: a purchase's validity is computed from
// the purchase time Bazaar returns, so it comes back identically after a reinstall.

const DAY = 24 * 60 * 60 * 1000;

export function planFor(productId: string) {
  return PLANS.find(p => p.productId === productId) ?? null;
}

/** When a one-time purchase stops being valid. */
export function purchaseExpiry(productId: string, purchaseTime: number): number {
  const plan = planFor(productId);
  return plan ? purchaseTime + plan.days * DAY : 0;
}

/** The free trial runs from the first install (Android keeps this across «clear data»). */
export function trialEnd(firstInstallTime: number): number {
  return firstInstallTime > 0 ? firstInstallTime + TRIAL_DAYS * DAY : 0;
}

export type Access = {
  /** Paid features are available (purchase or trial). */
  premium: boolean;
  until: number;
  source: 'purchase' | 'trial' | 'none';
  purchasedUntil: number;
  trialEndsAt: number;
};

export function access(purchasedUntil: number, trialEndsAt: number, now = Date.now()): Access {
  if (purchasedUntil > now) {
    // A purchase made during the trial wins; the trial's remaining days don't add up.
    return { premium: true, until: purchasedUntil, source: 'purchase', purchasedUntil, trialEndsAt };
  }
  if (trialEndsAt > now) {
    return { premium: true, until: trialEndsAt, source: 'trial', purchasedUntil, trialEndsAt };
  }
  return { premium: false, until: 0, source: 'none', purchasedUntil, trialEndsAt };
}

/** Whole days left (rounded up), for «۳ روز مانده». */
export function daysLeft(until: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((until - now) / DAY));
}
