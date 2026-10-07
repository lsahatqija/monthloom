import type { Metadata } from 'next';

import { ThemePicker } from '@/components/theme-picker';

export const metadata: Metadata = { title: 'Appearance settings' };

export default function AppearanceSettingsPage() {
  return (
    <section className="settingsView" aria-labelledby="appearance-settings-heading">
      <div className="settingsViewHeading">
        <h2 id="appearance-settings-heading">Appearance</h2>
        <p>Choose how Monthloom looks on this device.</p>
      </div>
      <div className="settingsPanel">
        <ThemePicker />
      </div>
    </section>
  );
}
