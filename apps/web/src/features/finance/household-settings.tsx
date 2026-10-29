'use client';

import {
  Constants,
  Defaults,
  HOUSEHOLD_CURRENCIES,
  type CreateHouseholdRequest,
  type ManagedHousehold,
  type PublicUser,
  type UpdateHouseholdRequest,
} from '@monthloom/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import { HouseholdIcon } from './household-icon';

const HOUSEHOLD_COLOR_OPTIONS = [
  Defaults.HOUSEHOLD_COLOR,
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
  currency: Defaults.HOUSEHOLD_CURRENCY,
  name: '',
  icon: Defaults.HOUSEHOLD_ICON,
  color: Defaults.HOUSEHOLD_COLOR,
};

function errorMessage(error: unknown, fallback: string): string {
  return isApiClientError(error) ? error.message : fallback;
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
  const t = useTranslations('Finance');
  const iconLabels = useTranslations('Labels.householdIcons');
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
        <span>{t('name')}</span>
        <Input
          id={`${prefix}-name`}
          value={value.name}
          maxLength={Constants.HOUSEHOLD_NAME_MAX_LENGTH}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          required
        />
      </label>
      <label>
        <span>{t('currency')}</span>
        <select
          id={`${prefix}-currency`}
          value={value.currency}
          onChange={(event) => onChange({ ...value, currency: event.target.value })}
        >
          {HOUSEHOLD_CURRENCIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
      </label>
      <div className="householdField">
        <span id={`${prefix}-icon-label`}>{t('icon')}</span>
        <details
          ref={iconPickerRef}
          id={`${prefix}-icon`}
          className="iconPickerDropdown householdIconDropdown"
        >
          <summary aria-labelledby={`${prefix}-icon-label`}>
            <span className="selectedIconPreview" style={{ backgroundColor: value.color }}>
              <HouseholdIcon name={value.icon} size={20} />
            </span>
            <span>{iconLabels(value.icon)}</span>
          </summary>
          <div className="iconPickerPopover">
            <div className="iconPickerGrid" role="group" aria-label={t('chooseHouseholdIcon')}>
              {Constants.HOUSEHOLD_ICONS.map((icon) => {
                const label = iconLabels(icon);
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
        <span id={`${prefix}-color-label`}>{t('color')}</span>
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
            <div className="colorOptions" role="group" aria-label={t('chooseHouseholdColor')}>
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
  const t = useTranslations('Finance');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CreateHouseholdRequest>({
    currency: household.currency,
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
    onError: (mutationError) => setError(errorMessage(mutationError, t('genericError'))),
  });

  const save = () => {
    const input: UpdateHouseholdRequest = {
      currency: draft.currency,
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
      setError(t('copyInvitationError'));
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
      setError(t('selectNewOwner'));
      return;
    }
    if (window.confirm(t('leaveHouseholdConfirm', { household: household.name }))) {
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
            {t('membersCount', { count: household.members.length })}
            {household.isPrimary ? t('defaultHouseholdSuffix') : ''}
          </p>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {editing ? (
        <div className="householdEditPanel">
          <HouseholdFields value={draft} onChange={setDraft} prefix={`edit-${household.id}`} />
          <small>{t('currencyWarning')}</small>
          <div className="householdActions">
            <Button onClick={save} disabled={mutation.isPending || !draft.name.trim()}>
              {t('save')}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="householdActions">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft({
                name: household.name,
                icon: household.icon,
                color: household.color,
                currency: household.currency,
              });
              setEditing(true);
            }}
          >
            {t('edit')}
          </Button>
          {!household.isPrimary ? (
            <Button
              variant="secondary"
              onClick={() => mutation.mutate(() => setPrimaryHousehold(household.id))}
              disabled={mutation.isPending}
            >
              {t('makeDefault')}
            </Button>
          ) : null}
        </div>
      )}

      <div className="householdMembers">
        <div className="householdMembersHeading">
          <h4>{t('members')}</h4>
        </div>
        <div
          className="invitationModeSwitch"
          data-onboarding="household-invitations"
          role="group"
          aria-label={t('invitationMethod')}
        >
          <button
            type="button"
            aria-pressed={invitationMode === 'link'}
            disabled={mutation.isPending}
            onClick={() => setInvitationMode('link')}
          >
            {t('shareLink')}
          </button>
          <button
            type="button"
            aria-pressed={invitationMode === 'email'}
            disabled={mutation.isPending}
            onClick={() => setInvitationMode('email')}
          >
            {t('email')}
          </button>
        </div>

        {invitationMode === 'link' ? (
          <div className="householdInvitationPanel">
            {invitationLink ? (
              <div className="householdInvitationLink">
                <Input
                  value={invitationLink}
                  aria-label={t('householdInvitationLink')}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button type="button" onClick={copyInvitationLink}>
                  {linkCopied ? t('copied') : t('copyLink')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={createLinkInvitation}
              >
                {mutation.isPending ? t('creating') : t('createInvitationLink')}
              </Button>
            )}
            <small>{t('invitationLinkDescription')}</small>
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
                placeholder={t('invitationEmailExample')}
                aria-label={t('invitationEmailLabel')}
                required
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={mutation.isPending || !invitationEmails.trim()}
              >
                {mutation.isPending ? t('sending') : t('sendInvitation')}
              </Button>
            </div>
            <small>
              {t('invitationEmailDescription', {
                count: Constants.HOUSEHOLD_INVITATION_MAX_RECIPIENTS,
              })}
            </small>
            {invitationDelivery?.sentTo.length ? (
              <p className="householdInvitationConfirmation" role="status">
                {t('invitationsSent', {
                  count: invitationDelivery.sentTo.length,
                  emails: invitationDelivery.sentTo.join(', '),
                })}
              </p>
            ) : null}
            {invitationDelivery?.failedTo.length ? (
              <Alert variant="error">
                {t('invitationsFailed', { emails: invitationDelivery.failedTo.join(', ') })}
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
                  {member.id === household.ownerId ? t('owner') : t('member')}
                  {member.id === user.id ? t('youMarker') : ''}
                </small>
              </span>
              {isOwner && member.id !== user.id ? (
                <button
                  type="button"
                  className="textDangerButton"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        t('removeMemberConfirm', {
                          member: member.displayName,
                          household: household.name,
                        }),
                      )
                    ) {
                      mutation.mutate(() => removeHouseholdMember(household.id, member.id));
                    }
                  }}
                >
                  {t('remove')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="householdDangerZone">
        {isOwner && household.members.length > 1 ? (
          <label>
            <span>{t('transferOwnership')}</span>
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
          title={isOwner && household.members.length === 1 ? t('cannotLeaveSoleMember') : undefined}
        >
          {t('leaveHousehold')}
        </button>
        {isOwner ? (
          <button
            type="button"
            className="textDangerButton"
            disabled={mutation.isPending}
            onClick={() => {
              if (window.confirm(t('deleteHouseholdConfirm', { household: household.name }))) {
                mutation.mutate(() => deleteHousehold(household.id));
              }
            }}
          >
            {t('deleteHousehold')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function HouseholdSettings({ user }: { user: PublicUser }) {
  const t = useTranslations('Finance');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(defaultHousehold);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const query = useQuery({ queryKey: financeKeys.households(), queryFn: getHouseholds });
  const createMutation = useMutation({
    mutationFn: createHousehold,
    onSuccess: async () => {
      setDraft(defaultHousehold);
      setIsCreateModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      window.dispatchEvent(
        new CustomEvent('monthloom:onboarding', { detail: 'household-created' }),
      );
    },
  });
  const hasHouseholds = Boolean(query.data?.length);
  const { reset: resetCreateMutation } = createMutation;

  useEffect(() => {
    if (!isCreateModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createMutation.isPending) {
        setIsCreateModalOpen(false);
        setDraft(defaultHousehold);
        resetCreateMutation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createMutation.isPending, isCreateModalOpen, resetCreateMutation]);

  const closeCreateModal = () => {
    if (createMutation.isPending) return;
    setIsCreateModalOpen(false);
    setDraft(defaultHousehold);
    resetCreateMutation();
  };

  const createFormFields = (prefix: string) => (
    <>
      {createMutation.isError ? (
        <Alert variant="error">{errorMessage(createMutation.error, t('genericError'))}</Alert>
      ) : null}
      <HouseholdFields value={draft} onChange={setDraft} prefix={prefix} />
      <Button type="submit" disabled={createMutation.isPending || !draft.name.trim()}>
        {createMutation.isPending ? t('creating') : t('createHousehold')}
      </Button>
    </>
  );

  return (
    <section className="householdSettings" aria-labelledby="household-settings-heading">
      <div className="settingsSectionHeading">
        <div>
          <h2 id="household-settings-heading">{t('households')}</h2>
          <p>{t('manageHouseholdsDescription')}</p>
        </div>
        {hasHouseholds ? (
          <Button type="button" onClick={() => setIsCreateModalOpen(true)}>
            {t('addHouseholdAction')}
          </Button>
        ) : null}
      </div>

      {query.data && !hasHouseholds ? (
        <form
          className="createHouseholdForm"
          data-onboarding="create-household"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate(draft);
          }}
        >
          <h3>{t('addHousehold')}</h3>
          {createFormFields('create-household')}
        </form>
      ) : null}

      {query.isPending ? <LoadingIndicator label={t('loadingHouseholds')} /> : null}
      {query.isError ? (
        <Alert variant="error">{errorMessage(query.error, t('genericError'))}</Alert>
      ) : null}
      {query.data?.length === 0 ? (
        <p className="householdEmpty">{t('notHouseholdMember')}</p>
      ) : null}
      <div className="householdList">
        {query.data?.map((household) => (
          <HouseholdCard key={household.id} household={household} user={user} />
        ))}
      </div>

      {hasHouseholds && isCreateModalOpen ? (
        <div
          className="transactionModalBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <section
            className="transactionModal createHouseholdModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-household-modal-title"
          >
            <div className="transactionModalHeader">
              <div>
                <p className="transactionModalEyebrow">{t('newHousehold')}</p>
                <h2 id="create-household-modal-title">{t('addHousehold')}</h2>
              </div>
              <button
                type="button"
                className="modalCloseButton"
                disabled={createMutation.isPending}
                onClick={closeCreateModal}
                aria-label={t('closeAddHousehold')}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <form
              className="createHouseholdModalForm"
              onSubmit={(event) => {
                event.preventDefault();
                createMutation.mutate(draft);
              }}
            >
              {createFormFields('create-household-modal')}
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
