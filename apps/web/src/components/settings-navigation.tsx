'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const SETTINGS_LINKS = [
  { href: '/settings/profile', key: 'profile' },
  { href: '/settings/households', key: 'households' },
  { href: '/settings/sources', key: 'sources' },
  { href: '/settings/appearance', key: 'appearance' },
] as const;

export function SettingsNavigation() {
  const t = useTranslations('Shell');
  const pathname = usePathname();

  return (
    <nav className="settingsNavigation" aria-label={t('settings')}>
      {SETTINGS_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {t(link.key)}
        </Link>
      ))}
    </nav>
  );
}
