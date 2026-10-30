import assert from 'node:assert/strict';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { logger } from '../logging/logger.js';
import { hashPassword } from '../security/password.js';

import { closeDatabaseConnection, db } from './client.js';
import { expenses, householdMembers, households, incomes, sources, users } from './schema/index.js';

const TEST_USER_EMAIL = 'test@user.com';
const TEST_USER_PASSWORD = 'test1234';
const TEST_HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000001';
const TEST_SOURCES = [
  ['00000000-0000-4000-8000-000000000101', 'Salary'],
  ['00000000-0000-4000-8000-000000000102', 'Supermarket'],
  ['00000000-0000-4000-8000-000000000103', 'Rent'],
  ['00000000-0000-4000-8000-000000000104', 'Utilities'],
  ['00000000-0000-4000-8000-000000000105', 'Transport'],
  ['00000000-0000-4000-8000-000000000106', 'Restaurants'],
  ['00000000-0000-4000-8000-000000000107', 'Shopping'],
  ['00000000-0000-4000-8000-000000000108', 'Leisure'],
] as const;

const EXPENSE_TEMPLATES = [
  { source: 1, type: 'groceries', icon: 'shopping-basket', color: '#65a30d', min: 8, max: 95 },
  { source: 2, type: 'housing', icon: 'house', color: '#4f46e5', min: 850, max: 1050 },
  { source: 3, type: 'utilities', icon: 'plug', color: '#0284c7', min: 25, max: 130 },
  { source: 4, type: 'transport', icon: 'bus', color: '#d97706', min: 3, max: 70 },
  { source: 5, type: 'dining', icon: 'utensils', color: '#dc2626', min: 9, max: 85 },
  { source: 6, type: 'shopping', icon: 'shopping-bag', color: '#bf33ea', min: 12, max: 180 },
  { source: 7, type: 'entertainment', icon: 'film', color: '#0d9488', min: 7, max: 75 },
] as const;

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function monthDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function testTransactions(userId: string) {
  const random = seededRandom(20261030);
  const now = new Date();
  const seeded = { expenses: [], incomes: [] } as {
    expenses: (typeof expenses.$inferInsert)[];
    incomes: (typeof incomes.$inferInsert)[];
  };

  for (let monthOffset = 0; monthOffset < 2; monthOffset += 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    seeded.incomes.push(
      {
        householdId: TEST_HOUSEHOLD_ID,
        sourceId: TEST_SOURCES[0][0],
        userId,
        icon: 'briefcase',
        color: '#048d36',
        amount: (2800 + Math.floor(random() * 500)).toFixed(2),
        date: monthDate(year, month, 1),
      },
      {
        householdId: TEST_HOUSEHOLD_ID,
        sourceId: TEST_SOURCES[0][0],
        userId,
        icon: 'coins',
        color: '#0d9488',
        amount: (50 + random() * 250).toFixed(2),
        date: monthDate(year, month, 15),
      },
    );

    for (let index = 0; index < 30; index += 1) {
      const template = EXPENSE_TEMPLATES[Math.floor(random() * EXPENSE_TEMPLATES.length)];
      assert(template);
      const amount = template.min + random() * (template.max - template.min);
      seeded.expenses.push({
        householdId: TEST_HOUSEHOLD_ID,
        sourceId: TEST_SOURCES[template.source][0],
        userId,
        type: template.type,
        icon: template.icon,
        color: template.color,
        amount: amount.toFixed(2),
        date: monthDate(year, month, 1 + Math.floor(random() * daysInMonth)),
      });
    }
  }

  assert.equal(seeded.expenses.length + seeded.incomes.length, 64);
  return seeded;
}

/**
 * Seed data is strictly for local development. It is never created in production and
 * every credential is configurable through environment variables rather than hard-coded.
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

    logger.info(`Seeded development user: ${seedUser.email} (development credentials only)`);
  }

  const passwordHash = await hashPassword(TEST_USER_PASSWORD);
  const [testUser] = await db
    .insert(users)
    .values({
      email: TEST_USER_EMAIL,
      emailVerified: true,
      passwordHash,
      displayName: 'Test User',
      role: 'user',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { emailVerified: true, passwordHash, displayName: 'Test User', role: 'user' },
    })
    .returning({ id: users.id });
  assert(testUser);

  const transactions = testTransactions(testUser.id);
  await db.transaction(async (transaction) => {
    await transaction.delete(households).where(eq(households.id, TEST_HOUSEHOLD_ID));
    await transaction.insert(households).values({
      id: TEST_HOUSEHOLD_ID,
      name: 'Test Household',
      currency: 'EUR',
      icon: 'family-house',
      color: '#35675b',
      ownerId: testUser.id,
    });
    await transaction.insert(householdMembers).values({
      householdId: TEST_HOUSEHOLD_ID,
      userId: testUser.id,
      isPrimary: false,
    });
    await transaction.insert(sources).values(
      TEST_SOURCES.map(([id, displayName]) => ({
        id,
        householdId: TEST_HOUSEHOLD_ID,
        displayName,
        key: displayName.toLowerCase(),
        aliases: [displayName],
      })),
    );
    await transaction.insert(incomes).values(transactions.incomes);
    await transaction.insert(expenses).values(transactions.expenses);
  });

  logger.info(
    `Seeded ${TEST_USER_EMAIL} with Test Household and 32 transactions in each of two months`,
  );

  await closeDatabaseConnection();
}

run().catch((error) => {
  logger.error({ err: error }, 'Database seeding failed');
  process.exitCode = 1;
});
