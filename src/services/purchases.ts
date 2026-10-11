import {
  PASS_EXPIRES_AT,
  PRODUCT_MONTHLY,
  PRODUCT_PASS,
  SUBSCRIPTION_GRACE_MS,
} from '../config';
import { removeEntitlement, saveEntitlement } from '../db/entitlement';
import { billing, type Purchase } from '../native/billing';

async function record(p: Purchase) {
  await saveEntitlement({
    product_id: p.productId,
    purchase_token: p.purchaseToken,
    purchased_at: p.purchaseTime,
    expires_at:
      p.productId === PRODUCT_PASS ? PASS_EXPIRES_AT : Date.now() + SUBSCRIPTION_GRACE_MS,
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

  const pass = r.inApp.find(p => p.productId === PRODUCT_PASS && p.purchased);
  if (pass) await record(pass);
  else await removeEntitlement(PRODUCT_PASS);

  const sub = r.subs.find(p => p.productId === PRODUCT_MONTHLY && p.purchased);
  if (sub) await record(sub);
  else await removeEntitlement(PRODUCT_MONTHLY);

  return { ok: true, found: Boolean(pass || sub) };
}

export async function buy(productId: string) {
  const r = await billing.purchase(productId, productId === PRODUCT_MONTHLY);
  if (r.ok) await record(r.purchase);
  return r;
}
