'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '@template/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, Button, LoadingIndicator } from '../../components/ui/index';
import { isApiClientError } from '../../lib/api/errors';

import { acceptHouseholdInvitation, financeKeys, getHouseholdInvitation } from './finance.api';
import { FinancialIcon } from './financial-icon';

function errorMessage(error: unknown): string {
  return isApiClientError(error) ? error.message : 'Something went wrong. Please try again.';
}

export function HouseholdInvitationPrompt({
  token,
  user,
}: {
  token: string;
  user: PublicUser | null;
}) {
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

  if (query.isPending) return <LoadingIndicator label="Loading invitation..." />;
  if (query.isError) return <Alert variant="error">{errorMessage(query.error)}</Alert>;

  const invitation = query.data;
  return (
    <section className="invitationPrompt" aria-labelledby="invitation-heading">
      <span className="householdBadge" style={{ backgroundColor: invitation.household.color }}>
        <FinancialIcon name={invitation.household.icon} size={28} />
      </span>
      <div>
        <h1 id="invitation-heading">Join {invitation.household.name}?</h1>
        <p>You have been invited to join this household and share its monthly finances.</p>
      </div>

      {mutation.isError ? <Alert variant="error">{errorMessage(mutation.error)}</Alert> : null}

      {user ? (
        <>
          <p>
            Continue as <strong>{user.displayName}</strong>?
          </p>
          <div className="invitationActions">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? 'Joining...' : 'Yes, join household'}
            </Button>
            <Link className="button buttonSecondary" href="/">
              No, thanks
            </Link>
          </div>
        </>
      ) : (
        <>
          <p>Create an account to accept this invitation. You will return here afterward.</p>
          <div className="invitationActions">
            <Link className="button" href={`/register?next=${encodeURIComponent(invitationPath)}`}>
              Create an account
            </Link>
            <Link
              className="button buttonSecondary"
              href={`/login?next=${encodeURIComponent(invitationPath)}`}
            >
              Log in
            </Link>
            <Link className="button buttonSecondary" href="/">
              No, thanks
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
