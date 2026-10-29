'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { newPasswordFieldsSchema, type ResetPasswordRequest } from '@monthloom/contracts';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { resetPassword } from './auth.api';

type ResetPasswordFields = Omit<ResetPasswordRequest, 'token'>;

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordFields>({
    resolver: zodResolver(newPasswordFieldsSchema),
  });
  const mutation = useMutation({
    mutationFn: (values: ResetPasswordFields) => resetPassword({ token, ...values }),
    onError: (error) => {
      setError('root', {
        message: isApiClientError(error) ? error.message : t('genericError'),
      });
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="authConfirmation">
        <Alert>{t('passwordResetSuccess')}</Alert>
        <Link className="button" href="/login">
          {t('login')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      <FormField>
        <Label htmlFor="new-password">{t('newPassword')}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          disabled={mutation.isPending}
          {...register('newPassword')}
        />
        <FieldError message={errors.newPassword?.message} />
      </FormField>
      <FormField>
        <Label htmlFor="confirm-new-password">{t('confirmNewPassword')}</Label>
        <Input
          id="confirm-new-password"
          type="password"
          autoComplete="new-password"
          disabled={mutation.isPending}
          {...register('confirmNewPassword')}
        />
        <FieldError message={errors.confirmNewPassword?.message} />
      </FormField>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('resetting') : t('resetPassword')}
      </Button>
    </form>
  );
}
