import rateLimit from 'express-rate-limit';

import { config } from '../config/index.js';

/** General-purpose API rate limiter applied to the whole `/api` surface. */
export const generalRateLimiter = rateLimit({
  windowMs: config.rateLimit.general.windowMinutes * 60 * 1000,
  limit: config.rateLimit.general.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

/** Stricter limiter for authentication endpoints, to slow down credential guessing. */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.authentication.windowMinutes * 60 * 1000,
  limit: config.rateLimit.authentication.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Please try again later.' },
  },
});

/** Limits password-reset requests separately from credential attempts. */
export const passwordResetRateLimiter = rateLimit({
  windowMs: config.rateLimit.passwordReset.windowMinutes * 60 * 1000,
  limit: config.rateLimit.passwordReset.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many password reset attempts. Please try again later.',
    },
  },
});

/** Limits verification-link requests separately from other authentication activity. */
export const emailVerificationRateLimiter = rateLimit({
  windowMs: config.rateLimit.emailVerification.windowMinutes * 60 * 1000,
  limit: config.rateLimit.emailVerification.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many email verification attempts. Please try again later.',
    },
  },
});
