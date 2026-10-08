import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach } from 'vitest';

const baseUrl = new URL(
  process.env.TEST_DATABASE_URL ??
    'postgres://monthloom_test:monthloom_test@127.0.0.1:55432/monthloom_test',
);
if (baseUrl.pathname !== '/monthloom_test') {
  throw new Error('TEST_DATABASE_URL must target the dedicated monthloom_test database.');
}
// Each file gets a newly created database. Never migrate/truncate the supplied base database.
const databaseName = `monthloom_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString: baseUrl.toString(), connectionTimeoutMillis: 5000 });
baseUrl.pathname = `/${databaseName}`;
process.env.DATABASE_URL = baseUrl.toString();
const uploadDirectory = await mkdtemp(path.join(tmpdir(), 'monthloom-test-'));
process.env.UPLOAD_DIR = uploadDirectory;
let created = false;

beforeAll(async () => {
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const { runDatabaseMigrations } =
      await import('../src/infrastructure/database/migration-runner.js');
    await runDatabaseMigrations();
  } catch (error) {
    throw new Error(
      'Integration database setup failed. Run pnpm test:db:up; the test role needs CREATEDB.',
      { cause: error },
    );
  }
});

beforeEach(async () => {
  const { pool } = await import('../src/infrastructure/database/client.js');
  await pool.query('TRUNCATE TABLE users CASCADE');
});

afterAll(async () => {
  try {
    const { closeDatabaseConnection } = await import('../src/infrastructure/database/client.js');
    await closeDatabaseConnection();
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  } finally {
    await admin.end();
    await rm(uploadDirectory, { recursive: true, force: true });
  }
});
