import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

import messages from '../messages/en.json';

export function renderWithQuery(
  ui: ReactElement,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  }),
) {
  return {
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
      </NextIntlClientProvider>,
    ),
    client,
  };
}
