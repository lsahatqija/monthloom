'use client';

import type { PublicUser } from '@template/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { LogoutButton } from '../../features/auth/logout-button';
import { useTheme } from '../theme-provider';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.3A8.4 8.4 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.95 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.4.5.94 1.52 1H21v4h-.08a1.7 1.7 0 0 0-1.52 1Z" />
    </svg>
  );
}

export function Header({ user }: { user: PublicUser | null }) {
  const { mode, toggleMode } = useTheme();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setIsOpen(false), [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <header className="header">
      <div className="headerInner">
        <Link href="/" className="brand" aria-label="Monthloom home">
          <Image
            className="brandLight"
            src="/brand/monthloom-light.png"
            width={512}
            height={122}
            priority
            alt="Monthloom"
          />
          <Image
            className="brandDark"
            src="/brand/monthloom-dark.png"
            width={512}
            height={122}
            priority
            alt=""
            aria-hidden="true"
          />
        </Link>

        <div className="headerActions">
          <button
            type="button"
            className="iconButton"
            onClick={toggleMode}
            aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          >
            {mode === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>

          {user ? (
            <div className="accountMenu" ref={menuRef}>
              <button
                type="button"
                className="iconButton"
                aria-label="Open account menu"
                aria-expanded={isOpen}
                aria-controls="account-menu"
                onClick={() => setIsOpen((open) => !open)}
              >
                <MenuIcon />
              </button>
              {isOpen ? (
                <div id="account-menu" className="accountMenuPanel">
                  <p className="accountMenuName">{user.displayName}</p>
                  <Link
                    href="/settings"
                    className="accountMenuItem"
                    aria-current={pathname === '/settings' ? 'page' : undefined}
                  >
                    <SettingsIcon />
                    Settings
                  </Link>
                  <LogoutButton className="accountMenuItem" />
                </div>
              ) : null}
            </div>
          ) : (
            <nav className="publicNav" aria-label="Account">
              <Link href="/login">Log in</Link>
              <Link href="/register" className="publicNavPrimary">
                Register
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
