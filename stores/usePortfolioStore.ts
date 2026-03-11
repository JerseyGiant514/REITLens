/**
 * usePortfolioStore - Portfolio CRUD and selection state
 *
 * DEPENDENCY: This file requires `zustand` to be installed.
 *   Run: npm install zustand
 *   Agent 3 owns package.json -- coordinate with them to add this dependency.
 *
 * Replaces the following state previously lifted in App.tsx:
 *   - portfolios / setPortfolios
 *   - selectedPortfolioId / setSelectedPortfolioId (+ handlePortfolioChange)
 *   - onSavePortfolio / onDeletePortfolio
 *
 * NOTE: Supabase persistence (upsert/delete) is kept in the store actions
 * to co-locate side effects with the state transitions they accompany.
 * Auth user is passed as a parameter rather than read from context
 * because Zustand stores live outside the React tree.
 */

import { create } from 'zustand';
import { Portfolio } from '../types';
import { supabase } from '../services/supabaseClient';

interface PortfolioState {
  // --- Data ---
  portfolios: Portfolio[];
  selectedPortfolioId: string | null;

  // --- Selection ---
  /**
   * Selects a portfolio (or 'none' to reset to individual ticker view).
   * Returns the new selectedTicker value if the caller needs to sync
   * with the app store (ticker/sector are in useAppStore).
   */
  selectPortfolio: (id: string | 'none') => void;

  // --- CRUD ---
  /** Load all portfolios for a given user from Supabase. */
  loadPortfolios: (userId: string) => Promise<void>;

  /** Clear portfolios (e.g. on sign-out). */
  clearPortfolios: () => void;

  /** Optimistically save (create or update) a portfolio and persist to Supabase. */
  savePortfolio: (portfolio: Portfolio, userId: string) => Promise<void>;

  /** Optimistically delete a portfolio and persist to Supabase. */
  deletePortfolio: (id: string, userId: string) => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  selectedPortfolioId: null,

  selectPortfolio: (id) => {
    if (id === 'none') {
      set({ selectedPortfolioId: null });
      // The caller (App.tsx or Layout.tsx) should also call
      // useAppStore.getState().selectTicker('PLD') to reset ticker/sector.
    } else {
      set({ selectedPortfolioId: id });
      // The caller should also clear ticker/sector in useAppStore.
    }
  },

  loadPortfolios: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId);

      if (!error && data) {
        const fetched: Portfolio[] = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          holdings: d.holdings,
        }));
        set({ portfolios: fetched });
      }
    } catch (e) {
      // failed to load portfolios
    }
  },

  clearPortfolios: () => set({ portfolios: [], selectedPortfolioId: null }),

  savePortfolio: async (portfolio, userId) => {
    // Optimistic local update
    set((state) => {
      const idx = state.portfolios.findIndex((p) => p.id === portfolio.id);
      if (idx > -1) {
        const next = [...state.portfolios];
        next[idx] = portfolio;
        return { portfolios: next };
      }
      return { portfolios: [...state.portfolios, portfolio] };
    });

    // Persist to Supabase
    try {
      await supabase.from('portfolios').upsert({
        id: portfolio.id,
        user_id: userId,
        name: portfolio.name,
        holdings: portfolio.holdings,
      });
    } catch (e) {
      // failed to persist portfolio
    }
  },

  deletePortfolio: async (id, userId) => {
    const { selectedPortfolioId } = get();

    // Optimistic local update
    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== id),
      selectedPortfolioId: selectedPortfolioId === id ? null : state.selectedPortfolioId,
    }));

    // Persist to Supabase
    try {
      await supabase
        .from('portfolios')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    } catch (e) {
      // failed to delete portfolio
    }
  },
}));
