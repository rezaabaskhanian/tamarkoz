import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { makeStyles, radius, spacing, useTheme, fonts } from '../theme';
import { pad2Fa, toEnDigits, toFaDigits } from '../utils/digits';
import {
  JALALI_MONTHS,
  jalaliMonthLength,
  jalaliToMs,
  toJalali,
  type JalaliDate,
} from '../utils/jalali';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, Row } from './ui';

/** Jalali date picker in a sheet: year, month and day columns. Returns local midnight (ms). */
export function JalaliDatePicker({
  visible,
  value,
  onClose,
  onPick,
  title = 'انتخاب تاریخ',
  minYear,
  maxYear,
}: {
  visible: boolean;
  value: number | null;
  onClose: () => void;
  onPick: (ms: number) => void;
  title?: string;
  minYear?: number;
  maxYear?: number;
}) {
  const today = toJalali(Date.now());
  const [d, setD] = useState<JalaliDate>(value ? toJalali(value) : today);
  useEffect(() => {
    if (visible) setD(value ? toJalali(value) : toJalali(Date.now()));
  }, [visible, value]);

  const years = useMemo(() => {
    const from = minYear ?? today.jy - 1;
    const to = maxYear ?? today.jy + 2;
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, [minYear, maxYear, today.jy]);
  const days = jalaliMonthLength(d.jy, d.jm);
  const safe = { ...d, jd: Math.min(d.jd, days) };

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Row gap={spacing.sm} style={{ alignItems: 'flex-start' }}>
        <Column
          items={Array.from({ length: days }, (_, i) => i + 1)}
          selected={safe.jd}
          label={v => toFaDigits(v)}
          onSelect={jd => setD({ ...safe, jd })}
        />
        <Column
          items={Array.from({ length: 12 }, (_, i) => i + 1)}
          selected={safe.jm}
          label={v => JALALI_MONTHS[v - 1]}
          onSelect={jm => setD({ ...safe, jm })}
          flex={1.6}
        />
        <Column items={years} selected={safe.jy} label={v => toFaDigits(v)} onSelect={jy => setD({ ...safe, jy })} />
      </Row>
      <Button
        title="تأیید"
        onPress={() => {
          onPick(jalaliToMs(safe));
          onClose();
        }}
      />
    </Sheet>
  );
}

function Column({
  items,
  selected,
  label,
  onSelect,
  flex = 1,
}: {
  items: number[];
  selected: number;
  label: (v: number) => string;
  onSelect: (v: number) => void;
  flex?: number;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const ref = useRef<FlatList<number>>(null);
  const index = Math.max(0, items.indexOf(selected));
  return (
    <FlatList
      ref={ref}
      style={[s.column, { flex }]}
      data={items}
      keyExtractor={v => String(v)}
      initialScrollIndex={Math.max(0, index - 2)}
      getItemLayout={(_, i) => ({ length: 44, offset: 44 * i, index: i })}
      renderItem={({ item }) => {
        const active = item === selected;
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={[s.cell, active && { backgroundColor: colors.primary }]}
          >
            <AppText center weight={active ? 'bold' : 'regular'} color={active ? colors.onPrimary : colors.text}>
              {label(item)}
            </AppText>
          </Pressable>
        );
      }}
    />
  );
}

/** Hour and minute steppers for a minute-of-day value (0–1439). */
export function TimeStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const h = Math.floor(value / 60);
  const m = value % 60;
  const set = (hh: number, mm: number) => onChange((((hh + 24) % 24) * 60) + ((mm + 60) % 60));
  return (
    <Row gap={spacing.md} style={{ justifyContent: 'center' }}>
      <Stepper label="دقیقه" value={pad2Fa(m)} onUp={() => set(h, m + 5 - (m % 5))} onDown={() => set(h, m % 5 ? m - (m % 5) : m - 5)} />
      <AppText variant="title">:</AppText>
      <Stepper label="ساعت" value={pad2Fa(h)} onUp={() => set(h + 1, m)} onDown={() => set(h - 1, m)} />
    </Row>
  );
}

function Stepper({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.stepper}>
      <Pressable onPress={onUp} hitSlop={8} style={s.stepBtn} accessibilityLabel={`${label} بیشتر`}>
        <Icon name="up" color={colors.primary} />
      </Pressable>
      <AppText variant="title">{value}</AppText>
      <Pressable onPress={onDown} hitSlop={8} style={s.stepBtn} accessibilityLabel={`${label} کمتر`}>
        <Icon name="down" color={colors.primary} />
      </Pressable>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

/** Numeric input that accepts Persian or Latin digits and shows Persian ones. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  maxLength = 4,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <TextInput
      style={[s.input, { color: colors.text }]}
      keyboardType="number-pad"
      value={value == null ? '' : toFaDigits(value)}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      maxLength={maxLength}
      onChangeText={t => {
        const n = parseInt(toEnDigits(t).replace(/\D/g, ''), 10);
        onChange(Number.isNaN(n) ? null : n);
      }}
    />
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <TextInput
      style={[s.input, { color: colors.text }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      autoFocus={autoFocus}
      maxLength={40}
    />
  );
}

const useStyles = makeStyles(c => ({
  column: {
    height: 220,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  cell: { height: 44, justifyContent: 'center', borderRadius: radius.sm, marginHorizontal: 4 },
  stepper: { alignItems: 'center', gap: 2 },
  stepBtn: {
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: c.primarySoft,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontFamily: fonts.regular,
    fontSize: 16,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
}));
