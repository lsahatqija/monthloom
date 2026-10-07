'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  type CreateHouseholdRequest,
  type ManagedHousehold,
  type PublicUser,
  type UpdateHouseholdRequest,
} from '@template/contracts';
import { useState } from 'react';

import { ProfileImage } from '../../components/profile-image';
import { Alert, Button, Input, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import {
  createHousehold,
  createHouseholdInvitation,
  deleteHousehold,
  financeKeys,
  getHouseholds,
  leaveHousehold,
  removeHouseholdMember,
  setPrimaryHousehold,
  updateHousehold,
} from './finance.api';
import { FinancialIcon, financialIconLabel } from './financial-icon';
import { SourceSettings } from './source-settings';

type FinancialIconName = (typeof Constants.FINANCIAL_ICONS)[number];

const defaultHousehold: CreateHouseholdRequest = {
  name: '',
  icon: 'house',
  color: '#35675b',
};

function errorMessage(error: unknown): string {
  return isApiClientError(error) ? error.message : 'Something went wrong. Please try again.';
}

function HouseholdFields({
  value,
  onChange,
  prefix,
}: {
  value: CreateHouseholdRequest;
  onChange: (value: CreateHouseholdRequest) => void;
  prefix: string;
}) {
  return (
    <div className="householdFields">
      <label>
        <span>Name</span>
        <Input
          id={`${prefix}-name`}
          value={value.name}
          maxLength={Constants.HOUSEHOLD_NAME_MAX_LENGTH}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </label>
      <label>
        <span>Icon</span>
        <span className="householdIconSelect">
          <FinancialIcon name={value.icon} />
          <select
            id={`${prefix}-icon`}
            value={value.icon}
            onChange={(event) =>
              onChange({ ...value, icon: event.target.value as FinancialIconName })
            }
          >
            {Constants.FINANCIAL_ICONS.map((icon) => (
              <option key={icon} value={icon}>
                {financialIconLabel(icon)}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label>
        <span>Color</span>
        <input
          id={`${prefix}-color`}
          className="householdColorInput"
          type="color"
          value={value.color}
          onChange={(event) => onChange({ ...value, color: event.target.value })}
        />
      </label>
    </div>
  );
}

function HouseholdCard({ household, user }: { household: ManagedHousehold; user: PublicUser }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CreateHouseholdRequest>({
    name: household.name,
    icon: household.icon,
    color: household.color,
  });
  const [newOwnerId, setNewOwnerId] = useState(
    household.members.find((member) => member.id !== user.id)?.id ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy link');
  const isOwner = household.ownerId === user.id;
  const refresh = () => queryClient.invalidateQueries({ queryKey: financeKeys.all });
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      setError(null);
      setEditing(false);
      await refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const save = () => {
    const input: UpdateHouseholdRequest = {
      name: draft.name,
      icon: draft.icon,
      color: draft.color,
    };
    mutation.mutate(() => updateHousehold(household.id, input));
  };

  const createInvitation = () => {
    mutation.mutate(async () => {
      const invitation = await createHouseholdInvitation(household.id);
      const link = `${window.location.origin}/invite/${invitation.token}`;
      setInvitationLink(link);
      setCopyLabel('Copy link');
    });
  };

  const leave = () => {
    if (isOwner && household.members.length === 1) return;
    const transferTo = isOwner ? newOwnerId : undefined;
    if (isOwner && !transferTo) {
      setError('Select a new owner before leaving.');
      return;
    }
    if (window.confirm(`Leave ${household.name}?`)) {
      mutation.mutate(() => leaveHousehold(household.id, transferTo));
    }
  };

  return (
    <article className="householdCard">
      <div className="householdCardHeader">
        <span className="householdBadge" style={{ backgroundColor: household.color }}>
          <FinancialIcon name={household.icon} size={24} />
        </span>
        <div>
          <h3>{household.name}</h3>
          <p>
            {household.members.length} {household.members.length === 1 ? 'member' : 'members'}
            {household.isPrimary ? ' · Default household' : ''}
          </p>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {editing ? (
        <div className="householdEditPanel">
          <HouseholdFields value={draft} onChange={setDraft} prefix={`edit-${household.id}`} />
          <div className="householdActions">
            <Button onClick={save} disabled={mutation.isPending || !draft.name.trim()}>
              Save
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="householdActions">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {!household.isPrimary ? (
            <Button
              variant="secondary"
              onClick={() => mutation.mutate(() => setPrimaryHousehold(household.id))}
              disabled={mutation.isPending}
            >
              Make default
            </Button>
          ) : null}
        </div>
      )}

      <div className="householdMembers">
        <div className="householdMembersHeading">
          <h4>Members</h4>
          <Button variant="secondary" onClick={createInvitation} disabled={mutation.isPending}>
            Create invitation link
          </Button>
        </div>
        {invitationLink ? (
          <div className="householdInvitationLink">
            <Input value={invitationLink} readOnly aria-label="Household invitation link" />
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(invitationLink);
                  setCopyLabel('Copied!');
                } catch {
                  setCopyLabel('Select and copy');
                }
              }}
            >
              {copyLabel}
            </Button>
            <small>This single-use link expires in one hour.</small>
          </div>
        ) : null}
        <ul>
          {household.members.map((member) => (
            <li key={member.id}>
              <ProfileImage image={member.profileImage} color={member.desiredColor} size={36} />
              <span>
                <strong>{member.displayName}</strong>
                <small>
                  {member.id === household.ownerId ? 'Owner' : 'Member'}
                  {member.id === user.id ? ' · You' : ''}
                </small>
              </span>
              {isOwner && member.id !== user.id ? (
                <button
                  type="button"
                  className="textDangerButton"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove ${member.displayName} from ${household.name}?`)) {
                      mutation.mutate(() => removeHouseholdMember(household.id, member.id));
                    }
                  }}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="householdDangerZone">
        {isOwner && household.members.length > 1 ? (
          <label>
            <span>Transfer ownership before leaving</span>
            <select value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)}>
              {household.members
                .filter((member) => member.id !== user.id)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="textDangerButton"
          onClick={leave}
          disabled={mutation.isPending || (isOwner && household.members.length === 1)}
          title={
            isOwner && household.members.length === 1
              ? 'Add another member or delete the household instead.'
              : undefined
          }
        >
          Leave household
        </button>
        {isOwner ? (
          <button
            type="button"
            className="textDangerButton"
            disabled={mutation.isPending}
            onClick={() => {
              if (window.confirm(`Permanently delete ${household.name} and all of its data?`)) {
                mutation.mutate(() => deleteHousehold(household.id));
              }
            }}
          >
            Delete household
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function HouseholdSettings({ user }: { user: PublicUser }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(defaultHousehold);
  const query = useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });
  const createMutation = useMutation({
    mutationFn: createHousehold,
    onSuccess: async () => {
      setDraft(defaultHousehold);
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });

  return (
    <section className="householdSettings" aria-labelledby="household-settings-heading">
      <div className="settingsSectionHeading">
        <div>
          <h2 id="household-settings-heading">Households</h2>
          <p>Create a household or manage the households you belong to.</p>
        </div>
      </div>

      <form
        className="createHouseholdForm"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate(draft);
        }}
      >
        <h3>Add a household</h3>
        {createMutation.isError ? (
          <Alert variant="error">{errorMessage(createMutation.error)}</Alert>
        ) : null}
        <HouseholdFields value={draft} onChange={setDraft} prefix="create-household" />
        <Button type="submit" disabled={createMutation.isPending || !draft.name.trim()}>
          {createMutation.isPending ? 'Creating…' : 'Create household'}
        </Button>
      </form>

      {query.isPending ? <LoadingIndicator label="Loading households…" /> : null}
      {query.isError ? <Alert variant="error">{errorMessage(query.error)}</Alert> : null}
      {query.data?.length === 0 ? (
        <p className="householdEmpty">You are not a member of any household yet.</p>
      ) : null}
      <div className="householdList">
        {query.data?.map((household) => (
          <HouseholdCard key={household.id} household={household} user={user} />
        ))}
      </div>
      {query.data ? <SourceSettings households={query.data} /> : null}
    </section>
  );
}
