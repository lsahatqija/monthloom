import type { Request, Response } from 'express';

import { config } from '../../config/index.js';

import { clearSessionCookie, setSessionCookie } from './auth.cookies.js';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from './auth.schemas.js';
import {
  EMAIL_VERIFICATION_SENT_MESSAGE,
  EMAIL_VERIFIED_MESSAGE,
  PASSWORD_RESET_REQUEST_MESSAGE,
  type AuthService,
} from './auth.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const input = registerRequestSchema.parse(req.body);
    const { user, sessionToken } = await this.authService.register(input);
    setSessionCookie(res, sessionToken);
    res.status(201).json({ user });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const input = loginRequestSchema.parse(req.body);
    const { user, sessionToken } = await this.authService.login(input);
    setSessionCookie(res, sessionToken);
    res.status(200).json({ user });
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const input = forgotPasswordRequestSchema.parse(req.body);
    await this.authService.requestPasswordReset(input);
    res.status(202).json({ message: PASSWORD_RESET_REQUEST_MESSAGE });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const input = resetPasswordRequestSchema.parse(req.body);
    await this.authService.resetPassword(input);
    clearSessionCookie(res);
    res.status(204).send();
  };

  sendEmailVerification = async (req: Request, res: Response): Promise<void> => {
    await this.authService.sendEmailVerification(req.authUser!.id);
    res.status(202).json({ message: EMAIL_VERIFICATION_SENT_MESSAGE });
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const input = verifyEmailRequestSchema.parse(req.body);
    await this.authService.verifyEmail(input);
    res.status(200).json({ message: EMAIL_VERIFIED_MESSAGE });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies?.[config.session.cookieName] as string | undefined;
    if (token) {
      await this.authService.logout(token);
    }
    clearSessionCookie(res);
    res.status(204).send();
  };

  me = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({ user: req.authUser ?? null });
  };
}
