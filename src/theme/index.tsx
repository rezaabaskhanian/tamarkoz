import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

// Palette from the "Focused Maturity" design system (memory/ui/focused_maturity/DESIGN.md).
const light = {
  background: '#F7F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F1FB', // soft lavender sections inside cards
  text: '#1C2033',
  textMuted: '#6B7086',
  primary: '#3E5BDB',
  primaryDeep: '#1F40C2', // selected chips / tiles
  primarySoft: '#E8EBFD',
  onPrimary: '#FFFFFF',
  border: '#ECEDF5',
  danger: '#D93B3B',
  dangerSoft: '#FCE8E8',
  success: '#1F9D63',
  successSoft: '#E2F5EC',
  warning: '#C9831B',
  warningSoft: '#FBF0DD',
  strict: '#7A4FD6',
  strictSoft: '#F1EAFE',
  overlay: 'rgba(15, 18, 34, 0.45)',
  shadow: '0 4px 20px -2px rgba(62, 91, 219, 0.06), 0 2px 6px -1px rgba(28, 32, 51, 0.03)',
};

export type Colors = typeof light;

const dark: Colors = {
  background: '#0E1222',
  surface: '#171C30',
  surfaceAlt: '#20263D',
  text: '#F1F3FB',
  textMuted: '#9297AC',
  primary: '#7189F0',
  primaryDeep: '#7189F0',
  primarySoft: '#232C52',
  onPrimary: '#0E1222',
  border: '#2A3150',
  danger: '#F06A6A',
  dangerSoft: '#3A1E24',
  success: '#3CCB8A',
  successSoft: '#163327',
  warning: '#E8B04F',
  warningSoft: '#3A2E17',
  strict: '#A585F0',
  strictSoft: '#2A2147',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: 'none', // dark mode separates surfaces by tone, not shadow
};

// Android loads these by file name from android/app/src/main/assets/fonts.
export const fonts = {
  regular: 'Vazirmatn-Regular',
  medium: 'Vazirmatn-Medium',
  bold: 'Vazirmatn-Bold',
};

export const spacing = { xs: 4, sm: 8, md: 16, card: 20, lg: 24, xl: 32 };
export const radius = { sm: 8, chip: 12, md: 16, lg: 22, pill: 999 };

export type ThemePref = 'system' | 'light' | 'dark';
type Theme = { colors: Colors; dark: boolean };

const ThemeContext = createContext<Theme>({ colors: light, dark: false });

export function ThemeProvider({ pref, children }: { pref: ThemePref; children: ReactNode }) {
  const system = useColorScheme();
  const isDark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo(() => ({ colors: isDark ? dark : light, dark: isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Theme-aware StyleSheet: `const useStyles = makeStyles(c => ({ ... }))`. */
// The record constraint gives literal values a contextual type, so 'row' stays 'row'.
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;
export function makeStyles<T extends NamedStyles>(fn: (c: Colors) => T) {
  return () => {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(fn(colors)), [colors]);
  };
}
