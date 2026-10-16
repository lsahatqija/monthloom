import type { Metadata } from 'next';

import { PageContainer } from '../../../components/ui/index';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <PageContainer>
      <h1>About Monthloom</h1>
      <p>
        Monthloom helps households track shared income and expenses, organize recurring entries,
        and understand each month together.
      </p>
    </PageContainer>
  );
}
