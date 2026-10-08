'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { newPasswordFieldsSchema, type ResetPasswordRequest } from '@template/contracts';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { resetPassword } from './auth.api';

type ResetPasswordFields = Omit<ResetPasswordRequest, 'token'>;

export function ResetPasswordForm({ token }: { token: string }) {
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
        message: isApiClientError(error)
          ? error.message
          : 'Something went wrong. Please try again.',
      });
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="authConfirmation">
        <Alert>Your password has been reset. Log in with your new password.</Alert>
        <Link className="button" href="/login">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      <FormField>
        <Label htmlFor="new-password">New password</Label>
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
        <Label htmlFor="confirm-new-password">Confirm new password</Label>
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
        {mutation.isPending ? 'Resetting...' : 'Reset password'}
      </Button>
    </form>
  );
}
