'use client';

import type { PublicUser } from '@monthloom/contracts';
import { CircleUserRound, Database, Download, House, Palette } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { LogoutButton } from '../../features/auth/logout-button';
import { usePwaInstall } from '../pwa-registration';
import { useTheme } from '../theme-provider';

import { InfoModal } from './info-modal';

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

function useMobileHeader() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 620px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return isMobile;
}

export function Header({ user }: { user: PublicUser | null }) {
  const { mode, toggleMode } = useTheme();
  const { canOfferInstall, installActionLabel, openInstallPrompt } = usePwaInstall();
  const pathname = usePathname();
  const isMobile = useMobileHeader();
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
            src="/brand/monthloom-horizontal-light.png"
            width={1880}
            height={342}
            priority
            alt="Monthloom"
          />
          <Image
            className="brandDark"
            src="/brand/monthloom-horizontal-dark.png"
            width={1852}
            height={342}
            priority
            alt=""
            aria-hidden="true"
          />
        </Link>

        <div className="headerActions">
          <Link
            href="/"
            className="iconButton"
            data-onboarding="home-button"
            aria-label="Home"
            title="Home"
            aria-current={pathname === '/' ? 'page' : undefined}
            onClick={() => setIsOpen(false)}
          >
            <House aria-hidden="true" />
          </Link>
          {!isMobile && pathname === '/' ? <InfoModal /> : null}
          {!isMobile ? (
            <button
              type="button"
              className="iconButton"
              onClick={toggleMode}
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            >
              {mode === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          ) : null}

          {user ? (
            <div className="accountMenu" ref={menuRef}>
              <button
                type="button"
                className="iconButton"
                data-onboarding="settings-menu"
                aria-label="Open account menu"
                aria-expanded={isOpen}
                aria-controls="account-menu"
                onClick={() => setIsOpen((open) => !open)}
              >
                <MenuIcon />
              </button>
              {isOpen ? (
                <div
                  id="account-menu"
                  className="accountMenuPanel"
                  data-onboarding="settings-links"
                >
                  <p className="accountMenuName">{user.displayName}</p>
                  <Link
                    href="/"
                    className="accountMenuItem"
                    aria-current={pathname === '/' ? 'page' : undefined}
                    onClick={() => setIsOpen(false)}
                  >
                    <House aria-hidden="true" />
                    Home
                  </Link>
                  <Link
                    href="/settings/profile"
                    className="accountMenuItem"
                    aria-current={pathname === '/settings/profile' ? 'page' : undefined}
                  >
                    <CircleUserRound aria-hidden="true" />
                    Profile
                  </Link>
                  <Link
                    href="/settings/households"
                    className="accountMenuItem"
                    data-onboarding="household-settings-link"
                    aria-current={pathname === '/settings/households' ? 'page' : undefined}
                  >
                    <House aria-hidden="true" />
                    Households
                  </Link>
                  <Link
                    href="/settings/sources"
                    className="accountMenuItem"
                    aria-current={pathname === '/settings/sources' ? 'page' : undefined}
                  >
                    <Database aria-hidden="true" />
                    Sources
                  </Link>
                  <Link
                    href="/settings/appearance"
                    className="accountMenuItem"
                    aria-current={pathname === '/settings/appearance' ? 'page' : undefined}
                  >
                    <Palette aria-hidden="true" />
                    Appearance
                  </Link>
                  {canOfferInstall ? (
                    <button
                      type="button"
                      className="accountMenuItem"
                      onClick={() => {
                        setIsOpen(false);
                        openInstallPrompt();
                      }}
                    >
                      <Download aria-hidden="true" />
                      {installActionLabel}
                    </button>
                  ) : null}
                  {isMobile && pathname === '/' ? (
                    <InfoModal triggerVariant="menuItem" onClose={() => setIsOpen(false)} />
                  ) : null}
                  {isMobile ? (
                    <button
                      type="button"
                      className="accountMenuItem"
                      onClick={() => {
                        toggleMode();
                        setIsOpen(false);
                      }}
                    >
                      {mode === 'light' ? <MoonIcon /> : <SunIcon />}
                      {mode === 'light' ? 'Dark mode' : 'Light mode'}
                    </button>
                  ) : null}
                  <LogoutButton className="accountMenuItem accountMenuLogout" />
                </div>
              ) : null}
            </div>
          ) : isMobile ? (
            <div className="accountMenu" ref={menuRef}>
              <button
                type="button"
                className="iconButton"
                aria-label="Open navigation menu"
                aria-expanded={isOpen}
                aria-controls="account-menu"
                onClick={() => setIsOpen((open) => !open)}
              >
                <MenuIcon />
              </button>
              {isOpen ? (
                <div id="account-menu" className="accountMenuPanel">
                  {canOfferInstall ? (
                    <button
                      type="button"
                      className="accountMenuItem"
                      onClick={() => {
                        setIsOpen(false);
                        openInstallPrompt();
                      }}
                    >
                      <Download aria-hidden="true" />
                      {installActionLabel}
                    </button>
                  ) : null}
                  <Link href="/login" className="accountMenuItem">
                    Log in
                  </Link>
                  <Link href="/register" className="accountMenuItem">
                    Register
                  </Link>
                  {isMobile && pathname === '/' ? (
                    <InfoModal triggerVariant="menuItem" onClose={() => setIsOpen(false)} />
                  ) : null}
                  {isMobile ? (
                    <button
                      type="button"
                      className="accountMenuItem"
                      onClick={() => {
                        toggleMode();
                        setIsOpen(false);
                      }}
                    >
                      {mode === 'light' ? <MoonIcon /> : <SunIcon />}
                      {mode === 'light' ? 'Dark mode' : 'Light mode'}
                    </button>
                  ) : null}
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
