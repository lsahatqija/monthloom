import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from '../common/identifiers.js';
import { Constants } from '../constants.js';

export const userRoleSchema = z.enum(Constants.USER_ROLES);

export type UserRole = z.infer<typeof userRoleSchema>;

export const profileImageSchema = z.enum(Constants.PROFILE_IMAGES);
export type ProfileImage = z.infer<typeof profileImageSchema>;

export const desiredColorSchema = z.enum(Constants.DESIRED_COLORS);
export type DesiredColor = z.infer<typeof desiredColorSchema>;

/** Public user representation. Never includes the password hash or any secret. */
export const publicUserSchema = z.object({
  id: idSchema,
  email: z.string().email().max(Constants.EMAIL_MAX_LENGTH),
  emailVerified: z.boolean(),
  displayName: z
    .string()
    .min(Constants.DISPLAY_NAME_MIN_LENGTH)
    .max(Constants.DISPLAY_NAME_MAX_LENGTH),
  profileImage: profileImageSchema,
  desiredColor: desiredColorSchema,
  role: userRoleSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type PublicUser = z.infer<typeof publicUserSchema>;

export const updateProfileRequestSchema = z.object({
  displayName: z
    .string()
    .min(Constants.DISPLAY_NAME_MIN_LENGTH, 'Display name is required')
    .max(Constants.DISPLAY_NAME_MAX_LENGTH),
  profileImage: profileImageSchema,
  desiredColor: desiredColorSchema,
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(
        Constants.PASSWORD_MIN_LENGTH,
        `Password must be at least ${Constants.PASSWORD_MIN_LENGTH} characters long`,
      )
      .max(Constants.PASSWORD_MAX_LENGTH, 'Password is too long'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((input) => input.newPassword === input.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
