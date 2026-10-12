import { useState } from 'react';
import { View } from 'react-native';
import { findOverlap, listBlocks, saveBlock, type BlockInput } from '../db/schedule';
import { useApp } from '../state/AppContext';
import { spacing, useTheme, makeStyles } from '../theme';
import { formatDurationFa, toFaDigits } from '../utils/digits';
import {
  addDays,
  formatJalaliDayMonth,
  formatMinuteOfDay,
  startOfDay,
  weekdayIndex,
  WEEKDAYS,
} from '../utils/jalali';
import { AppText } from './AppText';
import { showAlert } from './Dialog';
import { TimeStepper } from './Pickers';
import { Sheet } from './Sheet';
import { Button, Callout, Chip, Row, Tile } from './ui';

const BREAK_MINUTES = 15;

/**
 * «ماراتن درس ضعیف»: 3–4 days of 4–5 hours on one hard subject, then it's done.
 * Each day gets two one-off blocks with a 15-minute break between; they expire after
 * their day, so the weekly schedule is untouched afterwards.
 */
export function MarathonSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { subjects, settings, setSetting, reloadSchedule } = useApp();
  const { colors } = useTheme();
  const s = useStyles();
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [days, setDays] = useState(4);
  const [hours, setHours] = useState(4);
  const [start, setStart] = useState(9 * 60);
  const [busy, setBusy] = useState(false);

  const half = hours * 30;
  const end = start + hours * 60 + BREAK_MINUTES;
  const fits = end <= 24 * 60;
  const now = Date.now();
  const nowMinute = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  // Today only if the first block hasn't started yet.
  const firstDay = addDays(startOfDay(now), start > nowMinute ? 0 : 1);
  const lastDay = addDays(firstDay, days - 1);
  const subject = subjects.find(x => x.id === subjectId) ?? null;

  const plan = (): BlockInput[] => {
    const out: BlockInput[] = [];
    for (let d = 0; d < days; d++) {
      const day = addDays(firstDay, d);
      const common = {
        weekday: weekdayIndex(day),
        duration_minutes: half,
        subject_id: subjectId,
        mode: 'normal' as const,
        activity: 'study',
        expires_at: addDays(day, 1),
      };
      out.push({ ...common, start_minute: start });
      out.push({ ...common, start_minute: start + half + BREAK_MINUTES });
    }
    return out;
  };

  const create = async () => {
    if (!subject || !fits || busy) return;
    setBusy(true);
    try {
      const existing = await listBlocks();
      const blocks = plan();
      for (const b of blocks) {
        const clash = findOverlap(existing, b);
        if (clash) {
          showAlert(
            'هم‌پوشانی با برنامه',
            `ماراتن با نوبت ${WEEKDAYS[clash.weekday]} ساعت ${formatMinuteOfDay(clash.start_minute)} هم‌پوشانی دارد. ساعت شروع را عوض کن یا آن نوبت را خاموش/حذف کن.`,
          );
          return;
        }
      }
      for (const b of blocks) await saveBlock(b);
      if (settings.schedule_enabled !== '1') await setSetting('schedule_enabled', '1');
      await reloadSchedule();
      onClose();
      showAlert(
        'ماراتن آماده است 🏃',
        `${toFaDigits(days)} روز، هر روز ${toFaDigits(hours)} ساعت «${subject.name}». بعد از ${formatJalaliDayMonth(lastDay)} نوبت‌ها خودشان پاک می‌شوند.`,
        undefined,
        'rocket',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="ماراتن درس ضعیف">
      <AppText variant="caption" muted>
        چند روز پشت سر هم فقط روی یک درس سخت کار کن و پرونده‌اش را ببند. در این روزها درس دیگری
        نخوان؛ بعد کم‌کم بقیه را برگردان.
      </AppText>

      <AppText weight="bold">کدام درس؟</AppText>
      <Row style={s.wrap}>
        {subjects.map(x => (
          <Chip key={x.id} label={x.name} color={x.color} selected={subjectId === x.id} onPress={() => setSubjectId(x.id)} />
        ))}
      </Row>

      <AppText weight="bold">چند روز؟</AppText>
      <Row>
        {[3, 4].map(d => (
          <Tile key={d} value={toFaDigits(d)} label="روز" selected={days === d} onPress={() => setDays(d)} />
        ))}
      </Row>

      <AppText weight="bold">روزی چند ساعت؟</AppText>
      <Row>
        {[4, 5].map(h => (
          <Tile key={h} value={toFaDigits(h)} label="ساعت" tone="strict" selected={hours === h} onPress={() => setHours(h)} />
        ))}
      </Row>

      <AppText weight="bold">ساعت شروع</AppText>
      <TimeStepper value={start} onChange={setStart} />

      {fits ? (
        <Callout
          tone="cyan"
          icon="calendar"
          text={`${formatJalaliDayMonth(firstDay)} تا ${formatJalaliDayMonth(lastDay)} · هر روز ${formatMinuteOfDay(start)} تا ${formatMinuteOfDay(end)}: دو نوبت ${formatDurationFa(half)} با ${toFaDigits(BREAK_MINUTES)} دقیقه استراحت بینشان.`}
        />
      ) : (
        <AppText variant="caption" color={colors.danger}>
          این ساعت شروع از نیمه‌شب رد می‌شود؛ زودتر شروع کن.
        </AppText>
      )}

      <View>
        <Button
          title={subject ? 'ساختن ماراتن' : 'اول درس را انتخاب کن'}
          icon="flame"
          disabled={!subject || !fits}
          loading={busy}
          onPress={create}
        />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { flexWrap: 'wrap', gap: spacing.sm },
}));
