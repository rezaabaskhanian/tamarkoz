import { getDb, query, run } from '.';

export type BlockedApp = { package_name: string; label: string; added_at: number };

export function listBlockedApps() {
  return query<BlockedApp>('SELECT * FROM blocked_apps ORDER BY added_at, package_name');
}

/** Replaces the whole list, keeping the original added_at of apps that stay. */
export async function setBlockedApps(apps: { packageName: string; label: string }[]) {
  const now = Date.now();
  await getDb().transaction(async tx => {
    const keep = apps.map(a => a.packageName);
    if (keep.length === 0) {
      await tx.execute('DELETE FROM blocked_apps');
    } else {
      await tx.execute(
        `DELETE FROM blocked_apps WHERE package_name NOT IN (${keep.map(() => '?').join(',')})`,
        keep,
      );
    }
    for (let i = 0; i < apps.length; i++) {
      await tx.execute(
        'INSERT OR IGNORE INTO blocked_apps (package_name, label, added_at) VALUES (?, ?, ?)',
        [apps[i].packageName, apps[i].label, now + i],
      );
    }
  });
}

export async function removeBlockedApp(packageName: string) {
  await run('DELETE FROM blocked_apps WHERE package_name = ?', [packageName]);
}
