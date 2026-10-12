import { access, daysLeft, purchaseExpiry, trialEnd } from '../src/services/entitlement';

const DAY = 86_400_000;
const t0 = new Date(2026, 9, 1, 12).getTime();

test('plan durations', () => {
  expect(purchaseExpiry('tamarkoz_1m', t0)).toBe(t0 + 30 * DAY);
  expect(purchaseExpiry('tamarkoz_6m', t0)).toBe(t0 + 180 * DAY);
  expect(purchaseExpiry('unknown', t0)).toBe(0);
});

test('7-day trial from install', () => {
  const end = trialEnd(t0);
  expect(end).toBe(t0 + 7 * DAY);
  expect(access(0, end, t0 + 3 * DAY)).toMatchObject({ premium: true, source: 'trial' });
  expect(daysLeft(end, t0 + 3 * DAY)).toBe(4);
  expect(access(0, end, t0 + 8 * DAY)).toMatchObject({ premium: false, source: 'none' });
});

test('a purchase overrides the trial', () => {
  const bought = purchaseExpiry('tamarkoz_1m', t0 + DAY);
  expect(access(bought, trialEnd(t0), t0 + 2 * DAY)).toMatchObject({
    premium: true,
    source: 'purchase',
    until: bought,
  });
  expect(access(bought, trialEnd(t0), bought + 1)).toMatchObject({ premium: false });
});
