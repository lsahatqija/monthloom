'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { setLocaleCookie } from '../../i18n/locale-cookie';
import { isApiClientError } from '../../lib/api/errors';

import { authKeys, login } from './auth.api';

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      setLocaleCookie(data.user.locale);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      router.push(redirectTo);
      router.refresh();
    },
    onError: (error) => {
      if (isApiClientError(error)) {
        setError('root', { message: error.message });
      } else {
        setError('root', { message: t('genericError') });
      }
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      aria-label={t('login')}
    >
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}

      <FormField>
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FieldError message={errors.email?.message} />
      </FormField>

      <FormField>
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
        <Link className="formAuxiliaryLink" href="/forgot-password">
          {t('forgotPassword')}
        </Link>
      </FormField>

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? t('loggingIn') : t('login')}
      </Button>
    </form>
  );
}
