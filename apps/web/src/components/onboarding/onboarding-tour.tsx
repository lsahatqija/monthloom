'use client';

import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@template/contracts';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { financeKeys, getHouseholds } from '../../features/finance/finance.api';

const STORAGE_PREFIX = 'monthloom-onboarding-complete:';
const ACTIVE_STEP_PREFIX = 'monthloom-onboarding-step:';

type TourStep =
  | 'overview'
  | 'household'
  | 'add-transaction'
  | 'transaction-kind'
  | 'transaction-source'
  | 'transaction-fields'
  | 'recurring'
  | 'expiration'
  | 'months'
  | 'settings-menu'
  | 'household-invitations'
  | 'home';

type StepContent = {
  eyebrow: string;
  title: string;
  body: string;
  target?: string;
  placement?: 'auto' | 'side';
};

const content: Record<TourStep, StepContent> = {
  overview: {
    eyebrow: 'Welcome to Monthloom',
    title: 'Plan your household finances together',
    body: "Monthloom brings everyone's income and expenses into one calm monthly view, so your household can understand what is coming in, what is going out, and what remains.",
  },
  household: {
    eyebrow: 'Step 1',
    title: 'Create your household',
    body: 'Give your shared space a name, icon, color, and currency, then select Create household. You can edit these details later in Household settings. If you received an invitation, accept it instead and this step is skipped automatically.',
    target: '[data-onboarding="create-household"]',
  },
  'add-transaction': {
    eyebrow: 'Step 2',
    title: 'Add your first transaction',
    body: 'Transactions can be income or expenses. Select Add transaction to open the entry form.',
    target: '[data-onboarding="add-transaction"]',
  },
  'transaction-kind': {
    eyebrow: 'Step 3',
    title: 'Choose expense or income',
    body: 'Start by choosing Expense when money is going out, or Income when money is coming in. This choice adjusts the fields and categories available for the transaction.',
    target: '[data-onboarding="transaction-kind"]',
    placement: 'side',
  },
  'transaction-source': {
    eyebrow: 'Step 4',
    title: 'Add a transaction source',
    body: 'A source labels where money comes from for income, or where you spend it for an expense. Sources work for both kinds of transaction, so you can use names such as Employer, Supermarket, or Bank. Open this menu and choose Add new source when you need one.',
    target: '[data-onboarding="source-modal"], [data-onboarding="transaction-source"]',
    placement: 'side',
  },
  'transaction-fields': {
    eyebrow: 'Step 5',
    title: 'Describe the transaction',
    body: 'Choose income or expense, then add a source, category, amount, and date. The icon and color make entries easy to scan, while the user field records who the transaction belongs to. You can edit a saved transaction later from its actions menu.',
    target: '[data-onboarding="transaction-fields"]',
    placement: 'side',
  },
  recurring: {
    eyebrow: 'Step 6',
    title: 'Let recurring costs plan ahead',
    body: 'Turn on Recurring transaction for rent, salaries, subscriptions, and other monthly entries. Monthloom projects them into future months; add an expiration date when the repetition should stop.',
    target: '[data-onboarding="recurring"]',
    placement: 'side',
  },
  expiration: {
    eyebrow: 'Step 7',
    title: 'Set an expiration date',
    body: 'Recurring entries can stop automatically. Turn on Expires and choose the final date for expiring contracts, installment purchases, loans, or anything else that will eventually be paid off.',
    target: '[data-onboarding="expiration"]',
    placement: 'side',
  },
  months: {
    eyebrow: 'Step 8',
    title: 'Look backward and plan forward',
    body: 'Use the month selector to move through past and future months. The income, expenses, and balance cards update for each month, including projected recurring transactions.',
    target: '[data-onboarding="month-overview"]',
  },
  'settings-menu': {
    eyebrow: 'Step 9',
    title: 'Find your settings',
    body: 'Open the account menu to reach your Profile, Appearance, Household, and Source settings. Household settings is where you manage members and invitations.',
    target: '[data-onboarding="settings-links"], [data-onboarding="settings-menu"]',
  },
  'household-invitations': {
    eyebrow: 'Step 10',
    title: 'Invite your household',
    body: 'Invite others from Household settings. Share a single-use invitation link, or switch to Email to send invitations directly to one or more people.',
    target: '[data-onboarding="household-invitations"]',
    placement: 'side',
  },
  home: {
    eyebrow: 'Step 11',
    title: 'Return to your main view',
    body: 'Use the Home button at any time to return to your monthly household overview.',
    target: '[data-onboarding="home-button"]',
  },
};

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function activeStepKey(userId: string) {
  return `${ACTIVE_STEP_PREFIX}${userId}`;
}

