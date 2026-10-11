import { View } from 'react-native';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { Button, Card, Row } from '../components/ui';
import { STRICT_MAX_MINUTES } from '../config';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { formatDurationFa } from '../utils/digits';

/** Shown once before the first strict session (F12). Honest about what it can't do. */
export function StrictIntroScreen() {
  const nav = useNav();
  const { settings, setSetting } = useApp();
  const { colors } = useTheme();
  const lockSettings = settings.block_system_settings_in_strict === '1';

  const locked = [
    'اپ‌های ممنوعی که انتخاب کرده‌ای',
    'دکمه‌ی پایان جلسه (فقط روزی یک خروج اضطراری با ۶۰ ثانیه انتظار)',
    'ویرایش فهرست اپ‌های ممنوع',
    ...(lockSettings ? ['برنامه‌ی تنظیمات گوشی و صفحه‌ی حذف برنامه‌ها'] : []),
  ];
  const open = [
    'تماس تلفنی و تماس اضطراری',
    'پیامک',
    'وای‌فای، اینترنت و صدا از نوار بالای صفحه',
    'اپ‌هایی که در فهرست ممنوع نیستند',
  ];

  return (
    <Screen
      title="حالت سخت"
      back
      footer={
        <Button
          title="متوجه شدم، شروع کن"
          size="lg"
          onPress={async () => {
            await setSetting('strict_intro_seen', '1');
            nav.goBack();
          }}
        />
      }
    >
      <AppText>
        در جلسه‌ی سخت نمی‌توانی جلسه را زودتر تمام کنی. سقف هر جلسه‌ی سخت {formatDurationFa(STRICT_MAX_MINUTES)} است.
      </AppText>
      <Card>
        <AppText weight="bold">چه چیزهایی قفل می‌شود</AppText>
        {locked.map(t => (
          <Row key={t}>
            <Icon name="lock" size={18} color={colors.strict} />
            <AppText style={{ flex: 1 }}>{t}</AppText>
          </Row>
        ))}
      </Card>
      <Card>
        <AppText weight="bold">چه چیزهایی باز می‌ماند</AppText>
        {open.map(t => (
          <Row key={t}>
            <Icon name="check" size={18} color={colors.success} />
            <AppText style={{ flex: 1 }}>{t}</AppText>
          </Row>
        ))}
      </Card>
      <View>
        <AppText variant="caption" muted>
          صادقانه: این قفل صددرصدی نیست. اعلان اپ‌های ممنوع همچنان می‌آید، پنجره‌ی شناور یا حالت دونیم‌صفحه ممکن است
          از قفل فرار کند، و کسی که واقعاً بخواهد با حذف اپ یا حالت ایمن گوشی قفل را دور می‌زند. قفل برای این است که
          کار را سخت کند، نه غیرممکن.
        </AppText>
      </View>
    </Screen>
  );
}
