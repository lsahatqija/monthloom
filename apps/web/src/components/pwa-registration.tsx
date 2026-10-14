'use client';

import Image from 'next/image';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const PROMPT_DISMISSED_KEY = 'monthloom-install-prompt-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
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
  const mobileNavigator = navigatorValue as NavigatorWithStandalone;
  const isMobileDevice =
    mobileNavigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigatorValue.userAgent) ||
    (navigatorValue.platform === 'MacIntel' && navigatorValue.maxTouchPoints > 1);
  const isStandalone =
    windowValue.matchMedia?.('(display-mode: standalone)').matches ||
    mobileNavigator.standalone === true;

  return isMobileDevice && !isStandalone;
}

function isIosDevice(navigatorValue: Navigator) {
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const automaticPromptShown = useRef(false);

  useEffect(() => {
    const mobile = isMobileBrowser(navigator, window);
    setMobileBrowser(mobile);
    setIosDevice(isIosDevice(navigator));

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/service-worker.js');
    }

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setDialogOpen(false);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  useEffect(() => {
    if (!mobileBrowser || installed || automaticPromptShown.current) return;
    if (!installEvent && !iosDevice) return;
    if (sessionStorage.getItem(PROMPT_DISMISSED_KEY) === 'true') return;

    automaticPromptShown.current = true;
    setDialogOpen(true);
  }, [installEvent, installed, iosDevice, mobileBrowser]);

  const closePrompt = useCallback(() => {
    sessionStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setDialogOpen(false);
    setShowManualInstructions(false);
  }, []);

  const openInstallPrompt = useCallback(() => {
    setShowManualInstructions(!installEvent);
    setDialogOpen(true);
  }, [installEvent]);

  const install = useCallback(async () => {
    if (!installEvent) {
      setShowManualInstructions(true);
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setDialogOpen(false);
    if (choice.outcome === 'accepted') setInstalled(true);
  }, [installEvent]);

  const value = useMemo(
    () => ({ canOfferInstall: mobileBrowser && !installed, openInstallPrompt }),
    [installed, mobileBrowser, openInstallPrompt],
  );

  const manualInstructions = showManualInstructions || !installEvent;

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      {dialogOpen && mobileBrowser && !installed ? (
        <div className="installPromptBackdrop" role="presentation" onMouseDown={closePrompt}>
          <section
            className="installPrompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-prompt-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Image src="/icons/icon-192.png" width="56" height="56" alt="" />
            <div>
              <h2 id="install-prompt-title">Install Monthloom</h2>
              {manualInstructions ? (
                <p>
                  {iosDevice
                    ? 'Tap the Share button in Safari, then choose Add to Home Screen.'
                    : 'Open your browser menu and choose Install app or Add to Home screen.'}
                </p>
              ) : (
                <p>Add Monthloom to your home screen for quick, app-like access.</p>
              )}
            </div>
            <div className="installPromptActions">
              <button type="button" className="installPromptSecondary" onClick={closePrompt}>
                {manualInstructions ? 'Done' : 'Not now'}
              </button>
              {!manualInstructions ? (
                <button
                  type="button"
                  className="installPromptPrimary"
                  onClick={() => void install()}
                >
                  Install
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </PwaInstallContext.Provider>
  );
}
