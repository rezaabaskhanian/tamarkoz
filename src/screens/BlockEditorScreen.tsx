import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNav, type RootStackParamList } from '../app/RootNavigator';
import { AppText } from '../components/AppText';
import { NumberInput, TimeStepper } from '../components/Pickers';
import { Screen } from '../components/Screen';
import { Button, Card, CardTitle, Chip, IconButton, ModeCard, Row, Tile } from '../components/ui';
import { MAX_SESSION_MINUTES, MIN_SESSION_MINUTES, STRICT_MAX_MINUTES } from '../config';
import { deleteBlock, findOverlap, listBlocks, saveBlock, type ScheduleBlock } from '../db/schedule';
import { useApp } from '../state/AppContext';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import { formatMinuteOfDay, WEEKDAYS } from '../utils/jalali';

const DURATIONS = [45, 60, 90, 120, 180];
const SHORT_DAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function BlockEditorScreen() {
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'BlockEditor'>>();
  const blockId = route.params?.blockId;
  const { subjects, reloadSchedule } = useApp();
  const { colors } = useTheme();
  const st = useStyles();

  const [days, setDays] = useState<number[]>(route.params?.weekday != null ? [route.params.weekday] : []);
  const [start, setStart] = useState(16 * 60);
  const [duration, setDuration] = useState<number | null>(90);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [mode, setMode] = useState<'normal' | 'strict'>('normal');
  const [all, setAll] = useState<ScheduleBlock[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listBlocks().then(list => {
      setAll(list);
      const b = list.find(x => x.id === blockId);
      if (b) {
        setDays([b.weekday]);
        setStart(b.start_minute);
        setDuration(b.duration_minutes);
        setSubjectId(b.subject_id);
        setMode(b.mode);
      }
    });
  }, [blockId]);

  const max = mode === 'strict' ? STRICT_MAX_MINUTES : MAX_SESSION_MINUTES;
  const validDuration = duration != null && duration >= MIN_SESSION_MINUTES && duration <= max;

  const save = async () => {
    if (!validDuration || days.length === 0) return;
    // Blocks may not overlap — check every selected day before saving anything.
    for (const w of days) {
      const clash = findOverlap(all, { weekday: w, start_minute: start, duration_minutes: duration! }, blockId);
      if (clash) {
        Alert.alert(
          'هم‌پوشانی',
          `این نوبت با نوبت ${WEEKDAYS[clash.weekday]} ساعت ${formatMinuteOfDay(clash.start_minute)} هم‌پوشانی دارد.`,
        );
        return;
      }
    }
    setBusy(true);
    try {
      for (const w of days) {
        await saveBlock(
          { weekday: w, start_minute: start, duration_minutes: duration!, subject_id: subjectId, mode },
          blockId,
        );
      }
      await reloadSchedule();
      nav.goBack();
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!blockId) return;
    Alert.alert('حذف نوبت؟', 'جلسه‌های گذشته در گزارش می‌مانند.', [
      { text: 'نه', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deleteBlock(blockId);
          await reloadSchedule();
          nav.goBack();
        },
      },
    ]);
  };

  return (
    <Screen
      title={blockId ? 'ویرایش نوبت' : 'تنظیم نوبت مطالعه'}
      back
      footer={
        <Row>
          <Button
            title="ذخیره‌ی نوبت در برنامه"
            icon="check"
            size="lg"
            style={{ flex: 1 }}
            loading={busy}
            disabled={!validDuration || days.length === 0}
            onPress={save}
          />
          {blockId ? <IconButton icon="delete" tone="danger" label="حذف نوبت" onPress={remove} size={56} /> : null}
        </Row>
      }
    >
      <View style={st.section}>
        <CardTitle
          title="درس هدف"
          icon="book"
          right={
            <AppText variant="caption" muted>
              اختیاری
            </AppText>
          }
        />
        <Row style={st.wrap}>
          <Chip label="بدون درس" selected={subjectId == null} onPress={() => setSubjectId(null)} />
          {subjects.map(s => (
            <Chip key={s.id} label={s.name} color={s.color} selected={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
          ))}
        </Row>
        {subjectId == null && (
          <AppText variant="caption" muted>
            جلسه با آخرین درسی که خواندی ثبت می‌شود.
          </AppText>
        )}
      </View>

      <View style={st.section}>
        <CardTitle
          title={blockId ? 'روز مطالعه' : 'روزهای مطالعه در هفته'}
          icon="calendar"
          right={
            days.length > 0 ? (
              <AppText variant="caption" weight="bold" color={colors.primary}>
                {toFaDigits(days.length)} روز انتخاب شد
              </AppText>
            ) : undefined
          }
        />
        <View style={st.days}>
          {WEEKDAYS.map((d, w) => (
            <Tile
              key={d}
              value={SHORT_DAYS[w]}
              compact
              a11yLabel={d}
              selected={days.includes(w)}
              onPress={() =>
                setDays(cur => (blockId ? [w] : cur.includes(w) ? cur.filter(x => x !== w) : [...cur, w].sort()))
              }
            />
          ))}
        </View>
      </View>

      <Card tone="tint">
        <CardTitle title="زمان شروع نوبت" icon="clock" />
        <TimeStepper value={start} onChange={setStart} />
      </Card>

      <Card tone="tint">
        <CardTitle
          title="مدت زمان"
          icon="timer"
          right={
            validDuration ? (
              <AppText variant="caption" weight="bold" color={colors.primary}>
                {formatDurationFa(duration!)}
              </AppText>
            ) : undefined
          }
        />
        <View style={st.grid}>
          {DURATIONS.map(m => (
            <Tile
              key={m}
              value={toFaDigits(m)}
              label="دقیقه"
              selected={duration === m}
              disabled={m > max}
              onPress={() => setDuration(m)}
            />
          ))}
        </View>
        <NumberInput value={duration} onChange={setDuration} placeholder="دلخواه (دقیقه)" maxLength={3} />
        <AppText variant="caption" color={validDuration ? colors.textMuted : colors.danger}>
          بین {toFaDigits(MIN_SESSION_MINUTES)} و {toFaDigits(max)} دقیقه
        </AppText>
      </Card>

      <View style={st.section}>
        <CardTitle title="سطح انضباط نوبت" icon="shield" />
        <View style={st.modes}>
          <ModeCard
            title="حالت عادی"
            subtitle="امکان پایان زودهنگام"
            icon="shield"
            selected={mode === 'normal'}
            onPress={() => setMode('normal')}
          />
          <ModeCard
            title="حالت سخت"
            subtitle="بدون دکمه‌ی پایان"
            icon="lock"
            strict
            selected={mode === 'strict'}
            onPress={() => setMode('strict')}
          />
        </View>
      </View>

      <AppText variant="caption" muted center>
        پنج دقیقه قبل از شروع اعلان می‌آید و می‌توانی آن نوبت را رد کنی.
      </AppText>
    </Screen>
  );
}

const useStyles = makeStyles(c => ({
  section: { gap: spacing.sm + 4 },
  wrap: { flexWrap: 'wrap' },
  days: { flexDirection: 'row', gap: 4, backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modes: { flexDirection: 'row', gap: 6, backgroundColor: c.surfaceAlt, borderRadius: radius.lg, padding: 6 },
}));
