import assert from 'node:assert/strict';

import { inArray } from 'drizzle-orm';
import { z } from 'zod';

import { logger } from '../logging/logger.js';
import { hashPassword } from '../security/password.js';

import { closeDatabaseConnection, db } from './client.js';
import { expenses, householdMembers, households, incomes, sources, users } from './schema/index.js';
import { generateHouseholdTransactions } from './seed-data.js';

const TEST_USER_PASSWORD = 'testtest';
const TEST_HOUSEHOLDS = [
  'City Flat',
  'Family Home',
  'Lake House',
  'Shared Loft',
  'Garden Cottage',
].map((name, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name,
  color: ['#35675b', '#4f46e5', '#b45309', '#9f1239', '#0369a1'][index]!,
}));
const SOURCE_NAMES = [
  'Salary',
  'Supermarket',
  'Rent',
  'Utilities',
  'Transport',
  'Restaurants',
  'Shopping',
  'Leisure',
];

/**
 * Seed data is strictly for local development and is never created in production.
 * Demo graph accounts intentionally use the fixed credentials requested for local testing.
 */
const seedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@example.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('DevAdminPass123!'),
  SEED_USER_EMAIL: z.string().email().default('user@example.local'),
  SEED_USER_PASSWORD: z.string().min(8).default('DevUserPass123!'),
});

async function run(): Promise<void> {
  const env = seedEnvSchema.parse(process.env);

  if (env.NODE_ENV === 'production') {
    logger.error('Refusing to run development seed data in production.');
    process.exitCode = 1;
    return;
  }

  const seedUsers = [
    {
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      password: env.SEED_ADMIN_PASSWORD,
      displayName: 'Development Admin',
      role: 'admin' as const,
    },
    {
      email: env.SEED_USER_EMAIL.toLowerCase(),
      password: env.SEED_USER_PASSWORD,
      displayName: 'Development User',
      role: 'user' as const,
    },
  ];

  for (const seedUser of seedUsers) {
    const passwordHash = await hashPassword(seedUser.password);
    await db
      .insert(users)
      .values({
        email: seedUser.email,
        passwordHash,
        displayName: seedUser.displayName,
        role: seedUser.role,
      })
      .onConflictDoNothing({ target: users.email });

    logger.info('Seeded development user fixture');
  }

  const testPasswordHash = await hashPassword(TEST_USER_PASSWORD);
  const testUsers: { id: string }[] = [];
  for (let index = 1; index <= 5; index += 1) {
    const email = `test${index}@email.com`;
    const [testUser] = await db
      .insert(users)
      .values({
        email,
        emailVerified: true,
        passwordHash: testPasswordHash,
        displayName: `Test User ${index}`,
        role: 'user',
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          emailVerified: true,
          passwordHash: testPasswordHash,
          displayName: `Test User ${index}`,
          role: 'user',
        },
      })
      .returning({ id: users.id });
    assert(testUser);
    testUsers.push(testUser);
  }

  await db.transaction(async (transaction) => {
    await transaction.delete(households).where(
      inArray(
        households.id,
        TEST_HOUSEHOLDS.map(({ id }) => id),
      ),
    );

    for (const [index, household] of TEST_HOUSEHOLDS.entries()) {
      const memberIds = [0, 1, 2].map(
        (offset) => testUsers[(index + offset) % testUsers.length]!.id,
      );
      const sourceIds = SOURCE_NAMES.map(
        (_, sourceIndex) =>
          `00000000-0000-4000-8000-${String((index + 1) * 100 + sourceIndex + 1).padStart(12, '0')}`,
      );
      await transaction.insert(households).values({
        ...household,
        currency: 'EUR',
        icon: 'family-house',
        ownerId: testUsers[index]!.id,
      });
      await transaction
        .insert(householdMembers)
        .values(
          memberIds.map((userId) => ({ householdId: household.id, userId, isPrimary: false })),
        );
      await transaction.insert(sources).values(
        SOURCE_NAMES.map((displayName, sourceIndex) => ({
          id: sourceIds[sourceIndex]!,
          householdId: household.id,
          displayName,
          key: displayName.toLowerCase(),
          aliases: [displayName],
        })),
      );

      const generated = generateHouseholdTransactions({
        householdId: household.id,
        memberIds,
        sourceIds,
        now: new Date(),
        seed: 20261101 + index,
      });
      await transaction.insert(incomes).values(generated.incomes);
      await transaction.insert(expenses).values(generated.expenses);
    }
  });

  logger.info('Seeded development finance fixtures');

  await closeDatabaseConnection();
}

run().catch((error) => {
  logger.error({ err: error }, 'Database seeding failed');
  process.exitCode = 1;
});
