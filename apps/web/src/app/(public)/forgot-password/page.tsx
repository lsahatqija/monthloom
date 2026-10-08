import type { Metadata } from 'next';
import Link from 'next/link';

import { PageContainer } from '@/components/ui/index';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <PageContainer>
      <h1>Forgot your password?</h1>
      <p>Enter your account email and we will send you a secure reset link.</p>
      <ForgotPasswordForm />
      <p>
        Remembered it? <Link href="/login">Back to log in</Link>
      </p>
    </PageContainer>
  );
}
