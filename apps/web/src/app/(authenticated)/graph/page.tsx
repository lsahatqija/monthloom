import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { GraphView } from '@/features/finance/graph/graph-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('graphs') };
}

export default function GraphPage() {
  return <GraphView />;
}
