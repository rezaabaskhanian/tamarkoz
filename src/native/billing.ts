import NativeBilling from './NativeBilling';

export type Purchase = {
  productId: string;
  purchaseToken: string;
  purchaseTime: number;
  orderId: string;
  purchased: boolean;
};

export type Sku = { sku: string; price: string; title: string };

type Fail = { ok: false; error: string };

export const billing = {
  isBazaarInstalled: () => NativeBilling.isBazaarInstalled(),

  async skus(inApp: string[], subs: string[]): Promise<{ ok: true; skus: Sku[] } | Fail> {
    return JSON.parse(
      await NativeBilling.getSkuDetails(JSON.stringify(inApp), JSON.stringify(subs)),
    );
  },

  async purchase(
    productId: string,
    isSubscription: boolean,
  ): Promise<{ ok: true; purchase: Purchase } | Fail> {
    return JSON.parse(await NativeBilling.purchase(productId, isSubscription));
  },

  async purchases(): Promise<{ ok: true; inApp: Purchase[]; subs: Purchase[] } | Fail> {
    return JSON.parse(await NativeBilling.getPurchases());
  },
};

/** Persian message for a billing error code. */
export function billingErrorMessage(code: string): string {
  switch (code) {
    case 'bazaar_not_installed':
      return 'برای خرید باید کافه‌بازار روی گوشی نصب باشد.';
    case 'canceled':
      return 'خرید لغو شد.';
    case 'not_configured':
      return 'پرداخت هنوز در این نسخه تنظیم نشده است.';
    case 'no_activity':
      return 'دوباره تلاش کن.';
    default:
      return 'ارتباط با بازار برقرار نشد. مطمئن شو در بازار وارد حسابت شده‌ای و دوباره تلاش کن.';
  }
}
