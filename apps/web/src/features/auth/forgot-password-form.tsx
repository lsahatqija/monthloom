'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@template/contracts';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { requestPasswordReset } from './auth.api';

export function ForgotPasswordForm() {
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
        message: isApiClientError(error)
          ? error.message
          : 'Something went wrong. Please try again.',
      });
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="authConfirmation">
        <Alert>{mutation.data.message}</Alert>
        <p>You can close this page after checking your inbox.</p>
        <Link className="button buttonSecondary" href="/login">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      <FormField>
        <Label htmlFor="reset-email">Email</Label>
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
        {mutation.isPending ? 'Sending...' : 'Send reset link'}
      </Button>
    </form>
  );
}
