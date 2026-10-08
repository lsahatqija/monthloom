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

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(Constants.EMAIL_MAX_LENGTH),
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordResponseSchema = z.object({ message: z.string() });
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const emailVerificationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid email verification token');

export const verifyEmailRequestSchema = z.object({ token: emailVerificationTokenSchema });
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const emailVerificationResponseSchema = z.object({ message: z.string() });
export type EmailVerificationResponse = z.infer<typeof emailVerificationResponseSchema>;

export const passwordResetTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid password reset token');

export const newPasswordFieldsSchema = z
  .object({
    newPassword: passwordSchema,
    confirmNewPassword: passwordSchema,
  })
  .refine((input) => input.newPassword === input.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export const resetPasswordRequestSchema = z.intersection(
  z.object({ token: passwordResetTokenSchema }),
  newPasswordFieldsSchema,
);

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

/** Response returned by register/login/me. The session token itself only ever travels via cookie. */
export const authResponseSchema = z.object({
  user: publicUserSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({
  user: publicUserSchema.nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
