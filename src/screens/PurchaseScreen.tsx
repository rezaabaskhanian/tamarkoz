import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { type IconName } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Card, IconBadge, Row } from '../components/ui';
import { PLANS, TRIAL_DAYS } from '../config';
import { billing, billingErrorMessage, type Sku } from '../native/billing';
import { daysLeft } from '../services/entitlement';
import { buy, PLAN_IDS, restorePurchases } from '../services/purchases';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { toFaDigits } from '../utils/digits';
import { formatJalaliDate } from '../utils/jalali';
import { showAlert } from '../components/Dialog';

const FEATURE_TONES = ['strict', 'cyan', 'primary', 'pink', 'orange', 'warning'] as const;

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'حالت سخت', text: 'بدون دکمه‌ی پایان؛ فقط روزی یک خروج اضطراری' },
  { icon: 'calendar', title: 'برنامه‌ی هفتگی با قفل خودکار', text: 'سر ساعت، حتی وقتی اپ بسته است' },
  { icon: 'chart', title: 'گزارش هفتگی و ماهانه', text: 'نمودار روزها، سهم درس‌ها، و فایل PDF برای مشاور' },
  { icon: 'add', title: 'قفل اپ‌های بیشتر', text: `بیشتر از ${toFaDigits(3)} اپ ممنوع` },
  { icon: 'home', title: 'ویجت صفحه‌ی اصلی', text: 'شمارش معکوس و ساعت امروز روی صفحه‌ی گوشی' },
  { icon: 'warning', title: 'محافظت در برابر حذف اپ', text: 'در حالت سخت، حذف اپ سخت‌تر می‌شود' },
];

