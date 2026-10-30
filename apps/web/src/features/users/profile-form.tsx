'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Constants,
  updateProfileRequestSchema,
  type PublicUser,
  type UpdateProfileRequest,
} from '@monthloom/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import { ProfileAppearanceFields } from '../../components/profile-appearance-fields';
import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { LOCALE_FLAGS, LOCALE_NAMES } from '../../i18n/config';
import { setLocaleCookie } from '../../i18n/locale-cookie';
import { useApiErrorMessage } from '../../lib/api/localized-error';
import { authKeys, sendEmailVerification } from '../auth/auth.api';

import { updateProfile } from './users.api';

export function ProfileForm({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations('Profile');
  const errorMessage = useApiErrorMessage();

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
  const locale = watch('locale');
  const languageSelectRef = useRef<HTMLDetailsElement>(null);
  const localeField = register('locale');

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!languageSelectRef.current?.contains(event.target as Node)) {
        languageSelectRef.current?.removeAttribute('open');
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      setLocaleCookie(data.user.locale);
      queryClient.setQueryData(authKeys.me, data);
      router.refresh();
    },
    onError: (error) => {
      setError('root', {
        message: errorMessage(error, t('genericError')),
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
              {errorMessage(verificationMutation.error, t('verificationSendError'))}
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

      <fieldset className="formField languagePicker">
        <legend className="label">{t('language')}</legend>
        <details
          ref={languageSelectRef}
          className="languageSelect"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && languageSelectRef.current?.open) {
              event.preventDefault();
              languageSelectRef.current.open = false;
              languageSelectRef.current.querySelector('summary')?.focus();
            }
          }}
        >
          <summary className="input languageSelectTrigger" lang={locale}>
            <Image
              className="languageFlag"
              src={LOCALE_FLAGS[locale]}
              width={28}
              height={21}
              alt=""
              aria-hidden="true"
            />
            <span>{LOCALE_NAMES[locale]}</span>
          </summary>
          <div className="languageSelectOptions">
            {Constants.SUPPORTED_LOCALES.map((option) => (
              <label key={option} className="languageSelectOption" lang={option}>
                <input
                  type="radio"
                  value={option}
                  {...localeField}
                  onChange={(event) => {
                    void localeField.onChange(event);
                    languageSelectRef.current?.removeAttribute('open');
                  }}
                />
                <Image
                  className="languageFlag"
                  src={LOCALE_FLAGS[option]}
                  width={28}
                  height={21}
                  alt=""
                  aria-hidden="true"
                />
                <span>{LOCALE_NAMES[option]}</span>
              </label>
            ))}
          </div>
        </details>
        <FieldError message={errors.locale?.message} />
      </fieldset>

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
