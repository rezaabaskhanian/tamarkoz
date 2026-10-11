import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { makeStyles, radius, spacing, useTheme, type Colors } from '../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

// Small shared building blocks (design: memory/ui/focused_maturity/DESIGN.md).
// Keep screens free of one-off button/card styling.

/** "#RRGGBB" + alpha (0–1) → "#RRGGBBAA". */
export function alpha(hex: string, a: number) {
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
}

export type Tone = 'primary' | 'strict' | 'success' | 'danger' | 'warning' | 'neutral';

function toneColors(c: Colors, tone: Tone) {
  return {
    primary: { bg: c.primarySoft, fg: c.primary },
    strict: { bg: c.strictSoft, fg: c.strict },
    success: { bg: c.successSoft, fg: c.success },
    danger: { bg: c.dangerSoft, fg: c.danger },
    warning: { bg: c.warningSoft, fg: c.warning },
    neutral: { bg: c.surfaceAlt, fg: c.textMuted },
  }[tone];
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'strict';
  size?: 'md' | 'lg' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const s = useStyles();
  const bg = {
    primary: colors.primary,
    secondary: colors.primarySoft,
    ghost: 'transparent',
    danger: colors.dangerSoft,
    strict: colors.strict,
  }[variant];
  const fg = {
    primary: colors.onPrimary,
    secondary: colors.primary,
    ghost: colors.primary,
    danger: colors.danger,
    strict: '#FFFFFF',
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        size === 'lg' && s.buttonLg,
        size === 'sm' && s.buttonSm,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        pressed && s.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} color={fg} />}
          {title ? (
            <AppText
              weight="bold"
              color={fg}
              variant={size === 'lg' ? 'subtitle' : size === 'sm' ? 'caption' : 'body'}
            >
              {title}
            </AppText>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** Round icon-only button (e.g. delete next to save). */
export function IconButton({
  icon,
  onPress,
  tone = 'primary',
  label,
  size = 48,
}: {
  icon: IconName;
  onPress: () => void;
  tone?: Tone;
  label: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { transform: [{ scale: 0.94 }] },
      ]}
    >
      <Icon name={icon} size={size * 0.45} color={t.fg} />
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** surface = white card; tint = lavender section; strict = pale purple. */
  tone?: 'surface' | 'tint' | 'strict';
}) {
  const s = useStyles();
  const toneStyle = tone === 'tint' ? s.cardTint : tone === 'strict' ? s.cardStrict : null;
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.card, toneStyle, pressed && s.pressedCard, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, toneStyle, style]}>{children}</View>;
}

