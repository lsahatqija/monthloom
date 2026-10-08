'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateProfileRequestSchema,
  type PublicUser,
  type UpdateProfileRequest,
} from '@template/contracts';
import { useForm } from 'react-hook-form';

import { ProfileAppearanceFields } from '../../components/profile-appearance-fields';
import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';
import { authKeys, sendEmailVerification } from '../auth/auth.api';

import { updateProfile } from './users.api';

export function ProfileForm({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();

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
    },
  });

  const profileImage = watch('profileImage');
  const desiredColor = watch('desiredColor');

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
    onError: (error) => {
      setError('root', {
        message: isApiClientError(error)
          ? error.message
          : 'Something went wrong. Please try again.',
      });
    },
  });

  const verificationMutation = useMutation({ mutationFn: sendEmailVerification });

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
      aria-label="Update profile"
    >
      {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}
      {mutation.isSuccess ? <Alert>Profile updated.</Alert> : null}

      {!user.emailVerified ? (
        <div className="emailVerificationPrompt">
          <Alert>
            Verify your email address to use password recovery, email invitations, and other email
            features.
          </Alert>
          {verificationMutation.isError ? (
            <Alert variant="error">
              {isApiClientError(verificationMutation.error)
                ? verificationMutation.error.message
                : 'The verification email could not be sent. Please try again.'}
            </Alert>
          ) : null}
          {verificationMutation.isSuccess ? (
            <Alert>{verificationMutation.data.message}</Alert>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={verificationMutation.isPending || verificationMutation.isSuccess}
            onClick={() => verificationMutation.mutate()}
          >
            {verificationMutation.isPending ? 'Sending...' : 'Verify Email'}
          </Button>
        </div>
      ) : null}

      <FormField>
        <Label htmlFor="displayName">Display name</Label>
        <Input id="displayName" type="text" autoComplete="name" {...register('displayName')} />
        <FieldError message={errors.displayName?.message} />
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
        {mutation.isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  );
}
