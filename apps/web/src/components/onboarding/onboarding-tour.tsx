'use client';

import type { PublicUser } from '@monthloom/contracts';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  target?: string;
  placement?: 'auto' | 'side';
};

const content: Record<TourStep, StepContent> = {
  overview: {},
  household: {
    target: '[data-onboarding="create-household"]',
  },
  'add-transaction': {
    target: '[data-onboarding="add-transaction"]',
  },
  'transaction-kind': {
    target: '[data-onboarding="transaction-kind"]',
    placement: 'side',
  },
  'transaction-source': {
    target: '[data-onboarding="source-modal"], [data-onboarding="transaction-source"]',
    placement: 'side',
  },
  'transaction-fields': {
    target: '[data-onboarding="transaction-fields"]',
    placement: 'side',
  },
  recurring: {
    target: '[data-onboarding="recurring"]',
    placement: 'side',
  },
  expiration: {
    target: '[data-onboarding="expiration"]',
    placement: 'side',
  },
  months: {
    target: '[data-onboarding="month-overview"]',
  },
  'settings-menu': {
    target: '[data-onboarding="settings-links"], [data-onboarding="settings-menu"]',
    placement: 'side',
  },
  'household-invitations': {
    target: '[data-onboarding="household-invitations"]',
    placement: 'side',
  },
  home: {
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
  const t = useTranslations('Onboarding');
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<TourStep | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const scrolledInvitationIntoView = useRef(false);
  const households = useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });
  const hasHousehold = Boolean(households.data?.length);
  const current = step
    ? {
        ...content[step],
        eyebrow: t(`${step}.eyebrow`),
        title: t(`${step}.title`),
        body: t(`${step}.body`),
      }
    : null;

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
      if (step === 'settings-menu' && target?.closest('a[href^="/settings/"]')) {
        event.preventDefault();
        setStep('household-invitations');
        router.push('/settings/households');
      }
      if (step === 'home' && target?.closest('[data-onboarding="home-button"]')) finish();
    };
    document.addEventListener('click', respondToNavigation, true);
    return () => document.removeEventListener('click', respondToNavigation, true);
  }, [router, step]);

  useEffect(() => {
    const respondToFormActions = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === 'add-source' && step === 'transaction-fields') {
        setStep('transaction-source');
      }
      if (action === 'source-saved' && step === 'transaction-source') {
        setStep('transaction-fields');
      }
      if (action === 'recurring-enabled' && step === 'recurring') {
        setStep('expiration');
      }
      if (action === 'household-created' && step === 'household') {
        setStep('add-transaction');
      }
    };
    window.addEventListener('monthloom:onboarding', respondToFormActions);
    return () => window.removeEventListener('monthloom:onboarding', respondToFormActions);
  }, [step]);

  useEffect(() => {
    if (step !== 'household-invitations') {
      scrolledInvitationIntoView.current = false;
      return;
    }
    const isMobilePortrait = window.innerWidth <= 800 && window.innerHeight > window.innerWidth;
    if (!isMobilePortrait || !targetRect || scrolledInvitationIntoView.current) return;
    const target = document.querySelector(content['household-invitations'].target!);
    if (!target) return;
    scrolledInvitationIntoView.current = true;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [step, targetRect]);

  const position = useMemo(() => {
    if (!targetRect || typeof window === 'undefined') return undefined;
    const isMobilePortrait = window.innerWidth <= 800 && window.innerHeight > window.innerWidth;
    const width = Math.min(360, window.innerWidth - (isMobilePortrait ? 24 : 32));
    if (isMobilePortrait) {
      const targetCenter = targetRect.top + targetRect.height / 2;
      const horizontalPosition = { left: 12, width };
      return targetCenter >= window.innerHeight / 2
        ? { ...horizontalPosition, top: 12 }
        : { ...horizontalPosition, bottom: 12 };
    }
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
        document
          .querySelector<HTMLButtonElement>('[data-onboarding="source-modal-close"]')
          ?.click();
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
        <div className="onboardingProgress" aria-label={t('progress', { index, total })}>
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
          <p className="onboardingHint">{t('createHouseholdHint')}</p>
        ) : null}
        <div className="onboardingActions">
          {step === 'overview' ? (
            <button type="button" className="onboardingSkip" onClick={finish}>
              {t('skip')}
            </button>
          ) : (
            <button type="button" className="onboardingSkip" onClick={finish}>
              {t('exit')}
            </button>
          )}
          <button
            type="button"
            className="button"
            onClick={next}
            disabled={waitingForTarget || (step === 'household' && !hasHousehold)}
          >
            {step === 'overview' ? t('showMe') : step === 'home' ? t('finish') : t('next')}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
