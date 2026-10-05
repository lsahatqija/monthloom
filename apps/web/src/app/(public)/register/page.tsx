import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageContainer } from '../../../components/ui/index';
import { RegisterForm } from '../../../features/auth/register-form';
import { getServerUser } from '../../../lib/auth/get-server-user';
import { sanitizeRedirectTarget } from '../../../lib/auth/safe-redirect';

export const metadata: Metadata = { title: 'Register' };

export default async function RegisterPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await getServerUser();
  const redirectTo = sanitizeRedirectTarget(searchParams.next);

  if (user) {
    redirect(redirectTo);
  }

  return (
    <PageContainer>
      <h1>Create an account</h1>
      <RegisterForm redirectTo={redirectTo} />
      <p>
        Already have an account?{' '}
        <Link href={`/login?next=${encodeURIComponent(redirectTo)}`}>Log in</Link>
      </p>
    </PageContainer>
  );
}
