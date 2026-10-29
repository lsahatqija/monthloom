import type {
  CopyHouseholdSourcesRequest,
  CreateHouseholdSourceRequest,
  UpdateHouseholdSourceRequest,
} from '@monthloom/contracts';

import { AuthorizationError, ConflictError, NotFoundError } from '../../shared/errors/index.js';

import type { HouseholdRepository, SourceRepository } from './finance.repository.js';
import { requireHouseholdMember } from './household-access.js';

export class SourceService {
  constructor(
    private readonly households: HouseholdRepository,
    private readonly sources: SourceRepository,
  ) {}

  async createSource(
    householdId: string,
    requestingUserId: string,
    input: CreateHouseholdSourceRequest,
  ) {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    const source = await this.sources.createSource(householdId, input);
    if (!source)
      throw new ConflictError(
        'A source with this display name already exists.',
        'SOURCE_NAME_CONFLICT',
      );
    return source;
  }

  async listSources(householdId: string, requestingUserId: string) {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    return this.sources.getSources(householdId);
  }

  async updateSource(
    householdId: string,
    sourceId: string,
    requestingUserId: string,
    input: UpdateHouseholdSourceRequest,
  ) {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    const source = await this.sources.updateSource(householdId, sourceId, input);
    if (source === 'not_found')
      throw new NotFoundError('Source was not found.', 'SOURCE_NOT_FOUND');
    if (source === 'conflict') {
      throw new ConflictError(
        'A source with this display name already exists.',
        'SOURCE_NAME_CONFLICT',
      );
    }
    return source;
  }

  async deleteSource(
    householdId: string,
    sourceId: string,
    requestingUserId: string,
  ): Promise<void> {
    await requireHouseholdMember(this.households, householdId, requestingUserId);
    const result = await this.sources.deleteSource(householdId, sourceId);
    if (result === 'not_found')
      throw new NotFoundError('Source was not found.', 'SOURCE_NOT_FOUND');
    if (result === 'in_use') {
      throw new ConflictError('Sources used by transactions cannot be deleted.', 'SOURCE_IN_USE');
    }
  }

  async copySources(
    sourceHouseholdId: string,
    requestingUserId: string,
    input: CopyHouseholdSourcesRequest,
  ) {
    if (sourceHouseholdId === input.targetHouseholdId) {
      throw new ConflictError('Choose two different households.');
    }
    const [canReadSource, canWriteTarget] = await Promise.all([
      this.households.isMember(sourceHouseholdId, requestingUserId),
      this.households.isMember(input.targetHouseholdId, requestingUserId),
    ]);
    if (!canReadSource || !canWriteTarget) {
      throw new AuthorizationError('You must be a member of both households.');
    }
    const result = await this.sources.copySources(
      sourceHouseholdId,
      input.targetHouseholdId,
      input.sourceIds,
    );
    if (!result)
      throw new NotFoundError('One or more selected sources were not found.', 'SOURCE_NOT_FOUND');
    return result;
  }
}
