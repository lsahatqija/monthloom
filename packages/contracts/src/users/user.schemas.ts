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
