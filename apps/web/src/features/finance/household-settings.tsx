'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  type CreateHouseholdRequest,
  type ManagedHousehold,
  type PublicUser,
  type UpdateHouseholdRequest,
} from '@template/contracts';
import { useEffect, useRef, useState } from 'react';

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
import { HouseholdIcon, householdIconLabel } from './household-icon';

const HOUSEHOLD_COLOR_OPTIONS = [
  '#35675B',
  '#33805C',
  '#2F7D78',
  '#2F6F9F',
  '#45658B',
  '#67558A',
  '#8B5FA8',
  '#B35C7A',
  '#C4473A',
  '#D4683A',
  '#C48A2C',
  '#A3A635',
  '#668238',
  '#6B7280',
  '#475569',
  '#7C5C45',
] as const;

const defaultHousehold: CreateHouseholdRequest = {
  name: '',
  icon: 'small-house',
  color: HOUSEHOLD_COLOR_OPTIONS[0],
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
  const iconPickerRef = useRef<HTMLDetailsElement>(null);
  const colorPickerRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closePickers = (event: MouseEvent) => {
      const target = event.target as Node;
      if (iconPickerRef.current?.open && !iconPickerRef.current.contains(target)) {
        iconPickerRef.current.open = false;
      }
      if (colorPickerRef.current?.open && !colorPickerRef.current.contains(target)) {
        colorPickerRef.current.open = false;
      }
    };

    document.addEventListener('mousedown', closePickers);
    return () => document.removeEventListener('mousedown', closePickers);
  }, []);

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
      <div className="householdField">
        <span id={`${prefix}-icon-label`}>Icon</span>
        <details
          ref={iconPickerRef}
          id={`${prefix}-icon`}
          className="iconPickerDropdown householdIconDropdown"
        >
          <summary aria-labelledby={`${prefix}-icon-label`}>
            <span className="selectedIconPreview" style={{ backgroundColor: value.color }}>
              <HouseholdIcon name={value.icon} size={20} />
            </span>
            <span>{householdIconLabel(value.icon)}</span>
          </summary>
          <div className="iconPickerPopover">
            <div className="iconPickerGrid" role="group" aria-label="Choose a household icon">
              {Constants.HOUSEHOLD_ICONS.map((icon) => {
                const label = householdIconLabel(icon);
                return (
                  <label
                    key={icon}
                    className={value.icon === icon ? 'isSelected' : undefined}
                    title={label}
                  >
                    <input
                      type="radio"
                      name={`${prefix}-icon`}
                      value={icon}
                      checked={value.icon === icon}
                      onChange={() => {
                        onChange({ ...value, icon });
                        if (iconPickerRef.current) iconPickerRef.current.open = false;
                      }}
                    />
                    <HouseholdIcon name={icon} size={21} />
                    <span className="srOnly">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </details>
      </div>
      <div className="householdField">
        <span id={`${prefix}-color-label`}>Color</span>
        <details
          ref={colorPickerRef}
          id={`${prefix}-color`}
          className="colorPickerDropdown householdColorDropdown"
        >
          <summary aria-labelledby={`${prefix}-color-label`}>
            <span className="selectedColorPreview" style={{ backgroundColor: value.color }} />
            <span>{value.color.toUpperCase()}</span>
          </summary>
          <div className="colorPickerPopover">
            <div className="colorOptions" role="group" aria-label="Choose a household color">
              {HOUSEHOLD_COLOR_OPTIONS.map((color) => (
                <label key={color} style={{ backgroundColor: color }} title={color}>
                  <input
                    type="radio"
                    name={`${prefix}-color`}
                    value={color}
                    checked={value.color.toUpperCase() === color}
                    onChange={() => {
                      onChange({ ...value, color });
                      if (colorPickerRef.current) colorPickerRef.current.open = false;
                    }}
                  />
                  <span className="srOnly">{color}</span>
                </label>
              ))}
            </div>
          </div>
        </details>
      </div>
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
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationSentTo, setInvitationSentTo] = useState<string | null>(null);
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
      const invitation = await createHouseholdInvitation(household.id, {
        email: invitationEmail,
      });
      setInvitationSentTo(invitation.sentTo);
      setInvitationEmail('');
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
          <HouseholdIcon name={household.icon} size={24} />
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
        </div>
        <form
          className="householdInvitationLink"
          onSubmit={(event) => {
            event.preventDefault();
            createInvitation();
          }}
        >
          <Input
            type="email"
            value={invitationEmail}
            onChange={(event) => setInvitationEmail(event.target.value)}
            placeholder="person@example.com"
            aria-label="Email address to invite"
            required
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={mutation.isPending || !invitationEmail.trim()}
          >
            {mutation.isPending ? 'Sending...' : 'Send invitation'}
          </Button>
          <small>The single-use invitation expires in one hour.</small>
        </form>
        {invitationSentTo ? (
          <p className="householdInvitationConfirmation" role="status">
            Invitation sent to {invitationSentTo}.
          </p>
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
    </section>
  );
}
