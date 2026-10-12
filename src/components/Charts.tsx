import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { makeStyles, radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { SubjectDot } from './ui';
import { formatHMFa, toFaDigits } from '../utils/digits';

/** Circular progress (0–1) with content in the middle. */
export function ProgressRing({
  progress,
  size = 240,
  stroke = 14,
  color,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - p)}
          // start at 12 o'clock
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Vertical bars, first item on the right (RTL). Values in seconds. */
export function BarChart({
  values,
  labels,
  highlight,
  height = 140,
}: {
  values: number[];
  labels: string[];
  highlight?: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const max = Math.max(...values, 1);
  return (
    <View style={s.chart}>
      {values.map((v, i) => (
        <View key={i} style={s.barCol}>
          <View style={[s.barTrack, { height }]}>
            <View
              style={[
                s.bar,
                {
                  height: Math.max(v > 0 ? 4 : 0, (v / max) * height),
                  backgroundColor: i === highlight ? colors.accent : colors.accentSoft,
                },
              ]}
            />
          </View>
          <AppText variant="caption" muted center numberOfLines={1}>
            {labels[i]}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Horizontal share bars per subject. */
export function SubjectBars({
  items,
}: {
  items: { subjectId: number; name: string; color: string; seconds: number }[];
}) {
  const s = useStyles();
  const total = items.reduce((a, b) => a + b.seconds, 0) || 1;
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map(it => (
        <View key={it.subjectId} style={{ gap: 4 }}>
          <View style={s.subjectRow}>
            <SubjectDot color={it.color} />
            <AppText weight="medium" style={{ flex: 1 }}>
              {it.name}
            </AppText>
            <AppText variant="caption" weight="bold">
              {formatHMFa(Math.round(it.seconds / 60))} ساعت
            </AppText>
            <AppText variant="caption" muted style={{ minWidth: 34, textAlign: 'right' }}>
              {toFaDigits(Math.round((it.seconds / total) * 100))}٪
            </AppText>
          </View>
          <View style={s.shareTrack}>
            <View style={[s.share, { width: `${(it.seconds / total) * 100}%`, backgroundColor: it.color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'stretch', gap: 4 },
  barTrack: { justifyContent: 'flex-end' },
  bar: { borderRadius: radius.sm, width: '100%' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shareTrack: { height: 8, borderRadius: 4, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
  share: { height: 8, borderRadius: 4 },
}));
