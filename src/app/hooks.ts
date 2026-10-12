import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useApp } from '../state/AppContext';
import { useNav, type PurchaseReason } from './RootNavigator';
import { showAlert } from '../components/Dialog';

/**
 * Opens the purchase screen — except during an active session: the purchase screen
 * never opens mid-session or over the lock screen (F15).
 */
export function usePaywall() {
  const nav = useNav();
  const { active } = useApp();
  return useCallback(
    (reason: PurchaseReason) => {
      if (active) {
        showAlert('بعد از جلسه', 'این بخش در نسخه‌ی کامل است. بعد از پایان جلسه می‌توانی آن را ببینی.');
        return;
      }
      nav.navigate('Purchase', { reason });
    },
    [active, nav],
  );
}

/** Re-runs `load` whenever study data changes (sessions added, day changed…). */
export function useDataQuery<T>(load: () => Promise<T>, deps: unknown[] = []): T | null {
  const { dataVersion } = useApp();
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then(d => alive && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, ...deps]);
  return data;
}

/** Ticks every `ms` while mounted; returns Date.now(). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** While the screen is focused and a session runs, re-reads it from native every second. */
export function useLiveSession() {
  const { active, refreshActive } = useApp();
  const running = Boolean(active);
  useFocusEffect(
    useCallback(() => {
      if (!running) return;
      const t = setInterval(() => {
        refreshActive().catch(() => {});
      }, 1000);
      return () => clearInterval(t);
    }, [running, refreshActive]),
  );
  return active;
}
