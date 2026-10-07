'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SETTINGS_LINKS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/appearance', label: 'Appearance' },
  { href: '/settings/households', label: 'Households' },
  { href: '/settings/sources', label: 'Sources' },
] as const;

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav className="settingsNavigation" aria-label="Settings">
      {SETTINGS_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
