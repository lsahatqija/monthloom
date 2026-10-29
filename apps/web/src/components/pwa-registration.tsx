'use client';

import { Download, MoreVertical, Pin, Plus, Share2 } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
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
  key: string;
}

interface PwaInstallContextValue {
  canOfferInstall: boolean;
  installActionLabel: string;
  openInstallPrompt: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canOfferInstall: false,
  installActionLabel: '',
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
  const chromeBrowser = /Chrome|CriOS/i.test(userAgent) && !/Edg|EdgiOS|OPR|Opera/i.test(userAgent);

  if (platform === 'ios') {
    return [
      { icon: Share2, key: 'steps.iosShare' },
      { icon: Plus, key: 'steps.iosHome' },
      { icon: Download, key: 'steps.iosAdd' },
    ];
  }

  if (platform === 'android') {
    if (chromeBrowser) {
      return [
        { icon: MoreVertical, key: 'steps.androidChromeMenu' },
        { icon: Download, key: 'steps.androidChromeShortcut' },
        { icon: Plus, key: 'steps.androidChromeConfirm' },
      ];
    }

    return [
      { icon: MoreVertical, key: 'steps.browserMenu' },
      { icon: Download, key: 'steps.androidInstall' },
      { icon: Plus, key: 'steps.androidConfirm' },
    ];
  }

  if (chromeBrowser) {
    return [
      { icon: MoreVertical, key: 'steps.chromeMenu' },
      { icon: Share2, key: 'steps.chromeShare' },
      { icon: Download, key: 'steps.chromeInstall' },
      {
        icon: Pin,
        key: platform === 'macos' ? 'steps.keepInDock' : 'steps.pinTaskbar',
      },
    ];
  }

  if (platform === 'macos') {
    return [
      { icon: Share2, key: 'steps.safariShare' },
      { icon: Download, key: 'steps.safariDock' },
      { icon: Plus, key: 'steps.safariConfirm' },
    ];
  }

  if (/Firefox/i.test(userAgent)) {
    return [
      { icon: Download, key: 'steps.firefoxButton' },
      { icon: Plus, key: 'steps.firefoxInstall' },
      { icon: Pin, key: 'steps.firefoxPin' },
    ];
  }

  return [
    { icon: MoreVertical, key: 'steps.browserMenu' },
    { icon: Download, key: 'steps.desktopInstall' },
    { icon: Pin, key: 'steps.desktopPin' },
  ];
}

export function usePwaInstall() {
  return useContext(PwaInstallContext);
}

export function PwaRegistration({ children }: { children: ReactNode }) {
  const t = useTranslations('Pwa');
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
      installActionLabel: mobileBrowser ? t('installApp') : t('pinTaskbar'),
      openInstallPrompt,
    }),
    [eligibleSession, installed, mobileBrowser, openInstallPrompt, t],
  );

  const desktopBrowser = !mobileBrowser;
  const manualSteps = getManualInstallSteps(platform, userAgent);
  const actionLabel = desktopBrowser ? t('pinTaskbar') : installEvent ? t('install') : t('showHow');

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
              {desktopBrowser ? t('desktopTitle') : t('mobileTitle')}
            </h2>
            {manualHelp ? (
              <ol className="installPromptSteps">
                {manualSteps.map(({ icon: StepIcon, key }, index) => (
                  <li key={key}>
                    <span className="installPromptStepIcon" aria-hidden="true">
                      <StepIcon />
                    </span>
                    <span>
                      <strong>{index + 1}.</strong> {t(key)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>{desktopBrowser ? t('desktopDescription') : t('mobileDescription')}</p>
            )}
          </div>
          <div className="installPromptActions">
            <button type="button" className="installPromptCancel" onClick={dismissPrompt}>
              {manualHelp ? t('close') : t('notNow')}
            </button>
            {!manualHelp ? (
              <button type="button" className="installPromptConfirm" onClick={() => void install()}>
                {actionLabel}
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </PwaInstallContext.Provider>
  );
}
