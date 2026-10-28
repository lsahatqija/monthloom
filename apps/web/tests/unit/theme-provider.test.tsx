import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '../../src/components/theme-provider';

function ThemeControls() {
  const { setTheme } = useTheme();
  return (
    <>
      <header className="header" />
      <button type="button" onClick={() => setTheme('sea-glass')}>
        Sea Glass
      </button>
    </>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#fffefa">';
    const getComputedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const style = getComputedStyle(element, pseudoElement);
      if (element.classList.contains('header')) {
        Object.defineProperty(style, 'backgroundColor', {
          configurable: true,
          value:
            document.documentElement.dataset.theme === 'sea-glass'
              ? 'rgb(29, 45, 48)'
              : 'rgb(34, 43, 37)',
        });
      }
      return style;
    });
  });

  it('updates the PWA theme color when the app theme changes', async () => {
    render(
      <ThemeProvider>
        <ThemeControls />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sea Glass' }));

    await waitFor(() =>
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        'content',
        'rgb(29, 45, 48)',
      ),
    );
  });
});
