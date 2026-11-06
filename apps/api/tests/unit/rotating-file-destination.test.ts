import { EventEmitter } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createRotatingFileDestination,
  deleteExpiredLogFiles,
  millisecondsUntilNextUtcMidnight,
  utcDateStamp,
} from '../../src/infrastructure/logging/rotating-file-destination.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'monthloom-logging-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('rotating file destination', () => {
  it('calculates date stamps and the next boundary in UTC', () => {
    const now = new Date('2026-11-06T23:59:59.500Z');

    expect(utcDateStamp(now)).toBe('2026-11-06');
    expect(millisecondsUntilNextUtcMidnight(now)).toBe(500);
  });

  it('deletes a log on day 91 while retaining the latest 90 complete days', async () => {
    const directory = await createTemporaryDirectory();
    const expired = path.join(directory, 'server.2026-08-07.log');
    const retained = path.join(directory, 'server.2026-08-08.log');
    const unrelated = path.join(directory, 'notes.log');
    await Promise.all([
      writeFile(expired, 'expired'),
      writeFile(retained, 'retained'),
      writeFile(unrelated, 'unrelated'),
    ]);

    const removed = await deleteExpiredLogFiles(directory, new Date('2026-11-06T00:00:00.000Z'));

    expect(removed).toEqual([expired]);
    await expect(stat(expired)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(retained, 'utf8')).resolves.toBe('retained');
    await expect(readFile(unrelated, 'utf8')).resolves.toBe('unrelated');
  });

  it('writes to the UTC-dated file and exposes it through current.log', async () => {
    const directory = await createTemporaryDirectory();
    const destination = await createRotatingFileDestination({
      directory,
      now: () => new Date('2026-11-06T12:00:00.000Z'),
      schedule: false,
    });

    destination.write('{"message":"first"}\n');
    await destination.flush();

    const datedFile = path.join(directory, 'server.2026-11-06.log');
    await expect(readFile(datedFile, 'utf8')).resolves.toBe('{"message":"first"}\n');
    await expect(readFile(path.join(directory, 'current.log'), 'utf8')).resolves.toBe(
      '{"message":"first"}\n',
    );

    if (process.platform !== 'win32') {
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      expect((await stat(datedFile)).mode & 0o777).toBe(0o600);
    }

    await destination.close();
  });

  it('rotates to a new file and flushes writes made before close', async () => {
    const directory = await createTemporaryDirectory();
    let now = new Date('2026-11-06T23:59:59.000Z');
    const destination = await createRotatingFileDestination({
      directory,
      now: () => now,
      schedule: false,
    });

    destination.write('day-one\n');
    now = new Date('2026-11-07T00:00:00.000Z');
    await destination.rotate();
    destination.write('day-two\n');
    await destination.close();

    await expect(readFile(path.join(directory, 'server.2026-11-06.log'), 'utf8')).resolves.toBe(
      'day-one\n',
    );
    await expect(readFile(path.join(directory, 'server.2026-11-07.log'), 'utf8')).resolves.toBe(
      'day-two\n',
    );
    await expect(readFile(path.join(directory, 'current.log'), 'utf8')).resolves.toBe('day-two\n');
  });

  it('rotates at UTC midnight without waiting for another write', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T23:59:59.500Z'));
    const directory = await createTemporaryDirectory();
    const destination = await createRotatingFileDestination({ directory });
    destination.write('before-midnight\n');

    await vi.advanceTimersByTimeAsync(500);
    await destination.flush();
    destination.write('after-midnight\n');
    await destination.close();

    await expect(readFile(path.join(directory, 'server.2026-11-06.log'), 'utf8')).resolves.toBe(
      'before-midnight\n',
    );
    await expect(readFile(path.join(directory, 'server.2026-11-07.log'), 'utf8')).resolves.toBe(
      'after-midnight\n',
    );
  });

  it('fails open when the destination cannot be initialized', async () => {
    const parent = await createTemporaryDirectory();
    const invalidDirectory = path.join(parent, 'not-a-directory');
    await writeFile(invalidDirectory, 'occupied');
    const reportFailure = vi.fn();

    const destination = await createRotatingFileDestination({
      directory: invalidDirectory,
      reportFailure,
      schedule: false,
    });

    expect(destination.healthy).toBe(false);
    expect(reportFailure).toHaveBeenCalledOnce();
    expect(() => destination.write('discarded\n')).not.toThrow();
    await expect(destination.close()).resolves.toBeUndefined();
  });

  it('fails open and reports once when an active stream errors', async () => {
    const directory = await createTemporaryDirectory();
    const reportFailure = vi.fn();
    let stream: EventEmitter | undefined;
    const destination = await createRotatingFileDestination({
      directory,
      reportFailure,
      schedule: false,
      streamFactory: (filePath, options) => {
        const created = createWriteStream(filePath, options);
        stream = created;
        return created;
      },
    });

    stream!.emit('error', new Error('disk unavailable'));
    stream!.emit('error', new Error('still unavailable'));

    expect(destination.healthy).toBe(false);
    expect(reportFailure).toHaveBeenCalledOnce();
    expect(() => destination.write('discarded\n')).not.toThrow();
    await expect(destination.close()).resolves.toBeUndefined();
  });
});
