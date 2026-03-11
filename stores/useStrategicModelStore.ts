/**
 * useStrategicModelStore - Justified P/AFFO model parameters (WACC + Growth bridge)
 *
 * DEPENDENCY: This file requires `zustand` to be installed.
 *   Run: npm install zustand
 *   Agent 3 owns package.json -- coordinate with them to add this dependency.
 *
 * Replaces the following state previously lifted in App.tsx:
 *   - strategicModel / setStrategicModel (StrategicModelState)
 *
 * This is the state that causes the most unnecessary re-renders in the current
 * architecture: every slider change in JustifiedPAFFO calls setStrategicModel
 * on App.tsx, which re-renders the entire component tree.  By moving it to
 * Zustand, only components that subscribe to specific slices will re-render.
 *
 * MIGRATION NOTE: After this store is adopted, JustifiedPAFFO should consume
 * `useStrategicModelStore()` directly instead of receiving `model` / `onUpdateModel`
 * as props.  Same for Valuation, ReturnDecomposition, and AnalystMemo.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WACCParams {
  /** Risk-free rate (10Y Treasury yield, %) */
  rf: number;
  /** Equity Risk Premium (%) */
  erp: number;
  /** Levered beta */
  beta: number;
  /** AFFO payout ratio (%) */
  payout: number;
  /** Label for the selected Rf percentile preset */
  rfLabel: string;
  /** Label for the selected ERP percentile preset */
  erpLabel: string;
}

export interface GrowthParams {
  /** Same-store NOI growth (%) */
  ss: number;
  /** Label for the selected SS-NOI percentile preset */
  ssLabel?: string;
  /** Acquisition volume as % of GAV */
  acqVol: number;
  /** Acquisition spread (bps) */
  acqSpread: number;
  /** Development deliveries as % of GAV */
  devVol: number;
  /** Development alpha/spread (bps) */
  devSpread: number;
  /** CAD leakage -- maintenance capex drag (%) -- always <= 0 */
  leakage: number;
  /** Capital structure impact (%) */
  cap: number;
}

export interface StrategicModelState {
  wacc: WACCParams;
  growth: GrowthParams;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface StrategicModelStore extends StrategicModelState {
  /** Replace the entire model state (used by legacy setStrategicModel callers). */
  setModel: (model: StrategicModelState) => void;

  /** Update a single WACC parameter by key. */
  updateWacc: <K extends keyof WACCParams>(key: K, value: WACCParams[K]) => void;

  /** Update a single growth parameter by key. */
  updateGrowth: <K extends keyof GrowthParams>(key: K, value: GrowthParams[K]) => void;

  /** Reset to default values. */
  resetToDefaults: () => void;
}

// ---------------------------------------------------------------------------
// Defaults  (mirrors the initial state from the old App.tsx)
// ---------------------------------------------------------------------------

// NOTE: The default rf value here is 4.25, matching MACRO_DATA[0].value from
// mockData.ts.  If the live MACRO_DATA value changes, this default should be
// updated -- or better yet, the component that mounts first should call
// updateWacc('rf', MACRO_DATA[0].value).
const DEFAULT_WACC: WACCParams = {
  rf: 4.25,
  erp: 5.0,
  beta: 0.85,
  payout: 75,
  rfLabel: 'CURR',
  erpLabel: 'CURR',
};

const DEFAULT_GROWTH: GrowthParams = {
  ss: 3.5,
  acqVol: 4.0,
  acqSpread: 120,
  devVol: 2.5,
  devSpread: 180,
  leakage: -1.5,
  cap: 0.2,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStrategicModelStore = create<StrategicModelStore>((set) => ({
  wacc: { ...DEFAULT_WACC },
  growth: { ...DEFAULT_GROWTH },

  setModel: (model) =>
    set({
      wacc: { ...model.wacc },
      growth: { ...model.growth },
    }),

  updateWacc: (key, value) =>
    set((state) => ({
      wacc: { ...state.wacc, [key]: value },
    })),

  updateGrowth: (key, value) =>
    set((state) => ({
      growth: { ...state.growth, [key]: value },
    })),

  resetToDefaults: () =>
    set({
      wacc: { ...DEFAULT_WACC },
      growth: { ...DEFAULT_GROWTH },
    }),
}));
