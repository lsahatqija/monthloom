'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@monthloom/contracts';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { useApiErrorMessage } from '../../lib/api/localized-error';

import { requestPasswordReset } from './auth.api';

export function ForgotPasswordForm() {
  const t = useTranslations('Auth');
  const errorMessage = useApiErrorMessage();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordRequest>({ resolver: zodResolver(forgotPasswordRequestSchema) });
  const mutation = useMutation({
    mutationFn: requestPasswordReset,
    onError: (error) => {
      setError('root', {
        message: errorMessage(error, t('genericError')),
      });
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="authConfirmation">
        <Alert>{t('resetLinkSent')}</Alert>
        <p>{t('checkInbox')}</p>
        <Link className="button buttonSecondary" href="/login">
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      <FormField>
        <Label htmlFor="reset-email">{t('email')}</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="email"
          autoFocus
          disabled={mutation.isPending}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </FormField>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('sending') : t('sendResetLink')}
      </Button>
    </form>
  );
}
