'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema, type ChangePasswordRequest } from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { useApiErrorMessage } from '../../lib/api/localized-error';

import { authKeys, changeInitialPassword } from './auth.api';

export function InitialPasswordForm() {
  const t = useTranslations('Auth');
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
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
    mutationFn: changeInitialPassword,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      router.replace('/admin');
      router.refresh();
    },
    onError: (error) => setError('root', { message: errorMessage(error, t('genericError')) }),
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      <FormField>
        <Label htmlFor="current-password">{t('currentPassword')}</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          disabled={mutation.isPending}
          {...register('currentPassword')}
        />
        <FieldError message={errors.currentPassword?.message} />
      </FormField>
      <FormField>
        <Label htmlFor="new-password">{t('newPassword')}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
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
        {mutation.isPending ? t('changingInitialPassword') : t('changeInitialPassword')}
      </Button>
    </form>
  );
}
