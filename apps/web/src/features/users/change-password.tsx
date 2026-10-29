'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema, type ChangePasswordRequest } from '@monthloom/contracts';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';
import { requestPasswordReset } from '../auth/auth.api';

import { changePassword } from './users.api';

export function ChangePassword({ email }: { email: string }) {
  const t = useTranslations('Profile');
  const [isOpen, setIsOpen] = useState(false);
  const [wasChanged, setWasChanged] = useState(false);
  const resetMutation = useMutation({ mutationFn: requestPasswordReset });

  return (
    <>
      {wasChanged ? <Alert>{t('passwordChanged')}</Alert> : null}
      {resetMutation.isSuccess ? <Alert>{t('resetLinkSent')}</Alert> : null}
      {resetMutation.isError ? (
        <Alert variant="error">
          {isApiClientError(resetMutation.error) ? resetMutation.error.message : t('genericError')}
        </Alert>
      ) : null}
      <div className="settingsPanel settingsSecurityPanel">
        <div>
          <h3>{t('password')}</h3>
          <p>{t('passwordDescription')}</p>
        </div>
        <div className="settingsSecurityActions">
          <Button
            type="button"
            variant="secondary"
            disabled={resetMutation.isPending}
            onClick={() => resetMutation.mutate({ email })}
          >
            {resetMutation.isPending ? t('sending') : t('emailResetLink')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setWasChanged(false);
              setIsOpen(true);
            }}
          >
            {t('changePassword')}
          </Button>
        </div>
      </div>
      {isOpen ? (
        <ChangePasswordModal
          onClose={() => setIsOpen(false)}
          onChanged={() => {
            setIsOpen(false);
            setWasChanged(true);
          }}
        />
      ) : null}
    </>
  );
}

function ChangePasswordModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations('Profile');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequestSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: onChanged,
    onError: (error) => {
      if (isApiClientError(error) && error.details?.currentPassword?.[0]) {
        setError(
          'currentPassword',
          { message: error.details.currentPassword[0] },
          { shouldFocus: true },
        );
        return;
      }
      setError('root', {
        message: isApiClientError(error) ? error.message : t('genericError'),
      });
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mutation.isPending, onClose]);

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <section
        className="transactionModal changePasswordModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">{t('accountSecurity')}</p>
            <h2 id="change-password-title">{t('changePassword')}</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            disabled={mutation.isPending}
            onClick={onClose}
            aria-label={t('closePasswordModal')}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form
          className="transactionForm"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}

          <FormField>
            <Label htmlFor="currentPassword">{t('currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              autoFocus
              disabled={mutation.isPending}
              {...register('currentPassword')}
            />
            <FieldError message={errors.currentPassword?.message} />
          </FormField>

          <FormField>
            <Label htmlFor="newPassword">{t('newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={mutation.isPending}
              {...register('newPassword')}
            />
            <FieldError message={errors.newPassword?.message} />
          </FormField>

          <FormField>
            <Label htmlFor="confirmNewPassword">{t('confirmNewPassword')}</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              disabled={mutation.isPending}
              {...register('confirmNewPassword')}
            />
            <FieldError message={errors.confirmNewPassword?.message} />
          </FormField>

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('changing') : t('changePassword')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
