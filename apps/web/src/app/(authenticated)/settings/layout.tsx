import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SettingsNavigation } from '@/components/settings-navigation';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="settingsPage">
      <header className="settingsHeader">
        <h1>Settings</h1>
        <p>Manage your account and household preferences.</p>
      </header>
      <div className="settingsLayout">
        <SettingsNavigation />
        <div className="settingsContent">{children}</div>
      </div>
    </div>
  );
}
