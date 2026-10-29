'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Constants,
  updateProfileRequestSchema,
  type PublicUser,
  type UpdateProfileRequest,
} from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { ProfileAppearanceFields } from '../../components/profile-appearance-fields';
import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { LOCALE_NAMES } from '../../i18n/config';
import { setLocaleCookie } from '../../i18n/locale-cookie';
import { isApiClientError } from '../../lib/api/errors';
import { authKeys, sendEmailVerification } from '../auth/auth.api';

import { updateProfile } from './users.api';

export function ProfileForm({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('Profile');

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileRequestSchema),
    defaultValues: {
      displayName: user.displayName,
      profileImage: user.profileImage,
      desiredColor: user.desiredColor,
      locale: user.locale,
    },
  });

  const profileImage = watch('profileImage');
  const desiredColor = watch('desiredColor');

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      setLocaleCookie(data.user.locale);
      queryClient.setQueryData(authKeys.me, data);
      router.refresh();
    },
    onError: (error) => {
      setError('root', {
        message: isApiClientError(error) ? error.message : t('genericError'),
      });
    },
  });

  const verificationMutation = useMutation({ mutationFn: sendEmailVerification });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      aria-label={t('updateProfile')}
    >
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      {mutation.isSuccess ? <Alert>{t('updated')}</Alert> : null}

      {!user.emailVerified ? (
        <div className="emailVerificationPrompt">
          <Alert>{t('verifyEmailPrompt')}</Alert>
          {verificationMutation.isError ? (
            <Alert variant="error">
              {isApiClientError(verificationMutation.error)
                ? verificationMutation.error.message
                : t('verificationSendError')}
            </Alert>
          ) : null}
          {verificationMutation.isSuccess ? <Alert>{t('verificationSent')}</Alert> : null}
          <Button
            type="button"
            variant="secondary"
            disabled={verificationMutation.isPending || verificationMutation.isSuccess}
            onClick={() => verificationMutation.mutate()}
          >
            {verificationMutation.isPending ? t('sending') : t('verifyEmail')}
          </Button>
        </div>
      ) : null}

      <FormField>
        <Label htmlFor="displayName">{t('displayName')}</Label>
        <Input id="displayName" type="text" autoComplete="name" {...register('displayName')} />
        <FieldError message={errors.displayName?.message} />
      </FormField>

      <FormField>
        <Label htmlFor="locale">{t('language')}</Label>
        <select id="locale" className="input" {...register('locale')}>
          {Constants.SUPPORTED_LOCALES.map((locale) => (
            <option key={locale} value={locale} lang={locale}>
              {LOCALE_NAMES[locale]}
            </option>
          ))}
        </select>
        <FieldError message={errors.locale?.message} />
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
        {mutation.isPending ? t('saving') : t('saveChanges')}
      </Button>
    </form>
  );
}
