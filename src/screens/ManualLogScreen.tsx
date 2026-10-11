import { useState } from 'react';
import { Alert } from 'react-native';
import { useNav } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { JalaliDatePicker, NumberInput } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Button, Card, Chip, Row } from '../components/ui';
import { addManualLog } from '../db/sessions';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme';
import { formatJalaliDateWithWeekday, startOfDay } from '../utils/jalali';

const MAX_MINUTES = 12 * 60;

/** F19: log study time spent without the phone. Shown in reports with a «دستی» badge. */
export function ManualLogScreen() {
  const nav = useNav();
  const { subjects, settings, bumpData } = useApp();
  const { colors } = useTheme();
  const [subjectId, setSubjectId] = useState<number | null>(
    () => subjects.find(s => String(s.id) === settings.last_subject_id)?.id ?? subjects[0]?.id ?? null,
  );
  const [day, setDay] = useState(startOfDay(Date.now()));
  const [minutes, setMinutes] = useState<number | null>(60);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const valid = subjectId != null && minutes != null && minutes >= 1 && minutes <= MAX_MINUTES;

  const save = async () => {
    if (!valid) return;
    if (day > startOfDay(Date.now())) {
      Alert.alert('تاریخ آینده', 'برای روزهای آینده نمی‌شود ساعت مطالعه ثبت کرد.');
      return;
    }
    setBusy(true);
    await addManualLog(subjectId!, day, minutes!);
    bumpData();
    setBusy(false);
    nav.goBack();
  };

  return (
    <Screen title="ثبت دستی مطالعه" back footer={<Button title="ثبت" size="lg" loading={busy} disabled={!valid} onPress={save} />}>
      <AppText muted>برای وقتی که بدون گوشی درس خواندی، مثلاً در کلاس یا کتابخانه.</AppText>
      <Card>
        <AppText weight="bold">درس</AppText>
        {subjects.length === 0 ? (
          <Button title="افزودن درس" variant="secondary" onPress={() => nav.navigate('Subjects')} />
        ) : (
          <Row style={{ flexWrap: 'wrap' }}>
            {subjects.map(s => (
              <Chip key={s.id} label={s.name} color={s.color} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
            ))}
          </Row>
        )}
      </Card>
      <Card onPress={() => setPicker(true)}>
        <AppText weight="bold">روز</AppText>
        <Row>
          <Icon name="calendar" color={colors.primary} />
          <AppText style={{ flex: 1 }}>{formatJalaliDateWithWeekday(day)}</AppText>
          <Icon name="forward" color={colors.textMuted} />
        </Row>
      </Card>
      <Card>
        <AppText weight="bold">مدت (دقیقه)</AppText>
        <NumberInput value={minutes} onChange={setMinutes} placeholder="دقیقه" maxLength={3} />
      </Card>
      <JalaliDatePicker visible={picker} value={day} onClose={() => setPicker(false)} onPick={setDay} title="روز مطالعه" />
    </Screen>
  );
}
