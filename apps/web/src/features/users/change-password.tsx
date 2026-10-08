'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { changePasswordRequestSchema, type ChangePasswordRequest } from '@template/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, Button, FieldError, FormField, Input, Label } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { changePassword } from './users.api';

export function ChangePassword() {
  const [isOpen, setIsOpen] = useState(false);
  const [wasChanged, setWasChanged] = useState(false);

  return (
    <>
      {wasChanged ? <Alert>Password changed successfully.</Alert> : null}
      <div className="settingsPanel settingsSecurityPanel">
        <div>
          <h3>Password</h3>
          <p>Update the password you use to sign in.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setWasChanged(false);
            setIsOpen(true);
          }}
        >
          Change Password
        </Button>
      </div>
      {isOpen ? (
        <ChangePasswordModal
          onClose={() => setIsOpen(false)}
          onChanged={() => {
            setIsOpen(false);
            setWasChanged(true);
          }}
        />
      ) : null}
    </>
  );
}

function ChangePasswordModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
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
    mutationFn: changePassword,
    onSuccess: onChanged,
    onError: (error) => {
      if (isApiClientError(error) && error.details?.currentPassword?.[0]) {
        setError(
          'currentPassword',
          { message: error.details.currentPassword[0] },
          { shouldFocus: true },
        );
        return;
      }
      setError('root', {
        message: isApiClientError(error)
          ? error.message
          : 'Something went wrong. Please try again.',
      });
    },
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.isPending) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mutation.isPending, onClose]);

  return (
    <div
      className="transactionModalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <section
        className="transactionModal changePasswordModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        <div className="transactionModalHeader">
          <div>
            <p className="transactionModalEyebrow">Account security</p>
            <h2 id="change-password-title">Change Password</h2>
          </div>
          <button
            type="button"
            className="modalCloseButton"
            disabled={mutation.isPending}
            onClick={onClose}
            aria-label="Close change password modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form
          className="transactionForm"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          {errors.root?.message ? <Alert variant="error">{errors.root.message}</Alert> : null}

          <FormField>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              autoFocus
              disabled={mutation.isPending}
              {...register('currentPassword')}
            />
            <FieldError message={errors.currentPassword?.message} />
          </FormField>

          <FormField>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              disabled={mutation.isPending}
              {...register('newPassword')}
            />
            <FieldError message={errors.newPassword?.message} />
          </FormField>

          <FormField>
            <Label htmlFor="confirmNewPassword">Confirm new password</Label>
            <Input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              disabled={mutation.isPending}
              {...register('confirmNewPassword')}
            />
            <FieldError message={errors.confirmNewPassword?.message} />
          </FormField>

          <div className="transactionFormActions">
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Changing…' : 'Change Password'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