export function PurchaseScreen() {
  const nav = useNav();
  const { active, access, reloadEntitlements } = useApp();
  const { colors } = useTheme();
  const [skus, setSkus] = useState<Sku[] | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [plan, setPlan] = useState(PLANS.find(p => p.best)?.productId ?? PLANS[0].productId);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    if (active) return;
    billing
      .skus(PLAN_IDS, [])
      .then(r => (r.ok ? setSkus(r.skus) : setSkuError(r.error)))
      .catch(() => setSkuError('failed'));
  }, [active]);

  // Never shown during an active session (F15).
  if (active) {
    return (
      <Screen title="نسخه‌ی کامل" back>
        <Card>
          <AppText>صفحه‌ی خرید وسط جلسه باز نمی‌شود. بعد از پایان جلسه دوباره سر بزن.</AppText>
          <Button title="برگشت" onPress={() => nav.goBack()} />
        </Card>
      </Screen>
    );
  }

  const price = (id: string) => skus?.find(x => x.sku === id)?.price;

  const onBuy = async () => {
    setBusy('buy');
    try {
      const r = await buy(plan);
      if (r.ok) {
        await reloadEntitlements();
        showAlert('ممنون! 🎉', 'اشتراکت فعال شد.', [{ text: 'باشه', onPress: () => nav.goBack() }], 'paymentSuccess');
      } else if (r.error !== 'canceled') {
        showAlert('خرید انجام نشد', billingErrorMessage(r.error), undefined, 'paymentFailed');
      }
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    setBusy('restore');
    try {
      const r = await restorePurchases();
      await reloadEntitlements();
      if (!r.ok) showAlert('بازیابی نشد', billingErrorMessage(r.error));
      else if (r.found) showAlert('بازیابی شد', 'خریدت پیدا شد و نسخه‌ی کامل فعال است.');
      else showAlert('خریدی پیدا نشد', 'با همان حساب بازاری که خرید کردی وارد شو و دوباره امتحان کن.');
    } finally {
      setBusy(null);
    }
  };

  const purchased = access.source === 'purchase';
  const trial = access.source === 'trial';

  return (
    <Screen
      title="نسخه‌ی کامل"
      back
      footer={
        purchased ? undefined : (
          <>
            <Button title="خرید از بازار" size="lg" loading={busy === 'buy'} disabled={busy != null} onPress={onBuy} />
            <Button title="بازیابی خرید" variant="ghost" loading={busy === 'restore'} disabled={busy != null} onPress={onRestore} />
          </>
        )
      }
    >
      {purchased && (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <AppText weight="bold" color={colors.success}>
            اشتراکت فعال است
          </AppText>
          <AppText variant="caption">
            تا {formatJalaliDate(access.until)} · {toFaDigits(daysLeft(access.until))} روز مانده
          </AppText>
          <AppText variant="caption" muted>
            بعد از پایان این مدت می‌توانی دوباره بخری.
          </AppText>
          <Button title="بازیابی خرید" variant="ghost" size="sm" loading={busy === 'restore'} onPress={onRestore} />
        </Card>
      )}
      {trial && (
        <Card tone="tint">
          <AppText weight="bold" color={colors.primary}>
            دوره‌ی رایگان {toFaDigits(TRIAL_DAYS)} روزه · {toFaDigits(daysLeft(access.until))} روز مانده
          </AppText>
          <AppText variant="caption" muted>
            الان همه‌ی امکانات نسخه‌ی کامل را داری. برای ادامه بعد از {formatJalaliDate(access.until)} یکی از طرح‌ها را بخر.
          </AppText>
        </Card>
      )}
      {access.source === 'none' && access.trialEndsAt > 0 && (
        <Card tone="tint">
          <AppText weight="bold">دوره‌ی رایگانت تمام شده</AppText>
          <AppText variant="caption" muted>
            داده‌هایت سر جایشان هستند؛ با خرید، همه‌ی امکانات دوباره باز می‌شوند.
          </AppText>
        </Card>
      )}

      {FEATURES.map((f, i) => (
        <Row key={f.title} gap={spacing.md}>
          <IconBadge name={f.icon} tone={FEATURE_TONES[i % FEATURE_TONES.length]} size={40} />
          <View style={{ flex: 1 }}>
            <AppText weight="bold">{f.title}</AppText>
            <AppText variant="caption" muted>
              {f.text}
            </AppText>
          </View>
        </Row>
      ))}

      {!purchased && (
        <>
          {PLANS.map(p => (
            <PlanCard
              key={p.productId}
              selected={plan === p.productId}
              onPress={() => setPlan(p.productId)}
              title={p.title}
              price={price(p.productId)}
              note={`یک بار پرداخت · ${toFaDigits(p.days)} روز دسترسی کامل · تمدید خودکار ندارد`}
              highlight={p.best}
            />
          ))}
          {skuError && (
            <AppText variant="caption" color={colors.danger}>
              {billingErrorMessage(skuError)}
            </AppText>
          )}
        </>
      )}
      <AppText variant="caption" muted>
        پرداخت فقط از طریق کافه‌بازار انجام می‌شود. اگر اعتبارت تمام شود، داده‌هایت پاک نمی‌شود.
      </AppText>
    </Screen>
  );
}

function PlanCard({
  selected,
  onPress,
  title,
  price,
  note,
  highlight,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  price?: string;
  note: string;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable onPress={onPress} style={[s.plan, selected && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
      <View style={[s.radio, selected && { borderColor: colors.primary }]}>
        {selected && <View style={s.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Row>
          <AppText weight="bold">{title}</AppText>
          {highlight && (
            <View style={s.best}>
              <AppText variant="caption" color={colors.onPrimary}>
                پیشنهاد ما
              </AppText>
            </View>
          )}
        </Row>
        <AppText variant="caption" muted>
          {note}
        </AppText>
      </View>
      <AppText weight="bold">{price ?? '…'}</AppText>
    </Pressable>
  );
}

const useStyles = makeStyles(c => ({
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  best: { backgroundColor: c.primary, borderRadius: radius.pill, paddingHorizontal: 8 },
}));
