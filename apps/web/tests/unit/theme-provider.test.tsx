import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '../../src/components/theme-provider';

function ThemeControls() {
  const { setTheme, toggleMode } = useTheme();
  return (
    <>
      <button type="button" onClick={() => setTheme('sea-glass')}>
        Sea Glass
      </button>
      <button type="button" onClick={toggleMode}>
        Toggle mode
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
      if (element instanceof HTMLSpanElement) {
        Object.defineProperty(style, 'backgroundColor', {
          configurable: true,
          value:
            document.documentElement.dataset.mode === 'dark'
              ? 'rgb(29, 45, 48)'
              : 'rgb(35, 58, 62)',
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
        'rgb(35, 58, 62)',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle mode' }));

    await waitFor(() =>
      expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
        'content',
        'rgb(29, 45, 48)',
      ),
    );
  });
});
