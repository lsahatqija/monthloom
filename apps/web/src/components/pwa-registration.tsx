'use client';

import { Download, MoreVertical, Pin, Plus, Share2 } from 'lucide-react';
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

type InstallPlatform = 'ios' | 'android' | 'windows' | 'macos' | 'desktop';

interface InstallStep {
  icon: typeof Download;
  text: string;
}

interface PwaInstallContextValue {
  canOfferInstall: boolean;
  installActionLabel: string;
  openInstallPrompt: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canOfferInstall: false,
  installActionLabel: 'Install app',
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

function isStandalone(navigatorValue: Navigator, windowValue: Window) {
  const extendedNavigator = navigatorValue as NavigatorWithInstallState;
  return (
    windowValue.matchMedia?.('(display-mode: standalone)').matches ||
    extendedNavigator.standalone === true
  );
}

function isIos(navigatorValue: Navigator) {
  return (
    /iPhone|iPad|iPod/i.test(navigatorValue.userAgent) ||
    (navigatorValue.platform === 'MacIntel' && navigatorValue.maxTouchPoints > 1)
  );
}

function getInstallPlatform(navigatorValue: Navigator, mobileBrowser: boolean): InstallPlatform {
  if (isIos(navigatorValue)) return 'ios';
  if (mobileBrowser) return 'android';
  if (/Windows/i.test(navigatorValue.userAgent)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(navigatorValue.userAgent)) return 'macos';
  return 'desktop';
}

function getManualInstallSteps(platform: InstallPlatform, userAgent: string): InstallStep[] {
  if (platform === 'ios') {
    return [
      { icon: Share2, text: 'Tap the Share button in your browser toolbar.' },
      { icon: Plus, text: 'Choose Add to Home Screen.' },
      { icon: Download, text: 'Turn on Open as Web App, then tap Add.' },
    ];
  }

  if (platform === 'android') {
    return [
      { icon: MoreVertical, text: 'Open your browser menu.' },
      { icon: Download, text: 'Choose Install app or Add to Home screen.' },
      { icon: Plus, text: 'Confirm the name, then tap Install or Add.' },
    ];
  }

  if (platform === 'macos') {
    if (!/Safari/i.test(userAgent) || /Chrome|Chromium|CriOS|Edg|OPR|Opera/i.test(userAgent)) {
      return [
        { icon: MoreVertical, text: 'Open your browser menu.' },
        { icon: Download, text: 'Choose Install Monthloom or Install page as app.' },
        { icon: Pin, text: 'Open the app, right-click its Dock icon, then choose Keep in Dock.' },
      ];
    }

    return [
      { icon: Share2, text: 'In Safari, open the Share menu.' },
      { icon: Download, text: 'Choose Add to Dock.' },
      { icon: Plus, text: 'Confirm the name, then click Add.' },
    ];
  }

  if (/Firefox/i.test(userAgent)) {
    return [
      { icon: Download, text: 'Click the web app button in the Firefox address bar.' },
      { icon: Plus, text: 'Allow Firefox to install Monthloom as a web app.' },
      { icon: Pin, text: 'Choose Yes when Firefox asks to pin it to the taskbar.' },
    ];
  }

  return [
    { icon: MoreVertical, text: 'Open your browser menu.' },
    { icon: Download, text: 'Choose Install Monthloom or Install page as app.' },
    { icon: Pin, text: 'Open the app, right-click its taskbar icon, then choose Pin to taskbar.' },
  ];
}

export function usePwaInstall() {
  return useContext(PwaInstallContext);
}

export function PwaRegistration({ children }: { children: ReactNode }) {
  const [mobileBrowser, setMobileBrowser] = useState(false);
  const [eligibleSession, setEligibleSession] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [userAgent, setUserAgent] = useState('');
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [manualHelp, setManualHelp] = useState(false);

  useEffect(() => {
    const isMobile = isMobileBrowser(navigator, window);
    const canInstall = !isStandalone(navigator, window);
    setMobileBrowser(isMobile);
    setEligibleSession(canInstall);
    setPlatform(getInstallPlatform(navigator, isMobile));
    setUserAgent(navigator.userAgent);
    setPromptOpen(canInstall && sessionStorage.getItem(PROMPT_DISMISSED_KEY) !== 'true');

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
    () => ({
      canOfferInstall: eligibleSession && !installed,
      installActionLabel: mobileBrowser ? 'Install app' : 'Pin to Taskbar',
      openInstallPrompt,
    }),
    [eligibleSession, installed, mobileBrowser, openInstallPrompt],
  );

  const desktopBrowser = !mobileBrowser;
  const manualSteps = getManualInstallSteps(platform, userAgent);
  const actionLabel = desktopBrowser ? 'Pin to Taskbar' : installEvent ? 'Install' : 'Show me how';

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      {promptOpen && eligibleSession && !installed ? (
        <aside
          className={`installPrompt${desktopBrowser ? ' installPromptDesktop' : ''}`}
          role="dialog"
          aria-labelledby="install-prompt-title"
        >
          <Image src="/icons/icon-192.png" width="52" height="52" alt="" />
          <div className="installPromptCopy">
            <h2 id="install-prompt-title">
              {desktopBrowser ? 'Keep Monthloom close' : 'Install Monthloom'}
            </h2>
            {manualHelp ? (
              <ol className="installPromptSteps">
                {manualSteps.map(({ icon: StepIcon, text }, index) => (
                  <li key={text}>
                    <span className="installPromptStepIcon" aria-hidden="true">
                      <StepIcon />
                    </span>
                    <span>
                      <strong>{index + 1}.</strong> {text}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                {desktopBrowser
                  ? 'Pin Monthloom for quick access without searching through browser tabs.'
                  : 'Keep Monthloom on your home screen for quick, app-like access.'}
              </p>
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
                {actionLabel}
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </PwaInstallContext.Provider>
  );
}
