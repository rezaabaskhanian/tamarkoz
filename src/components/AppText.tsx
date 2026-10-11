import { StyleSheet, Text, type TextProps } from 'react-native';
import { fonts, useTheme } from '../theme';

type Props = TextProps & {
  weight?: keyof typeof fonts;
  variant?: 'display' | 'title' | 'subtitle' | 'body' | 'caption';
  muted?: boolean;
  color?: string;
  center?: boolean;
};

/** Every visible text in the app goes through this so the Persian font and RTL alignment stay consistent. */
export function AppText({ weight, variant = 'body', muted, color, center, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        styles[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        weight && { fontFamily: fonts[weight] },
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: fonts.regular,
    textAlign: 'left', // "left" is the start side, i.e. right, under forced RTL
    writingDirection: 'rtl',
  },
  display: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 56 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 36 },
  subtitle: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 28 },
  body: { fontSize: 15, lineHeight: 26 },
  caption: { fontSize: 13, lineHeight: 21 },
  center: { textAlign: 'center' },
});
