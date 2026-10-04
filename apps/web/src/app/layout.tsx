import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeProvider } from '../components/theme-provider';
import { QueryProvider } from '../providers/query-provider';

import '../styles/globals.css';
import '../components/ui/ui.css';
import '../components/layout/layout.css';
import '../features/finance/household-dashboard.css';

export const metadata: Metadata = {
  title: {
    default: 'Monthloom',
    template: '%s | Monthloom',
  },
  description: 'Plan and share your monthly household finances.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const appearanceScript = `(function(){try{var t=localStorage.getItem('monthloom-theme');var m=localStorage.getItem('monthloom-mode');var themes=['linen-sage','sea-glass','lavender-mist','apricot-cotton','blue-hour'];document.documentElement.dataset.theme=themes.includes(t)?t:'linen-sage';document.documentElement.dataset.mode=m==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='linen-sage';document.documentElement.dataset.mode='light'}})()`;

  return (
    <html lang="en" data-theme="linen-sage" data-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />
      </head>
      <body>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
