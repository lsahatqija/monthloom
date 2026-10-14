import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isMobileBrowser,
  PwaRegistration,
  usePwaInstall,
} from '../../src/components/pwa-registration';

function InstallMenuEntry() {
  const { canOfferInstall, openInstallPrompt } = usePwaInstall();

  return canOfferInstall ? <button onClick={openInstallPrompt}>Install from menu</button> : null;
}

const originalUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
const originalPlatform = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
const originalMatchMedia = window.matchMedia;

function setDevice(userAgent: string, standalone = false) {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: userAgent });
  Object.defineProperty(window.navigator, 'platform', { configurable: true, value: '' });
  window.matchMedia = vi.fn().mockReturnValue({ matches: standalone }) as typeof window.matchMedia;
}

describe('PWA installation', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    if (originalUserAgent) Object.defineProperty(window.navigator, 'userAgent', originalUserAgent);
    if (originalPlatform) Object.defineProperty(window.navigator, 'platform', originalPlatform);
    window.matchMedia = originalMatchMedia;
  });

  it('only identifies mobile, non-standalone sessions as mobile browsers', () => {
    setDevice('Mozilla/5.0 (Linux; Android 15; Mobile)');
    expect(isMobileBrowser(window.navigator, window)).toBe(true);

    setDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(isMobileBrowser(window.navigator, window)).toBe(false);

    setDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true);
    expect(isMobileBrowser(window.navigator, window)).toBe(false);
  });

  it('offers the native install prompt and keeps a menu entry after dismissal', async () => {
    setDevice('Mozilla/5.0 (Linux; Android 15; Mobile)');
    const nativePrompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: nativePrompt,
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });

    render(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );
    window.dispatchEvent(installEvent);

    expect(await screen.findByRole('dialog', { name: 'Install Monthloom' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(nativePrompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Install from menu' })).toBeInTheDocument();
  });

  it('shows Add to Home Screen instructions on iOS', async () => {
    setDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');

    render(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );

    expect(await screen.findByText(/Tap the Share button.*Add to Home Screen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Install from menu' })).toBeInTheDocument();
  });
});
