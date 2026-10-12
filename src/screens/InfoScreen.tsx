import { useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Screen } from '../components/Screen';
import { Card } from '../components/ui';

const PAGES: Record<'about' | 'privacy' | 'limits', { title: string; paragraphs: string[] }> = {
  about: {
    title: 'درباره‌ی تمرکز',
    paragraphs: [
      'تمرکز برای کنکوری‌هاست: در زمان مطالعه اپ‌های حواس‌پرت‌کن را قفل می‌کند، ساعت مطالعه را خودکار ثبت می‌کند و روزهای مانده تا کنکور را نشان می‌دهد.',
      'اپ بدون حساب کاربری و بدون سرور کار می‌کند.',
      'فونت: وزیرمتن، با مجوز SIL Open Font License.',
      'پشتیبانی: تلگرام @RezaAbaskhanian · ایمیل rezaabaskhanian1367kash@gmail.com',
    ],
  },
  privacy: {
    title: 'حریم خصوصی',
    paragraphs: [
      'هیچ داده‌ای از گوشی بیرون نمی‌رود. تمرکز حساب کاربری ندارد، سرور ندارد و از هیچ سرویس آمار یا تبلیغاتی استفاده نمی‌کند.',
      'دسترسی «آمار استفاده» فقط برای این است که بفهمیم کدام اپ الان باز است تا اگر ممنوع بود قفلش کنیم. این اطلاعات ذخیره یا ارسال نمی‌شود.',
      'جلسه‌ها، درس‌ها و تنظیمات فقط در حافظه‌ی همین گوشی ذخیره می‌شوند. با حذف اپ پاک می‌شوند، مگر این‌که خودت فایل پشتیبان بسازی.',
      'تنها ارتباط بیرونی، پرداخت از طریق کافه‌بازار است که خود بازار انجامش می‌دهد.',
    ],
  },
  limits: {
    title: 'محدودیت‌های قفل',
    paragraphs: [
      'تمرکز قفل صددرصدی وعده نمی‌دهد. هدفش سخت کردن حواس‌پرتی است، نه غیرممکن کردنش.',
      '• اعلان اپ‌های ممنوع همچنان می‌آید؛ فقط باز کردن اپ قفل است.',
      '• اپ ممنوع در پنجره‌ی شناور یا حالت دونیم‌صفحه ممکن است از قفل فرار کند.',
      '• کسی که واقعاً بخواهد، با حذف اپ یا حالت ایمن گوشی قفل را دور می‌زند.',
      '• بعضی گوشی‌ها (مثل شیائومی و هواوی) سرویس‌های پس‌زمینه را می‌بندند؛ راهنمای «قفل کار نمی‌کند» را ببین.',
    ],
  },
};

export function InfoScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Info'>>();
  const page = PAGES[route.params.page];
  return (
    <Screen title={page.title} back>
      <Card>
        {page.paragraphs.map((p, i) => (
          <AppText key={i}>{p}</AppText>
        ))}
      </Card>
    </Screen>
  );
}
