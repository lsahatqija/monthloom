import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isMobileBrowser,
  PwaRegistration,
  usePwaInstall,
} from '../../src/components/pwa-registration';
import { renderWithQuery } from '../render';

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
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)' ? standalone : false,
  })) as typeof window.matchMedia;
}

describe('PWA installation', () => {
  beforeEach(() => sessionStorage.clear());

  afterEach(() => {
    if (originalUserAgent) Object.defineProperty(window.navigator, 'userAgent', originalUserAgent);
    if (originalPlatform) Object.defineProperty(window.navigator, 'platform', originalPlatform);
    window.matchMedia = originalMatchMedia;
  });

  it('only identifies mobile, non-standalone sessions as mobile browsers', () => {
    setDevice('Mozilla/5.0 (Linux; Android 15; Mobile) Chrome/140.0');
    expect(isMobileBrowser(window.navigator, window)).toBe(true);

    setDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(isMobileBrowser(window.navigator, window)).toBe(false);

    setDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true);
    expect(isMobileBrowser(window.navigator, window)).toBe(false);
  });

  it('shows the floating prompt immediately on mobile and opens the native installer', async () => {
    setDevice('Mozilla/5.0 (Linux; Android 15; Mobile) Chrome/140.0');
    const nativePrompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: nativePrompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    renderWithQuery(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );

    expect(await screen.findByRole('dialog', { name: 'Install Monthloom' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show me how' })).toBeEnabled();
    await act(async () => {
      window.dispatchEvent(installEvent);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() => expect(nativePrompt).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Install from menu' })).not.toBeInTheDocument();
  });

  it('can be cancelled while leaving installation available from the mobile menu', async () => {
    setDevice('Mozilla/5.0 (Linux; Android 15; Mobile) Chrome/140.0');
    const nativePrompt = vi.fn().mockResolvedValue(undefined);
    const installEvent = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: nativePrompt,
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    });

    renderWithQuery(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );

    await screen.findByRole('dialog', { name: 'Install Monthloom' });
    await act(async () => {
      window.dispatchEvent(installEvent);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Install from menu' }));
    await waitFor(() => expect(nativePrompt).toHaveBeenCalledOnce());
  });

  it('shows step-by-step installation instructions on iOS', async () => {
    setDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');

    renderWithQuery(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Show me how' }));
    expect(screen.getByText(/Tap the Share button/)).toBeInTheDocument();
    expect(screen.getByText(/Choose Add to Home Screen/)).toBeInTheDocument();
    expect(screen.getByText(/Turn on Open as Web App/)).toBeInTheDocument();
  });

  it('offers browser-menu instructions when Opera does not expose an installer', async () => {
    setDevice('Mozilla/5.0 (Linux; Android 15; Mobile) OPR/92.0');

    renderWithQuery(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Show me how' }));
    expect(screen.getByText(/Open your browser menu/)).toBeInTheDocument();
    expect(screen.getByText(/Choose Install app or Add to Home screen/)).toBeInTheDocument();
  });

  it('offers an unobtrusive taskbar action on desktop', async () => {
    setDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0');

    renderWithQuery(
      <PwaRegistration>
        <InstallMenuEntry />
      </PwaRegistration>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Keep Monthloom close' });
    expect(dialog).toHaveClass('installPromptDesktop');
    fireEvent.click(screen.getByRole('button', { name: 'Pin to Taskbar' }));
    expect(screen.getByText(/Select Cast, save and share/)).toBeInTheDocument();
    expect(screen.getByText(/Select Install page as app/)).toBeInTheDocument();
    expect(screen.getByText(/right-click its taskbar icon/)).toBeInTheDocument();
  });
});