export function restartOnboarding(userId: string) {
  window.localStorage.removeItem(storageKey(userId));
  window.sessionStorage.removeItem(activeStepKey(userId));
  window.location.assign('/');
}

export function OnboardingTour({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<TourStep | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const households = useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });
  const hasHousehold = Boolean(households.data?.length);
  const current = step ? content[step] : null;

  useEffect(() => {
    if (pathname.startsWith('/invite/')) return;
    if (window.localStorage.getItem(storageKey(user.id)) === 'true') return;
    const activeStep = window.sessionStorage.getItem(activeStepKey(user.id)) as TourStep | null;
    setStep(activeStep && activeStep in content ? activeStep : 'overview');
  }, [pathname, user.id]);

  useEffect(() => {
    if (step) window.sessionStorage.setItem(activeStepKey(user.id), step);
  }, [step, user.id]);

  useEffect(() => {
    if (step === 'household' && pathname !== '/settings/households') {
      router.push('/settings/households');
    }
    if (
      (step === 'add-transaction' || step === 'months' || step === 'settings-menu') &&
      pathname !== '/'
    ) {
      router.push('/');
    }
    if (step === 'household-invitations' && pathname !== '/settings/households') {
      router.push('/settings/households');
    }
  }, [pathname, router, step]);

  const updateTarget = useCallback(() => {
    if (!current?.target) {
      setTargetRect(null);
      return;
    }
    const element = document.querySelector(current.target);
    setTargetRect(element?.getBoundingClientRect() ?? null);
  }, [current?.target]);

  useEffect(() => {
    if (!step) return;
    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [step, pathname, updateTarget]);

  useEffect(() => {
    if (step === 'household' && hasHousehold) updateTarget();
  }, [hasHousehold, step, updateTarget]);

  useEffect(() => {
    if (step !== 'add-transaction') return;
    const progressWhenOpened = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(content['add-transaction'].target!)) setStep('transaction-kind');
    };
    document.addEventListener('click', progressWhenOpened);
    return () => document.removeEventListener('click', progressWhenOpened);
  }, [step]);

  useEffect(() => {
    if (step !== 'settings-menu' && step !== 'home') return;
    const respondToNavigation = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        step === 'settings-menu' &&
        target?.closest('[data-onboarding="household-settings-link"]')
      ) {
        setStep('household-invitations');
      }
      if (step === 'home' && target?.closest('[data-onboarding="home-button"]')) finish();
    };
    document.addEventListener('click', respondToNavigation);
    return () => document.removeEventListener('click', respondToNavigation);
  });

  useEffect(() => {
    const respondToFormActions = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'add-source' && step === 'transaction-fields') {
        setStep('transaction-source');
      }
      if (action === 'recurring-enabled' && step === 'recurring') {
        setStep('expiration');
      }
    };
    window.addEventListener('monthloom:onboarding', respondToFormActions);
    return () => window.removeEventListener('monthloom:onboarding', respondToFormActions);
  }, [step]);

  const position = useMemo(() => {
    if (!targetRect || typeof window === 'undefined') return undefined;
    const width = Math.min(360, window.innerWidth - 32);
    if (current?.placement === 'side' && window.innerWidth >= 900) {
      const roomRight = window.innerWidth - targetRect.right;
      const left =
        roomRight >= width + 32
          ? targetRect.right + 16
          : Math.max(16, targetRect.left - width - 16);
      const top = Math.min(
        window.innerHeight - 360,
        Math.max(16, targetRect.top + targetRect.height / 2 - 180),
      );
      return { top: Math.max(16, top), left, width };
    }
    const roomBelow = window.innerHeight - targetRect.bottom;
    const top = roomBelow >= 250 ? targetRect.bottom + 16 : Math.max(16, targetRect.top - 236);
    const left = Math.min(
      window.innerWidth - width - 16,
      Math.max(16, targetRect.left + targetRect.width / 2 - width / 2),
    );
    return { top, left, width };
  }, [current?.placement, targetRect]);

  const finish = () => {
    window.localStorage.setItem(storageKey(user.id), 'true');
    window.sessionStorage.removeItem(activeStepKey(user.id));
    setStep(null);
  };

  const next = () => {
    switch (step) {
      case 'overview':
        setStep(hasHousehold ? 'add-transaction' : 'household');
        break;
      case 'household':
        if (hasHousehold) setStep('add-transaction');
        break;
      case 'add-transaction': {
        const trigger = document.querySelector<HTMLButtonElement>(
          content['add-transaction'].target!,
        );
        trigger?.click();
        setStep('transaction-kind');
        break;
      }
      case 'transaction-kind':
        setStep('transaction-source');
        break;
      case 'transaction-source':
        setStep('transaction-fields');
        break;
      case 'transaction-fields':
        setStep('recurring');
        break;
      case 'recurring': {
        const recurringToggle = document.querySelector<HTMLInputElement>(
          '[data-onboarding="recurring"] input[role="switch"]',
        );
        if (recurringToggle && !recurringToggle.checked) recurringToggle.click();
        setStep('expiration');
        break;
      }
      case 'expiration':
        document.querySelector<HTMLButtonElement>('[data-onboarding="transaction-close"]')?.click();
        setStep('months');
        break;
      case 'months':
        setStep('settings-menu');
        break;
      case 'settings-menu':
        setStep('household-invitations');
        router.push('/settings/households');
        break;
      case 'household-invitations':
        setStep('home');
        break;
      case 'home':
        router.push('/');
        finish();
        break;
    }
  };

  if (!step || !current || typeof document === 'undefined') return null;
  const total = hasHousehold ? 11 : 12;
  const index = hasHousehold
    ? [
        'overview',
        'add-transaction',
        'transaction-kind',
        'transaction-source',
        'transaction-fields',
        'recurring',
        'expiration',
        'months',
        'settings-menu',
        'household-invitations',
        'home',
      ].indexOf(step) + 1
    : [
        'overview',
        'household',
        'add-transaction',
        'transaction-kind',
        'transaction-source',
        'transaction-fields',
        'recurring',
        'expiration',
        'months',
        'settings-menu',
        'household-invitations',
        'home',
      ].indexOf(step) + 1;
  const waitingForTarget = Boolean(current.target && !targetRect);

  return createPortal(
    <div className="onboardingTour" aria-live="polite">
      {targetRect ? (
        <div
          className="onboardingSpotlight"
          style={{
            top: Math.max(8, targetRect.top - 7),
            left: Math.max(8, targetRect.left - 7),
            width: Math.min(window.innerWidth - 16, targetRect.width + 14),
            height: targetRect.height + 14,
          }}
        />
      ) : (
        <div className="onboardingShade" />
      )}
      <section
        className={`onboardingWindow ${targetRect ? 'isAnchored' : 'isCentered'}`}
        style={position}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <div className="onboardingProgress" aria-label={`Step ${index} of ${total}`}>
          <span>
            {index} / {total}
          </span>
          <span className="onboardingProgressTrack">
            <span style={{ width: `${(index / total) * 100}%` }} />
          </span>
        </div>
        <p className="onboardingEyebrow">{current.eyebrow}</p>
        <h2 id="onboarding-title">{current.title}</h2>
        <p id="onboarding-description">{current.body}</p>
        {step === 'household' && !hasHousehold ? (
          <p className="onboardingHint">Create the household above to continue.</p>
        ) : null}
        <div className="onboardingActions">
          {step === 'overview' ? (
            <button type="button" className="onboardingSkip" onClick={finish}>
              Skip tutorial
            </button>
          ) : (
            <button type="button" className="onboardingSkip" onClick={finish}>
              Exit tutorial
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={next}
            disabled={waitingForTarget || (step === 'household' && !hasHousehold)}
          >
            {step === 'overview' ? 'Show me around' : step === 'months' ? 'Finish' : 'Next'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
