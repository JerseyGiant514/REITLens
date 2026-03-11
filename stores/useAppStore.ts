/**
 * useAppStore - Core application state (navigation, selection, live mode)
 *
 * DEPENDENCY: This file requires `zustand` to be installed.
 *   Run: npm install zustand
 *   Agent 3 owns package.json -- coordinate with them to add this dependency.
 *
 * Replaces the following useState calls previously lifted in App.tsx:
 *   - activePage / setActivePage
 *   - selectedTicker / setSelectedTicker (+ handleTickerChange)
 *   - selectedSector / setSelectedSector (+ handleSectorChange)
 *   - isLiveMode / setIsLiveMode
 *   - isLoading / setIsLoading
 *   - liveFinancials / setLiveFinancials
 */

import { create } from 'zustand';
import { Page, Sector } from '../types';

interface AppState {
  // --- Navigation ---
  activePage: Page;
  setActivePage: (page: Page) => void;

  // --- Entity selection ---
  selectedTicker: string | null;
  selectedSector: Sector | null;

  /**
   * Selects a single REIT ticker, clearing sector and portfolio selections.
   * Mirrors the old `handleTickerChange` in App.tsx.
   */
  selectTicker: (ticker: string) => void;

  /**
   * Selects a sector (or 'all' to reset to individual mode).
   * Mirrors the old `handleSectorChange` in App.tsx.
   */
  selectSector: (sector: Sector | 'all') => void;

  // --- Live mode ---
  isLiveMode: boolean;
  setIsLiveMode: (v: boolean) => void;

  // --- Loading & live data ---
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  liveFinancials: any | null;
  setLiveFinancials: (data: any | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),

  // Entity selection
  selectedTicker: 'PLD',
  selectedSector: null,

  selectTicker: (ticker) =>
    set({
      selectedTicker: ticker,
      selectedSector: null,
    }),

  selectSector: (sector) => {
    if (sector === 'all') {
      set({
        selectedSector: null,
        selectedTicker: 'PLD',
      });
    } else {
      set({
        selectedSector: sector,
        selectedTicker: null,
      });
    }
  },

  // Live mode
  isLiveMode: false,
  setIsLiveMode: (v) => set({ isLiveMode: v }),

  // Loading & live data
  isLoading: false,
  setIsLoading: (v) => set({ isLoading: v }),
  liveFinancials: null,
  setLiveFinancials: (data) => set({ liveFinancials: data }),
}));
