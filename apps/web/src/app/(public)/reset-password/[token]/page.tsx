import type { Metadata } from 'next';

import { PageContainer } from '@/components/ui/index';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return (
    <PageContainer>
      <h1>Choose a new password</h1>
      <p>Enter and confirm the new password for your account.</p>
      <ResetPasswordForm token={params.token} />
    </PageContainer>
  );
}
