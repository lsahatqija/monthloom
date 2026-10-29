import type {
  CreateHouseholdTransactionRequest,
  TransactionEditScope,
  UpdateHouseholdTransactionRequest,
} from '@monthloom/contracts';

import { AuthorizationError, NotFoundError } from '../../shared/errors/index.js';

import type {
  HouseholdRepository,
  SourceRepository,
  TransactionRepository,
} from './finance.repository.js';
import { requireHouseholdMember } from './household-access.js';

export class TransactionService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly sources: SourceRepository,
    private readonly transactions: TransactionRepository,
  ) {}

  async createTransaction(
    householdId: string,
    requestingUserId: string,
    input: CreateHouseholdTransactionRequest,
  ) {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    if (!(await this.households.isMember(householdId, input.userId))) {
      throw new AuthorizationError('The selected user is not a member of this household.');
    }
    if (!(await this.sources.getSource(householdId, input.sourceId))) {
      throw new NotFoundError(
        'The selected source was not found in this household.',
        'SOURCE_NOT_FOUND',
      );
    }
    return this.transactions.createTransaction(householdId, input);
  }

  async updateTransaction(
    householdId: string,
    transactionId: string,
    requestingUserId: string,
    input: UpdateHouseholdTransactionRequest,
  ) {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    if (!(await this.households.isMember(householdId, input.transaction.userId))) {
      throw new AuthorizationError('The selected user is not a member of this household.');
    }
    if (!(await this.sources.getSource(householdId, input.transaction.sourceId))) {
      throw new NotFoundError(
        'The selected source was not found in this household.',
        'SOURCE_NOT_FOUND',
      );
    }
    const transaction = await this.transactions.updateTransaction(
      householdId,
      transactionId,
      input,
    );
    if (!transaction)
      throw new NotFoundError('Transaction was not found.', 'TRANSACTION_NOT_FOUND');
    return transaction;
  }

  async removeTransaction(
    householdId: string,
    transactionId: string,
    requestingUserId: string,
    scope: TransactionEditScope,
  ): Promise<void> {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    if (!(await this.transactions.removeTransaction(householdId, transactionId, scope))) {
      throw new NotFoundError('Transaction was not found.', 'TRANSACTION_NOT_FOUND');
    }
  }
}
