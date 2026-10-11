import { useEffect, useState } from 'react';
import { AppText } from '../components/AppText';
import { Screen } from '../components/Screen';
import { Button, Card, Segmented } from '../components/ui';
import { focus } from '../native/focus';
import { useNav } from '../app/RootNavigator';

type Brand = 'xiaomi' | 'samsung' | 'huawei';

// Menu names differ between ROM versions; the wording here says "something like".
const GUIDES: Record<Brand, string[]> = {
  xiaomi: [
    'تنظیمات ← برنامه‌ها ← مدیریت برنامه‌ها ← تمرکز ← «شروع خودکار» را روشن کن.',
    'در همان صفحه «صرفه‌جویی باتری» را روی «بدون محدودیت» بگذار.',
    'در «سایر مجوزها» گزینه‌ی «نمایش پنجره‌های بازشو هنگام اجرا در پس‌زمینه» را روشن کن.',
    'در فهرست برنامه‌های اخیر، روی کارت تمرکز نگه دار و قفل (🔒) را بزن تا بسته نشود.',
  ],
  samsung: [
    'تنظیمات ← مراقبت از دستگاه/باتری ← محدودیت‌های مصرف پس‌زمینه ← «برنامه‌های همیشه بیدار» ← تمرکز را اضافه کن.',
    'مطمئن شو تمرکز در «برنامه‌های در خواب» یا «در خواب عمیق» نیست.',
    'تنظیمات ← برنامه‌ها ← تمرکز ← باتری ← «نامحدود».',
  ],
  huawei: [
    'تنظیمات ← باتری ← راه‌اندازی برنامه ← تمرکز را از حالت خودکار خارج کن و هر سه گزینه (شروع خودکار، شروع ثانویه، اجرا در پس‌زمینه) را روشن کن.',
    'در فهرست برنامه‌های اخیر، کارت تمرکز را پایین بکش تا قفل شود.',
  ],
};

/** F17: «قفل کار نمی‌کند» guide per manufacturer. */
export function TroubleshootScreen() {
  const nav = useNav();
  const [brand, setBrand] = useState<Brand>('xiaomi');

  useEffect(() => {
    focus
      .deviceInfo()
      .then(d => {
        const m = d.manufacturer;
        if (['xiaomi', 'redmi', 'poco'].includes(m)) setBrand('xiaomi');
        else if (m === 'samsung') setBrand('samsung');
        else if (['huawei', 'honor'].includes(m)) setBrand('huawei');
      })
      .catch(() => {});
  }, []);

  return (
    <Screen title="قفل کار نمی‌کند؟" back>
      <Card>
        <AppText weight="bold">اول این‌ها را چک کن</AppText>
        <AppText>۱. در «وضعیت مجوزها» هر دو مجوز اجباری سبز باشند.</AppText>
        <AppText>۲. بهینه‌سازی باتری برای تمرکز خاموش باشد.</AppText>
        <AppText>۳. اعلان «جلسه‌ی در حال اجرا» در نوار اعلان دیده شود.</AppText>
        <Button title="وضعیت مجوزها" variant="secondary" size="sm" onPress={() => nav.navigate('Permissions', { flow: 'status' })} />
      </Card>
      <Segmented
        value={brand}
        onChange={setBrand}
        options={[
          { value: 'xiaomi', label: 'شیائومی' },
          { value: 'samsung', label: 'سامسونگ' },
          { value: 'huawei', label: 'هواوی' },
        ]}
      />
      <Card>
        {GUIDES[brand].map((t, i) => (
          <AppText key={i}>{t}</AppText>
        ))}
        <AppText variant="caption" muted>
          نام منوها در نسخه‌های مختلف گوشی کمی فرق دارد.
        </AppText>
        <Button title="باز کردن تنظیمات شروع خودکار" size="sm" onPress={() => focus.openPermission('autostart')} />
        <Button title="باز کردن تنظیمات باتری" size="sm" variant="secondary" onPress={() => focus.openPermission('battery')} />
      </Card>
    </Screen>
  );
}
