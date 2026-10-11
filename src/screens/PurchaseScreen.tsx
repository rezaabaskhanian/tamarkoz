import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon, type IconName } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Card, Row } from '../components/ui';
import { PASS_EXPIRES_AT, PRODUCT_MONTHLY, PRODUCT_PASS } from '../config';
import { billing, billingErrorMessage, type Sku } from '../native/billing';
import { buy, restorePurchases } from '../services/purchases';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { toFaDigits } from '../utils/digits';
import { formatJalaliDate } from '../utils/jalali';

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
  const { active, isPremium, premiumUntil, entitlements, reloadEntitlements } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [skus, setSkus] = useState<Sku[] | null>(null);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [plan, setPlan] = useState(PRODUCT_PASS);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    if (active) return;
    billing
      .skus([PRODUCT_PASS], [PRODUCT_MONTHLY])
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
        Alert.alert('ممنون! 🎉', 'نسخه‌ی کامل فعال شد.', [{ text: 'باشه', onPress: () => nav.goBack() }]);
      } else if (r.error !== 'canceled') {
        Alert.alert('خرید انجام نشد', billingErrorMessage(r.error));
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
      if (!r.ok) Alert.alert('بازیابی نشد', billingErrorMessage(r.error));
      else if (r.found) Alert.alert('بازیابی شد', 'خریدت پیدا شد و نسخه‌ی کامل فعال است.');
      else Alert.alert('خریدی پیدا نشد', 'با همان حساب بازاری که خرید کردی وارد شو و دوباره امتحان کن.');
    } finally {
      setBusy(null);
    }
  };

  const hasSub = entitlements.some(e => e.product_id === PRODUCT_MONTHLY);

  return (
    <Screen
      title="نسخه‌ی کامل"
      back
      footer={
        isPremium ? undefined : (
          <>
            <Button title="خرید از بازار" size="lg" loading={busy === 'buy'} disabled={busy != null} onPress={onBuy} />
            <Button title="بازیابی خرید" variant="ghost" loading={busy === 'restore'} disabled={busy != null} onPress={onRestore} />
          </>
        )
      }
    >
      {isPremium && (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <AppText weight="bold" color={colors.success}>
            نسخه‌ی کامل فعال است
          </AppText>
          <AppText variant="caption">
            {hasSub ? 'اشتراک ماهانه' : `اعتبار تا ${formatJalaliDate(premiumUntil)}`}
          </AppText>
          <Button title="بازیابی خرید" variant="ghost" size="sm" loading={busy === 'restore'} onPress={onRestore} />
        </Card>
      )}

      {FEATURES.map(f => (
        <Row key={f.title} gap={spacing.md}>
          <View style={s.featureIcon}>
            <Icon name={f.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText weight="bold">{f.title}</AppText>
            <AppText variant="caption" muted>
              {f.text}
            </AppText>
          </View>
        </Row>
      ))}

      {!isPremium && (
        <>
          <PlanCard
            selected={plan === PRODUCT_PASS}
            onPress={() => setPlan(PRODUCT_PASS)}
            title="بسته‌ی «تا روز کنکور»"
            price={price(PRODUCT_PASS)}
            note={`یک بار پرداخت · معتبر تا ${formatJalaliDate(PASS_EXPIRES_AT)}`}
            highlight
          />
          <PlanCard
            selected={plan === PRODUCT_MONTHLY}
            onPress={() => setPlan(PRODUCT_MONTHLY)}
            title="اشتراک ماهانه"
            price={price(PRODUCT_MONTHLY)}
            note="هر ماه تمدید می‌شود؛ هر وقت خواستی از بازار لغوش کن"
          />
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
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: c.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
