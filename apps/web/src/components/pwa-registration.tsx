'use client';

import Image from 'next/image';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const PROMPT_DISMISSED_KEY = 'monthloom-install-prompt-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithInstallState extends Navigator {
  standalone?: boolean;
  userAgentData?: { mobile?: boolean };
}

interface PwaInstallContextValue {
  canOfferInstall: boolean;
  openInstallPrompt: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canOfferInstall: false,
  openInstallPrompt: () => undefined,
});

export function isMobileBrowser(navigatorValue: Navigator, windowValue: Window) {
  const extendedNavigator = navigatorValue as NavigatorWithInstallState;
  const narrowTouchDevice =
    navigatorValue.maxTouchPoints > 0 && windowValue.matchMedia?.('(max-width: 768px)').matches;
  const isMobileDevice =
    extendedNavigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigatorValue.userAgent) ||
    (navigatorValue.platform === 'MacIntel' && navigatorValue.maxTouchPoints > 1) ||
    narrowTouchDevice;
  const isStandalone =
    windowValue.matchMedia?.('(display-mode: standalone)').matches ||
    extendedNavigator.standalone === true;

  return isMobileDevice && !isStandalone;
}

function isIos(navigatorValue: Navigator) {
  return (
    /iPhone|iPad|iPod/i.test(navigatorValue.userAgent) ||
    (navigatorValue.platform === 'MacIntel' && navigatorValue.maxTouchPoints > 1)
  );
}

export function usePwaInstall() {
  return useContext(PwaInstallContext);
}

export function PwaRegistration({ children }: { children: ReactNode }) {
  const [mobileBrowser, setMobileBrowser] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [manualHelp, setManualHelp] = useState(false);

  useEffect(() => {
    const isMobile = isMobileBrowser(navigator, window);
    setMobileBrowser(isMobile);
    setIosDevice(isIos(navigator));
    setPromptOpen(isMobile && sessionStorage.getItem(PROMPT_DISMISSED_KEY) !== 'true');

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/service-worker.js');
    }

    const rememberInstallEvent = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setManualHelp(false);
    };
    const markInstalled = () => {
      setInstalled(true);
      setPromptOpen(false);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', rememberInstallEvent);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', rememberInstallEvent);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  const dismissPrompt = useCallback(() => {
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setPromptOpen(false);
    setManualHelp(false);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) {
      setManualHelp(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setPromptOpen(false);
    if (choice.outcome === 'accepted') setInstalled(true);
  }, [installEvent]);

  const openInstallPrompt = useCallback(() => {
    if (installEvent) {
      void install();
      return;
    }

    setManualHelp(false);
    setPromptOpen(true);
  }, [install, installEvent]);

  const value = useMemo(
    () => ({ canOfferInstall: mobileBrowser && !installed, openInstallPrompt }),
    [installed, mobileBrowser, openInstallPrompt],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      {promptOpen && mobileBrowser && !installed ? (
        <aside className="installPrompt" role="dialog" aria-labelledby="install-prompt-title">
          <Image src="/icons/icon-192.png" width="52" height="52" alt="" />
          <div className="installPromptCopy">
            <h2 id="install-prompt-title">Install Monthloom</h2>
            {manualHelp ? (
              <p>
                {iosDevice
                  ? 'On iPhone or iPad, tap Share and then Add to Home Screen. Apple does not allow sites to open this dialog automatically.'
                  : 'This browser has not exposed its installer. Open the browser menu and choose Install app or Add to Home screen.'}
              </p>
            ) : (
              <p>Keep Monthloom on your home screen for quick, app-like access.</p>
            )}
          </div>
          <div className="installPromptActions">
            <button type="button" className="installPromptCancel" onClick={dismissPrompt}>
              {manualHelp ? 'Close' : 'Not now'}
            </button>
            {!manualHelp ? (
              <button
                type="button"
                className="installPromptConfirm"
                onClick={() => void install()}
              >
                {installEvent ? 'Install' : 'Show me how'}
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </PwaInstallContext.Provider>
  );
}
