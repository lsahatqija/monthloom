'use client';

import type { PublicUser } from '@monthloom/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Alert, Button, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { acceptHouseholdInvitation, financeKeys, getHouseholdInvitation } from './finance.api';
import { HouseholdIcon } from './household-icon';

function errorMessage(error: unknown, fallback: string): string {
  return isApiClientError(error) ? error.message : fallback;
}

export function HouseholdInvitationPrompt({
  token,
  user,
}: {
  token: string;
  user: PublicUser | null;
}) {
  const t = useTranslations('Finance');
  const router = useRouter();
  const queryClient = useQueryClient();
  const invitationPath = `/invite/${token}`;
  const query = useQuery({
    queryKey: [...financeKeys.all, 'invitation', token],
    queryFn: () => getHouseholdInvitation(token),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: () => acceptHouseholdInvitation(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      router.push('/settings/households');
      router.refresh();
    },
  });

  if (query.isPending) return <LoadingIndicator label={t('loadingInvitation')} />;
  if (query.isError)
    return <Alert variant="error">{errorMessage(query.error, t('genericError'))}</Alert>;

  const invitation = query.data;
  return (
    <section className="invitationPrompt" aria-labelledby="invitation-heading">
      <span className="householdBadge" style={{ backgroundColor: invitation.household.color }}>
        <HouseholdIcon name={invitation.household.icon} size={28} />
      </span>
      <div>
        <h1 id="invitation-heading">
          {t('joinHouseholdTitle', { household: invitation.household.name })}
        </h1>
        <p>{t('invitationDescription')}</p>
      </div>

      {mutation.isError ? (
        <Alert variant="error">{errorMessage(mutation.error, t('genericError'))}</Alert>
      ) : null}

      {user ? (
        <>
          <p>
            {t.rich('continueAs', {
              name: user.displayName,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <div className="invitationActions">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? t('joining') : t('joinHousehold')}
            </Button>
            <Link className="button buttonSecondary" href="/">
              {t('noThanks')}
            </Link>
          </div>
        </>
      ) : (
        <>
          <p>{t('createAccountForInvitation')}</p>
          <div className="invitationActions">
            <Link className="button" href={`/register?next=${encodeURIComponent(invitationPath)}`}>
              {t('createAccount')}
            </Link>
            <Link
              className="button buttonSecondary"
              href={`/login?next=${encodeURIComponent(invitationPath)}`}
            >
              {t('login')}
            </Link>
            <Link className="button buttonSecondary" href="/">
              {t('noThanks')}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
