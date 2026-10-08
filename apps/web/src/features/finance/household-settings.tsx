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
  const [invitationMode, setInvitationMode] = useState<'link' | 'email'>('link');
  const [invitationEmails, setInvitationEmails] = useState('');
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [invitationDelivery, setInvitationDelivery] = useState<{
    sentTo: string[];
    failedTo: string[];
  } | null>(null);
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

  const createLinkInvitation = () => {
    mutation.mutate(async () => {
      const invitation = await createHouseholdInvitation(household.id, {
        mode: 'link',
      });
      if (invitation.mode !== 'link') throw new Error('Unexpected invitation response.');
      setInvitationLink(`${window.location.origin}/invite/${invitation.token}`);
      setLinkCopied(false);
    });
  };

  const copyInvitationLink = async () => {
    if (!invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      setLinkCopied(true);
      setError(null);
    } catch {
      setError('The invitation link could not be copied. Please copy it from the field.');
    }
  };

  const sendEmailInvitations = () => {
    const emails = invitationEmails
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    mutation.mutate(async () => {
      const invitation = await createHouseholdInvitation(household.id, {
        mode: 'email',
        emails,
      });
      if (invitation.mode !== 'email') throw new Error('Unexpected invitation response.');
      setInvitationDelivery({ sentTo: invitation.sentTo, failedTo: invitation.failedTo });
      setInvitationEmails(invitation.failedTo.join(', '));
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
        <div className="invitationModeSwitch" role="group" aria-label="Invitation method">
          <button
            type="button"
            aria-pressed={invitationMode === 'link'}
            disabled={mutation.isPending}
            onClick={() => setInvitationMode('link')}
          >
            Share link
          </button>
          <button
            type="button"
            aria-pressed={invitationMode === 'email'}
            disabled={mutation.isPending}
            onClick={() => setInvitationMode('email')}
          >
            Email
          </button>
        </div>

        {invitationMode === 'link' ? (
          <div className="householdInvitationPanel">
            {invitationLink ? (
              <div className="householdInvitationLink">
                <Input
                  value={invitationLink}
                  aria-label="Household invitation link"
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button type="button" onClick={copyInvitationLink}>
                  {linkCopied ? 'Copied!' : 'Copy link'}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={createLinkInvitation}
              >
                {mutation.isPending ? 'Creating...' : 'Create invitation link'}
              </Button>
            )}
            <small>Anyone with this single-use link can join. It expires in one hour.</small>
          </div>
        ) : (
          <form
            className="householdInvitationPanel"
            onSubmit={(event) => {
              event.preventDefault();
              sendEmailInvitations();
            }}
          >
            <div className="householdInvitationLink">
              <Input
                type="email"
                multiple
                value={invitationEmails}
                onChange={(event) => {
                  setInvitationEmails(event.target.value);
                  setInvitationDelivery(null);
                }}
                placeholder="alex@example.com, sam@example.com"
                aria-label="Email addresses to invite, separated by commas"
                required
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={mutation.isPending || !invitationEmails.trim()}
              >
                {mutation.isPending ? 'Sending...' : 'Send invitation'}
              </Button>
            </div>
            <small>
              Separate up to {Constants.HOUSEHOLD_INVITATION_MAX_RECIPIENTS} addresses with commas.
              Each person receives a unique link that expires in one hour.
            </small>
            {invitationDelivery?.sentTo.length ? (
              <p className="householdInvitationConfirmation" role="status">
                {invitationDelivery.sentTo.length === 1 ? 'Invitation' : 'Invitations'} sent to{' '}
                {invitationDelivery.sentTo.join(', ')}.
              </p>
            ) : null}
            {invitationDelivery?.failedTo.length ? (
              <Alert variant="error">
                Could not send to {invitationDelivery.failedTo.join(', ')}. The field now contains
                only these addresses so you can retry.
              </Alert>
            ) : null}
          </form>
        )}
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
