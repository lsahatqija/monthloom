import type { Metadata } from 'next';

import { PageContainer } from '@/components/ui/index';
import { VerifyEmail } from '@/features/auth/verify-email';

export const metadata: Metadata = { title: 'Verify email' };

export default function VerifyEmailPage({ params }: { params: { token: string } }) {
  return (
    <PageContainer>
      <h1>Verify your email</h1>
      <VerifyEmail token={params.token} />
    </PageContainer>
  );
}
