import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Logger } from '../../src/infrastructure/logging/logger.js';
import { createShutdownHandler, handleStartupFailure } from '../../src/server-lifecycle.js';

afterEach(() => vi.useRealTimers());

describe('server lifecycle', () => {
  it('flushes logging after the database closes and before a graceful exit', async () => {
    const logger = mock<Logger>();
    const closeDatabase = vi.fn(async () => undefined);
    const closeLogging = vi.fn(async () => undefined);
    const exit = vi.fn();
    let completeClose: ((error?: Error) => void) | undefined;
    const server = {
      close: vi.fn((callback: (error?: Error) => void) => {
        completeClose = callback;
      }),
    };
    const shutdown = createShutdownHandler({
      server,
      logger,
      closeDatabase,
      closeLogging,
      exit,
    });

    shutdown('SIGTERM');
    completeClose!();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      { signal: 'SIGTERM' },
      'Shutting down gracefully...',
    );
    expect(logger.info).toHaveBeenNthCalledWith(2, 'Shutdown complete.');
    expect(closeDatabase.mock.invocationCallOrder[0]).toBeLessThan(
      closeLogging.mock.invocationCallOrder[0]!,
    );
    expect(closeLogging.mock.invocationCallOrder[0]).toBeLessThan(
      exit.mock.invocationCallOrder[0]!,
    );
  });

  it('still exits when closing the log destination fails', async () => {
    const logger = mock<Logger>();
    const failure = new Error('log close failed');
    const exit = vi.fn();
    const server = {
      close: (callback: (error?: Error) => void) => callback(),
    };
    const shutdown = createShutdownHandler({
      server,
      logger,
      closeDatabase: async () => undefined,
      closeLogging: async () => Promise.reject(failure),
      exit,
    });

    shutdown('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));

    expect(logger.error).toHaveBeenCalledWith(
      { err: failure },
      'Error while closing log destination',
    );
  });

  it('forces exit with fatal severity if logger shutdown hangs', async () => {
    vi.useFakeTimers();
    const logger = mock<Logger>();
    const exit = vi.fn();
    const server = {
      close: (callback: (error?: Error) => void) => callback(),
    };
    const shutdown = createShutdownHandler({
      server,
      logger,
      closeDatabase: async () => undefined,
      closeLogging: () => new Promise(() => undefined),
      exit,
    });

    shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(10_000);

    expect(logger.fatal).toHaveBeenCalledWith('Forced shutdown after timeout.');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('records startup failure as fatal and closes infrastructure', async () => {
    const logger = mock<Logger>();
    const error = new Error('migration failed');
    const closeDatabase = vi.fn(async () => undefined);
    const closeLogging = vi.fn(async () => undefined);

    await handleStartupFailure(error, { logger, closeDatabase, closeLogging });

    expect(logger.fatal).toHaveBeenCalledWith({ err: error }, 'Failed to start API server');
    expect(closeDatabase).toHaveBeenCalledOnce();
    expect(closeLogging).toHaveBeenCalledOnce();
  });
});