export function Row({
  children,
  style,
  gap = spacing.sm,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** Card header: optional icon badge, bold title, optional element on the far side. */
export function CardTitle({
  title,
  icon,
  tone = 'primary',
  right,
  subtitle,
}: {
  title: string;
  icon?: IconName;
  tone?: Tone;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <Row>
      {icon && <IconBadge name={icon} tone={tone} size={34} />}
      <View style={{ flex: 1 }}>
        <AppText weight="bold">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </Row>
  );
}

export function ListItem({
  title,
  subtitle,
  onPress,
  right,
  left,
  icon,
  danger,
  disabled,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  left?: ReactNode;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      style={({ pressed }) => [s.listItem, (pressed || disabled) && { opacity: disabled ? 0.45 : 0.7 }]}
    >
      {icon ? <IconBadge name={icon} tone={danger ? 'danger' : 'primary'} size={36} /> : left}
      <View style={s.flex}>
        <AppText weight="medium" color={danger ? colors.danger : undefined}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="forward" size={20} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function ToggleItem({
  title,
  subtitle,
  value,
  onChange,
  disabled,
  icon,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      icon={icon}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.surface}
        />
      }
    />
  );
}

export function Divider() {
  const s = useStyles();
  return <View style={s.divider} />;
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText weight="bold" muted variant="caption" style={{ marginTop: spacing.sm, paddingHorizontal: 4 }}>
      {children}
    </AppText>
  );
}

/**
 * Chip. With `color` it's a subject chip: tinted with the subject's color.
 * Selected chips turn solid deep blue with a check mark.
 */
export function Chip({
  label,
  selected,
  onPress,
  color,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const fg = selected ? '#FFFFFF' : color ?? colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        s.chip,
        color && { backgroundColor: alpha(color, 0.1), borderColor: 'transparent' },
        selected && { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
        disabled && { opacity: 0.4 },
        pressed && s.pressed,
      ]}
    >
      {selected ? (
        <Icon name="check" size={16} color="#FFFFFF" />
      ) : color ? (
        <View style={[s.dot, { backgroundColor: color }]} />
      ) : null}
      <AppText variant="caption" weight="medium" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Selectable grid tile: big value over a small label (durations, weekdays). */
export function Tile({
  value,
  label,
  selected,
  onPress,
  disabled,
  tone = 'primary',
  compact,
  a11yLabel,
}: {
  value: string;
  label?: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'strict';
  /** Equal-width tile for a single row (e.g. seven weekdays). */
  compact?: boolean;
  a11yLabel?: string;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const active = tone === 'strict' ? colors.strict : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={a11yLabel}
      style={({ pressed }) => [
        s.tile,
        compact && s.tileCompact,
        selected && { backgroundColor: active },
        disabled && { opacity: 0.35 },
        pressed && s.pressed,
      ]}
    >
      <AppText weight="bold" variant="subtitle" center color={selected ? '#FFFFFF' : colors.text}>
        {value}
      </AppText>
      {label ? (
        <AppText variant="caption" center color={selected ? '#FFFFFF' : colors.textMuted}>
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** Two-option card choice for normal vs. strict mode. */
export function ModeCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  strict,
  badge,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  strict?: boolean;
  badge?: ReactNode;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const bg = selected ? (strict ? colors.strict : colors.primary) : 'transparent';
  const fg = selected ? '#FFFFFF' : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.mode, { backgroundColor: bg }, pressed && s.pressed]}
    >
      <Row gap={6}>
        <Icon name={icon} size={18} color={fg} />
        <AppText weight="bold" color={fg}>
          {title}
        </AppText>
        {badge}
      </Row>
      <AppText variant="caption" color={selected ? 'rgba(255,255,255,0.85)' : colors.textMuted}>
        {subtitle}
      </AppText>
    </Pressable>
  );
}

/** Small rounded label, optionally with an icon or a colored dot. */
export function Pill({
  label,
  tone = 'neutral',
  icon,
  dot,
  solid,
}: {
  label: string;
  tone?: Tone;
  icon?: IconName;
  dot?: string;
  solid?: boolean;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const t = toneColors(colors, tone);
  const fg = solid ? '#FFFFFF' : t.fg;
  return (
    <View style={[s.pill, { backgroundColor: solid ? t.fg : t.bg }]}>
      {icon && <Icon name={icon} size={14} color={fg} />}
      {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
      <AppText variant="caption" weight="medium" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

/** Icon on a rounded-square tinted background. */
export function IconBadge({ name, tone = 'primary', size = 40 }: { name: IconName; tone?: Tone; size?: number }) {
  const { colors } = useTheme();
  const t = toneColors(colors, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={name} size={size * 0.5} color={t.fg} />
    </View>
  );
}

/** − value + */
export function Stepper({
  value,
  label,
  onMinus,
  onPlus,
}: {
  value: string;
  label?: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const s = useStyles();
  return (
    <View style={s.stepper}>
      <IconButton icon="add" label="بیشتر" onPress={onPlus} tone="primary" size={44} />
      <View style={{ alignItems: 'center', minWidth: 80 }}>
        <AppText variant="title" center>
          {value}
        </AppText>
        {label ? (
          <AppText variant="caption" muted center>
            {label}
          </AppText>
        ) : null}
      </View>
      <IconButton icon="minus" label="کمتر" onPress={onMinus} tone="neutral" size={44} />
    </View>
  );
}

/** Tinted explanatory box with an icon. */
export function Callout({ text, icon = 'sparkle', tone = 'primary' }: { text: string; icon?: IconName; tone?: Tone }) {
  const { colors } = useTheme();
  const s = useStyles();
  const t = toneColors(colors, tone);
  return (
    <View style={[s.callout, { backgroundColor: t.bg }]}>
      <Icon name={icon} size={18} color={t.fg} />
      <AppText variant="caption" color={t.fg} style={s.flex}>
        {text}
      </AppText>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: ReactNode; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.segmented}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityState={{ selected: active }}
            style={[s.segment, active && s.segmentActive]}
          >
            {o.icon && <Icon name={o.icon} size={16} color={active ? colors.primary : colors.textMuted} />}
            <AppText
              variant="caption"
              weight={active ? 'bold' : 'medium'}
              color={active ? colors.primary : colors.textMuted}
            >
              {o.label}
            </AppText>
            {o.badge}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Banner({
  text,
  action,
  onPress,
  tone = 'danger',
}: {
  text: string;
  action?: string;
  onPress?: () => void;
  tone?: 'danger' | 'warning' | 'info';
}) {
  const { colors } = useTheme();
  const s = useStyles();
  const t = toneColors(colors, tone === 'info' ? 'primary' : tone);
  return (
    <Pressable onPress={onPress} style={[s.banner, { backgroundColor: t.bg }]}>
      <Icon name="warning" size={20} color={t.fg} />
      <AppText style={s.flex} color={t.fg} weight="medium" variant="caption">
        {text}
      </AppText>
      {action ? (
        <View style={[s.bannerAction, { backgroundColor: t.fg }]}>
          <AppText variant="caption" weight="bold" color="#FFFFFF">
            {action}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function PremiumBadge() {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={s.badge}>
      <Icon name="star" size={12} color={colors.warning} />
      <AppText variant="caption" weight="bold" color={colors.warning}>
        ویژه
      </AppText>
    </View>
  );
}

export function SubjectDot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

const useStyles = makeStyles(c => ({
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.96 }] },
  pressedCard: { transform: [{ scale: 0.98 }] },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonLg: { minHeight: 58 },
  buttonSm: { minHeight: 38, paddingHorizontal: spacing.md },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: spacing.sm + 4,
    boxShadow: c.shadow,
  },
  cardTint: { backgroundColor: c.surfaceAlt, borderColor: 'transparent', boxShadow: 'none' },
  cardStrict: { backgroundColor: c.strictSoft, borderColor: 'transparent', boxShadow: 'none' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 52,
  },
  divider: { height: 1, backgroundColor: c.border },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 36,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  tileCompact: { flexBasis: 0, minHeight: 52, backgroundColor: 'transparent' },
  mode: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: c.surface, boxShadow: c.shadow },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerAction: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: c.warningSoft,
  },
}));
