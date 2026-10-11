import { query, run } from '.';

export type Entitlement = {
  product_id: string;
  purchase_token: string;
  purchased_at: number;
  expires_at: number | null;
};

export function listEntitlements() {
  return query<Entitlement>('SELECT * FROM entitlement');
}

export async function saveEntitlement(e: Entitlement) {
  await run(
    `INSERT INTO entitlement (product_id, purchase_token, purchased_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(product_id) DO UPDATE SET purchase_token = excluded.purchase_token,
       purchased_at = excluded.purchased_at, expires_at = excluded.expires_at`,
    [e.product_id, e.purchase_token, e.purchased_at, e.expires_at],
  );
}

export async function removeEntitlement(productId: string) {
  await run('DELETE FROM entitlement WHERE product_id = ?', [productId]);
}

/** Latest expiry among valid purchases; 0 when nothing is active. */
export function premiumUntil(list: Entitlement[], now = Date.now()): number {
  let until = 0;
  for (const e of list) {
    const exp = e.expires_at ?? Number.MAX_SAFE_INTEGER;
    if (exp > now && exp > until) until = exp;
  }
  return until;
}
