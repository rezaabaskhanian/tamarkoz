import { PLANS } from '../config';
import { listEntitlements, removeEntitlement, saveEntitlement } from '../db/entitlement';
import { billing, type Purchase } from '../native/billing';
import { planFor, purchaseExpiry } from './entitlement';

// Cafe Bazaar purchases, modelled on LingoFlow: one-time products per duration
// (tamarkoz_1m, tamarkoz_6m). LingoFlow consumes right after buying because its server
// keeps the expiry; this app has no server, so a purchase stays unconsumed while valid
// (that's what restore-after-reinstall reads) and is consumed once it expires, so the
// same plan can be bought again.

async function record(p: Purchase) {
  await saveEntitlement({
    product_id: p.productId,
    purchase_token: p.purchaseToken,
    purchased_at: p.purchaseTime,
    expires_at: purchaseExpiry(p.productId, p.purchaseTime),
  });
}

/**
 * F15 restore: asks Bazaar for this user's purchases and mirrors them into the
 * entitlement table. Runs on every launch and from the «بازیابی خرید» button.
 * If Bazaar can't be reached, existing entitlements are kept until they expire.
 */
export async function restorePurchases(): Promise<
  { ok: true; found: boolean } | { ok: false; error: string }
> {
  if (!(await billing.isBazaarInstalled())) return { ok: false, error: 'bazaar_not_installed' };
  const r = await billing.purchases();
  if (!r.ok) return r;

  const now = Date.now();
  let found = false;
  const valid = new Set<string>();
  for (const p of r.inApp) {
    if (!p.purchased || !planFor(p.productId)) continue;
    if (purchaseExpiry(p.productId, p.purchaseTime) > now) {
      await record(p);
      valid.add(p.productId);
      found = true;
    } else {
      // Expired: consume so the user can buy this plan again.
      await billing.consume(p.purchaseToken).catch(() => {});
    }
  }
  // Drop entitlements Bazaar no longer reports (refunded, or consumed elsewhere).
  for (const e of await listEntitlements()) {
    if (!valid.has(e.product_id)) await removeEntitlement(e.product_id);
  }
  return { ok: true, found };
}

export async function buy(productId: string) {
  const r = await billing.purchase(productId, false);
  if (r.ok) await record(r.purchase);
  return r;
}

export const PLAN_IDS = PLANS.map(p => p.productId);
