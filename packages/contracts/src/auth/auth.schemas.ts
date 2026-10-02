import { z } from 'zod';

import { Constants } from '../constants.js';
import { desiredColorSchema, profileImageSchema, publicUserSchema } from '../users/user.schemas.js';

const passwordSchema = z
  .string()
  .min(
    Constants.PASSWORD_MIN_LENGTH,
    `Password must be at least ${Constants.PASSWORD_MIN_LENGTH} characters long`,
  )
  .max(Constants.PASSWORD_MAX_LENGTH, 'Password is too long');

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email address').max(Constants.EMAIL_MAX_LENGTH),
  password: passwordSchema,
  displayName: z
    .string()
    .min(Constants.DISPLAY_NAME_MIN_LENGTH, 'Display name is required')
    .max(Constants.DISPLAY_NAME_MAX_LENGTH),
  profileImage: profileImageSchema,
  desiredColor: desiredColorSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email address').max(Constants.EMAIL_MAX_LENGTH),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Response returned by register/login/me. The session token itself only ever travels via cookie. */
export const authResponseSchema = z.object({
  user: publicUserSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({
  user: publicUserSchema.nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
