import path from 'node:path';

import { config } from './config/index.js';
import { db } from './infrastructure/database/client.js';
import { LogEmailSender, ResendEmailSender } from './infrastructure/email/index.js';
import { logger } from './infrastructure/logging/logger.js';
import { LocalFileStorage } from './infrastructure/storage/index.js';
import { PostgresSessionRepository } from './modules/auth/adapters/postgres-session.repository.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { createAuthMiddleware, requireRole } from './modules/auth/auth.middleware.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AutomatedEmailService } from './modules/email/automated-email.service.js';
import { FeedbackController } from './modules/feedback/feedback.controller.js';
import { FeedbackService } from './modules/feedback/feedback.service.js';
import { PostgresFileRepository } from './modules/files/adapters/postgres-file.repository.js';
import { FileController } from './modules/files/file.controller.js';
import { FileService } from './modules/files/file.service.js';
import { PostgresHouseholdRepository } from './modules/finance/adapters/postgres-household.repository.js';
import { PostgresInvitationRepository } from './modules/finance/adapters/postgres-invitation.repository.js';
import { PostgresSourceRepository } from './modules/finance/adapters/postgres-source.repository.js';
import { PostgresTransactionRepository } from './modules/finance/adapters/postgres-transaction.repository.js';
import { FinanceController } from './modules/finance/finance.controller.js';
import { HouseholdService } from './modules/finance/household.service.js';
import { InvitationService } from './modules/finance/invitation.service.js';
import { MonthViewService } from './modules/finance/month-view.service.js';
import { RangeViewService } from './modules/finance/range-view.service.js';
import { SourceService } from './modules/finance/source.service.js';
import { TransactionService } from './modules/finance/transaction.service.js';
import { SystemController } from './modules/system/system.controller.js';
import { SystemService } from './modules/system/system.service.js';
import { PostgresUserRepository } from './modules/users/adapters/postgres-user.repository.js';
import { UserController } from './modules/users/user.controller.js';
import { UserService } from './modules/users/user.service.js';

/**
 * Explicit composition root. Wires repositories, infrastructure adapters, services and
 * controllers together via constructor injection, without a DI framework.
 */
export function buildAppDependencies() {
  const userRepository = new PostgresUserRepository(db);
  const sessionRepository = new PostgresSessionRepository(db);
  const fileRepository = new PostgresFileRepository(db);
  const financeRepositories = {
    households: new PostgresHouseholdRepository(db),
    invitations: new PostgresInvitationRepository(db),
    sources: new PostgresSourceRepository(db),
    transactions: new PostgresTransactionRepository(db),
  };
  const fileStorage = new LocalFileStorage(path.resolve(config.upload.directory));
  const emailSender =
    config.email.transport === 'resend'
      ? new ResendEmailSender(config.email)
      : new LogEmailSender(logger);
  const emailService = new AutomatedEmailService(emailSender);

  const userService = new UserService(userRepository);
  const feedbackService = new FeedbackService(emailService, config.email.feedbackAddress);
  const financeServices = {
    households: new HouseholdService(financeRepositories.households),
    invitations: new InvitationService(
      financeRepositories.households,
      financeRepositories.invitations,
      emailService,
      logger,
    ),
    monthView: new MonthViewService(
      financeRepositories.households,
      financeRepositories.sources,
      financeRepositories.transactions,
    ),
    rangeView: new RangeViewService(
      financeRepositories.households,
      financeRepositories.sources,
      financeRepositories.transactions,
    ),
    sources: new SourceService(financeRepositories.households, financeRepositories.sources),
    transactions: new TransactionService(
      financeRepositories.households,
      financeRepositories.sources,
      financeRepositories.transactions,
    ),
  };
  const authService = new AuthService(userRepository, sessionRepository, emailService, logger);
  const fileService = new FileService(fileRepository, fileStorage);
  const systemService = new SystemService();

  const { requireAuth, optionalAuth } = createAuthMiddleware(authService);

  const userController = new UserController(userService);
  const authController = new AuthController(authService);
  const fileController = new FileController(fileService);
  const financeController = new FinanceController(financeServices);
  const systemController = new SystemController(systemService);
  const feedbackController = new FeedbackController(feedbackService);

  return {
    controllers: {
      userController,
      authController,
      fileController,
      financeController,
      systemController,
      feedbackController,
    },
    middleware: { requireAuth, optionalAuth, requireRole },
  };
}

export type AppDependencies = ReturnType<typeof buildAppDependencies>;
