'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Defaults, registerRequestSchema, type RegisterRequest } from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ProfileAppearanceFields } from '../../components/profile-appearance-fields';
import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { setLocaleCookie } from '../../i18n/locale-cookie';
import { useApiErrorMessage } from '../../lib/api/localized-error';

import { authKeys, register as registerRequest } from './auth.api';

export function RegisterForm({ redirectTo }: { redirectTo: string }) {
  const t = useTranslations('Auth');
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      profileImage: Defaults.USER_PROFILE_IMAGE,
      desiredColor: Defaults.USER_DESIRED_COLOR,
    },
  });

  const profileImage = watch('profileImage');
  const desiredColor = watch('desiredColor');

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: async (data) => {
      setLocaleCookie(data.user.locale);
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
      router.push(redirectTo);
      router.refresh();
    },
    onError: (error) => setError('root', { message: errorMessage(error, t('genericError')) }),
  });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      aria-label={t('createAccount')}
    >
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}

      <FormField>
        <Label htmlFor="displayName">{t('displayName')}</Label>
        <Input id="displayName" type="text" autoComplete="name" {...register('displayName')} />
        <FieldError message={errors.displayName?.message} />
      </FormField>

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
          autoComplete="new-password"
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </FormField>

      <ProfileAppearanceFields
        profileImage={profileImage}
        desiredColor={desiredColor}
        onProfileImageChange={(value) =>
          setValue('profileImage', value, { shouldDirty: true, shouldValidate: true })
        }
        onDesiredColorChange={(value) =>
          setValue('desiredColor', value, { shouldDirty: true, shouldValidate: true })
        }
        profileImageError={errors.profileImage?.message}
        desiredColorError={errors.desiredColor?.message}
      />

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? t('creatingAccount') : t('createAccount')}
      </Button>
    </form>
  );
}
