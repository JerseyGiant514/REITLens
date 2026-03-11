/**
 * useKeyboardShortcuts - Global keyboard navigation for REITLens
 *
 * Shortcuts:
 *   Escape        - Close any open modals/dropdowns (blur active element)
 *   Ctrl+1..9     - Navigate to page tabs in sidebar order
 *   Left/Right    - Cycle through tickers on single-ticker pages
 */

import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { REITS } from '../services/mockData';
import { Page } from '../types';

/**
 * Pages in the same order as Layout's navCategories sidebar.
 * Ctrl+1 = dashboard, Ctrl+2 = valuation, etc.
 */
const PAGE_ORDER: Page[] = [
  'dashboard',
  'valuation',
  'justified-paffo',
  'relative-value',
  'nav-sensitivity',
  'return-decomposition',
  'operations',
  'sector-lens',
  'analyst-perspectives',
  // Beyond Ctrl+9: analyst-memo, expert-knowledge, balance-sheet, macro,
  // watchlist, portfolio-manager, correlation-matrix, data-guide
];

/** Pages that operate on a single ticker (arrow-key cycling is relevant). */
const SINGLE_TICKER_PAGES = new Set<Page>([
  'dashboard',
  'valuation',
  'justified-paffo',
  'relative-value',
  'nav-sensitivity',
  'return-decomposition',
  'operations',
  'balance-sheet',
  'analyst-memo',
  'analyst-perspectives',
  'correlation-matrix',
  'nav-model',
  'dividend-safety',
  'forward-affo',
  'debt-stress',
  'mgmt-scorecard',
  'pnav-history',
  'volatility',
  'tenant-lease',
  'geo-exposure',
  'consensus',
]);

const TICKER_LIST = REITS.map((r) => r.ticker);

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // --- Ignore when user is typing in an input/textarea/contenteditable ---
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      // ---- Escape: always allowed, even in inputs ----
      if (e.key === 'Escape') {
        // Blur any focused element to close dropdowns/modals
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Skip remaining shortcuts when user is typing
      if (isEditable) return;

      // ---- Ctrl+1 through Ctrl+9: page navigation ----
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          const page = PAGE_ORDER[digit - 1];
          if (page) {
            e.preventDefault();
            useAppStore.getState().setActivePage(page);
          }
          return;
        }
      }

      // ---- ArrowLeft / ArrowRight: cycle tickers ----
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        const { activePage, selectedTicker } = useAppStore.getState();
        if (!SINGLE_TICKER_PAGES.has(activePage)) return;

        const currentTicker = selectedTicker || 'PLD';
        const idx = TICKER_LIST.indexOf(currentTicker);
        if (idx === -1) return;

        e.preventDefault();
        const nextIdx =
          e.key === 'ArrowRight'
            ? (idx + 1) % TICKER_LIST.length
            : (idx - 1 + TICKER_LIST.length) % TICKER_LIST.length;

        useAppStore.getState().selectTicker(TICKER_LIST[nextIdx]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
