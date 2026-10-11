import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/app/RootNavigator';
import { AppText } from './src/components/AppText';
import { initDatabase } from './src/db';
import { AppProvider, useApp } from './src/state/AppContext';
import { ThemeProvider, useTheme, type ThemePref } from './src/theme';

function App() {
  const [dbState, setDbState] = useState<'loading' | 'ready' | Error>('loading');

  useEffect(() => {
    initDatabase()
      .then(() => setDbState('ready'))
      .catch(e => setDbState(e instanceof Error ? e : new Error(String(e))));
  }, []);

  return (
    <SafeAreaProvider>
      {dbState === 'ready' ? (
        <AppProvider>
          <Themed />
        </AppProvider>
      ) : (
        <ThemeProvider pref="system">
          <Splash error={dbState === 'loading' ? null : dbState} />
        </ThemeProvider>
      )}
    </SafeAreaProvider>
  );
}

function Themed() {
  const { ready, settings } = useApp();
  return (
    <ThemeProvider pref={(settings.theme as ThemePref) || 'system'}>
      <StatusBarForTheme />
      {ready ? <RootNavigator /> : <Splash error={null} />}
    </ThemeProvider>
  );
}

function StatusBarForTheme() {
  const { dark } = useTheme();
  return <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />;
}

function Splash({ error }: { error: Error | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      {error ? (
        <>
          <AppText weight="bold">خطا در باز کردن پایگاه داده</AppText>
          <AppText muted variant="caption">
            {error.message}
          </AppText>
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
});

export default App;
