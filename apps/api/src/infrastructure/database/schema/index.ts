import { relations } from 'drizzle-orm';

import { files } from './files.js';
import { householdInvitations, householdMembers, households } from './households.js';
import { emailVerificationTokens, passwordResetTokens, sessions, users } from './identity.js';
import { expenses, incomes, sources } from './transactions.js';

export * from './identity.js';
export * from './files.js';
export * from './households.js';
export * from './transactions.js';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  passwordResetTokens: many(passwordResetTokens),
  emailVerificationTokens: many(emailVerificationTokens),
  files: many(files),
  householdMemberships: many(householdMembers),
  incomes: many(incomes),
  expenses: many(expenses),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, { fields: [emailVerificationTokens.userId], references: [users.id] }),
  }),
);

export const filesRelations = relations(files, ({ one }) => ({
  owner: one(users, { fields: [files.ownerId], references: [users.id] }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  invitations: many(householdInvitations),
  sources: many(sources),
  incomes: many(incomes),
  expenses: many(expenses),
}));

export const householdInvitationsRelations = relations(householdInvitations, ({ one }) => ({
  household: one(households, {
    fields: [householdInvitations.householdId],
    references: [households.id],
  }),
  createdBy: one(users, {
    fields: [householdInvitations.createdById],
    references: [users.id],
    relationName: 'createdHouseholdInvitations',
  }),
  acceptedBy: one(users, {
    fields: [householdInvitations.acceptedById],
    references: [users.id],
    relationName: 'acceptedHouseholdInvitations',
  }),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  household: one(households, {
    fields: [householdMembers.householdId],
    references: [households.id],
  }),
  user: one(users, { fields: [householdMembers.userId], references: [users.id] }),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  household: one(households, { fields: [sources.householdId], references: [households.id] }),
  incomes: many(incomes),
  expenses: many(expenses),
}));

export const incomesRelations = relations(incomes, ({ one }) => ({
  household: one(households, { fields: [incomes.householdId], references: [households.id] }),
  source: one(sources, { fields: [incomes.sourceId], references: [sources.id] }),
  user: one(users, { fields: [incomes.userId], references: [users.id] }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  household: one(households, { fields: [expenses.householdId], references: [households.id] }),
  source: one(sources, { fields: [expenses.sourceId], references: [sources.id] }),
  user: one(users, { fields: [expenses.userId], references: [users.id] }),
}));

