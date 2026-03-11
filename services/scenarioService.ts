/**
 * Scenario Service
 * CRUD operations for P/AFFO model scenarios with localStorage + optional Supabase persistence
 */

import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaccParams {
  rf: number;
  erp: number;
  beta: number;
  payout: number;
  rfLabel: string;
  erpLabel: string;
}

export interface GrowthParams {
  ss: number;
  acqVol: number;
  acqSpread: number;
  devVol: number;
  devSpread: number;
  leakage: number;
  cap: number;
}

export interface ScenarioMetrics {
  costOfEquity: number;
  sustainableG: number;
  justifiedMultiple: number;
  impliedPrice: number;
  impliedCapRate: number;
}

export interface Scenario {
  id: string;
  name: string;
  ticker: string;
  createdAt: string;
  updatedAt: string;
  wacc: WaccParams;
  growth: GrowthParams;
  metrics: ScenarioMetrics;
  tags?: string[];
}

export interface ScenarioComparison {
  scenarios: Scenario[];
  deltas: ScenarioDelta[];
}

export interface ScenarioDelta {
  metric: string;
  label: string;
  values: number[];
  baseValue: number;
  deltas: number[];
  unit: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'reitlens_scenario_';
const STORAGE_INDEX_KEY = 'reitlens_scenario_index';

// ─── ID Generator ─────────────────────────────────────────────────────────────

const generateId = (): string => {
  return `scn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// ─── Metric Calculations ──────────────────────────────────────────────────────

/**
 * Calculate derived metrics from WACC and growth params
 */
export const calculateScenarioMetrics = (
  wacc: WaccParams,
  growth: GrowthParams,
  impliedCapRate: number = 5.0,
  currentAFFO: number = 1.0
): ScenarioMetrics => {
  const costOfEquity = wacc.rf + (wacc.beta * wacc.erp);

  // Accretion calculation normalized by cap rate
  const acqAccretion = (growth.acqVol * (growth.acqSpread / 100)) / impliedCapRate;
  const devAccretion = (growth.devVol * (growth.devSpread / 100)) / impliedCapRate;
  const inorganicTotal = acqAccretion + devAccretion;
  const sustainableG = growth.ss + inorganicTotal + growth.leakage + growth.cap;

  // Justified P/AFFO = [Payout * (1 + g)] / [k - g]
  const cost = costOfEquity / 100;
  const growthVal = sustainableG / 100;
  const pay = wacc.payout / 100;

  let justifiedMultiple: number;
  if (growthVal >= cost) {
    justifiedMultiple = 45.0; // Cap at maximum
  } else {
    justifiedMultiple = (pay * (1 + growthVal)) / (cost - growthVal);
    justifiedMultiple = Math.max(5, Math.min(45, justifiedMultiple));
  }

  const impliedPrice = justifiedMultiple * currentAFFO;

  return {
    costOfEquity,
    sustainableG,
    justifiedMultiple,
    impliedPrice,
    impliedCapRate,
  };
};

// ─── LocalStorage CRUD ────────────────────────────────────────────────────────

/**
 * Get scenario index (list of IDs)
 */
const getScenarioIndex = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Update scenario index
 */
const setScenarioIndex = (ids: string[]): void => {
  localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(ids));
};

/**
 * Save a scenario to localStorage
 */
export const saveScenario = (scenario: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>): Scenario => {
  const id = generateId();
  const now = new Date().toISOString();

  const fullScenario: Scenario = {
    ...scenario,
    id,
    createdAt: now,
    updatedAt: now,
  };

  localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(fullScenario));

  const index = getScenarioIndex();
  index.push(id);
  setScenarioIndex(index);

  return fullScenario;
};

/**
 * Update an existing scenario
 */
export const updateScenario = (id: string, updates: Partial<Scenario>): Scenario | null => {
  const existing = getScenario(id);
  if (!existing) return null;

  const updated: Scenario = {
    ...existing,
    ...updates,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(updated));
  return updated;
};

/**
 * Get a single scenario by ID
 */
export const getScenario = (id: string): Scenario | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Get all scenarios, optionally filtered by ticker
 */
export const getAllScenarios = (ticker?: string): Scenario[] => {
  const index = getScenarioIndex();
  const scenarios: Scenario[] = [];

  for (const id of index) {
    const scenario = getScenario(id);
    if (scenario) {
      if (!ticker || scenario.ticker === ticker) {
        scenarios.push(scenario);
      }
    }
  }

  // Sort by most recently updated
  return scenarios.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
};

/**
 * Delete a scenario
 */
export const deleteScenario = (id: string): boolean => {
  localStorage.removeItem(`${STORAGE_PREFIX}${id}`);

  const index = getScenarioIndex();
  const newIndex = index.filter(i => i !== id);
  setScenarioIndex(newIndex);

  return true;
};

/**
 * Delete all scenarios for a ticker
 */
export const deleteAllScenarios = (ticker: string): number => {
  const scenarios = getAllScenarios(ticker);
  scenarios.forEach(s => deleteScenario(s.id));
  return scenarios.length;
};

// ─── Comparison Logic ─────────────────────────────────────────────────────────

/**
 * Compare N scenarios and produce a delta table
 */
export const compareScenarios = (scenarios: Scenario[]): ScenarioComparison => {
  if (scenarios.length === 0) {
    return { scenarios: [], deltas: [] };
  }

  const baseScenario = scenarios[0];

  const metricDefs: { metric: keyof ScenarioMetrics; label: string; unit: string }[] = [
    { metric: 'costOfEquity', label: 'Cost of Equity (Ke)', unit: '%' },
    { metric: 'sustainableG', label: 'Sustainable Growth (g)', unit: '%' },
    { metric: 'justifiedMultiple', label: 'Justified P/AFFO', unit: 'x' },
    { metric: 'impliedPrice', label: 'Implied Price', unit: '$' },
    { metric: 'impliedCapRate', label: 'Implied Cap Rate', unit: '%' },
  ];

  const inputDefs: { path: string; label: string; unit: string; getValue: (s: Scenario) => number }[] = [
    { path: 'wacc.rf', label: 'Risk-Free Rate (Rf)', unit: '%', getValue: s => s.wacc.rf },
    { path: 'wacc.erp', label: 'Equity Risk Premium', unit: '%', getValue: s => s.wacc.erp },
    { path: 'wacc.beta', label: 'REIT Beta', unit: '', getValue: s => s.wacc.beta },
    { path: 'wacc.payout', label: 'AFFO Payout Ratio', unit: '%', getValue: s => s.wacc.payout },
    { path: 'growth.ss', label: 'Organic SS-NOI', unit: '%', getValue: s => s.growth.ss },
    { path: 'growth.acqVol', label: 'Acquisition Volume', unit: '%', getValue: s => s.growth.acqVol },
    { path: 'growth.acqSpread', label: 'Acquisition Spread', unit: 'bps', getValue: s => s.growth.acqSpread },
    { path: 'growth.devVol', label: 'Development Volume', unit: '%', getValue: s => s.growth.devVol },
    { path: 'growth.devSpread', label: 'Development Spread', unit: 'bps', getValue: s => s.growth.devSpread },
    { path: 'growth.leakage', label: 'CAD Leakage', unit: '%', getValue: s => s.growth.leakage },
  ];

  const deltas: ScenarioDelta[] = [];

  // Output metrics
  for (const def of metricDefs) {
    const values = scenarios.map(s => s.metrics[def.metric]);
    const baseValue = baseScenario.metrics[def.metric];
    const deltaValues = values.map(v => v - baseValue);

    deltas.push({
      metric: def.metric,
      label: def.label,
      values,
      baseValue,
      deltas: deltaValues,
      unit: def.unit,
    });
  }

  // Input parameters
  for (const def of inputDefs) {
    const values = scenarios.map(s => def.getValue(s));
    const baseValue = def.getValue(baseScenario);
    const deltaValues = values.map(v => v - baseValue);

    deltas.push({
      metric: def.path,
      label: def.label,
      values,
      baseValue,
      deltas: deltaValues,
      unit: def.unit,
    });
  }

  return { scenarios, deltas };
};

// ─── Supabase Persistence (Optional) ──────────────────────────────────────────

/**
 * Sync a scenario to Supabase if user is authenticated
 * Table: scenarios (id, user_id, name, ticker, wacc, growth, metrics, tags, created_at, updated_at)
 */
export const syncScenarioToSupabase = async (
  scenario: Scenario,
  userId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('scenarios').upsert({
      id: scenario.id,
      user_id: userId,
      name: scenario.name,
      ticker: scenario.ticker,
      wacc: scenario.wacc,
      growth: scenario.growth,
      metrics: scenario.metrics,
      tags: scenario.tags || [],
      created_at: scenario.createdAt,
      updated_at: scenario.updatedAt,
    });

    if (error) {
      // Supabase sync failed
      return false;
    }

    return true;
  } catch (e) {
    // Supabase sync error
    return false;
  }
};

/**
 * Load all scenarios from Supabase for a user
 */
export const loadScenariosFromSupabase = async (
  userId: string,
  ticker?: string
): Promise<Scenario[]> => {
  try {
    let query = supabase
      .from('scenarios')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (ticker) {
      query = query.eq('ticker', ticker);
    }

    const { data, error } = await query;

    if (error || !data) {
      // Supabase load failed
      return [];
    }

    return data.map((d: any) => ({
      id: d.id,
      name: d.name,
      ticker: d.ticker,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      wacc: d.wacc,
      growth: d.growth,
      metrics: d.metrics,
      tags: d.tags || [],
    }));
  } catch (e) {
    // Supabase load error
    return [];
  }
};

/**
 * Delete scenario from Supabase
 */
export const deleteScenarioFromSupabase = async (
  scenarioId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', scenarioId)
      .eq('user_id', userId);

    return !error;
  } catch {
    return false;
  }
};

// ─── Preset Scenarios ─────────────────────────────────────────────────────────

/**
 * Generate preset Bull/Base/Bear scenarios for a given ticker
 */
export const generatePresetScenarios = (
  ticker: string,
  baseWacc: WaccParams,
  baseGrowth: GrowthParams,
  impliedCapRate: number = 5.0,
  currentAFFO: number = 1.0
): Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>[] => {
  return [
    {
      name: 'Base Case',
      ticker,
      wacc: { ...baseWacc },
      growth: { ...baseGrowth },
      metrics: calculateScenarioMetrics(baseWacc, baseGrowth, impliedCapRate, currentAFFO),
      tags: ['preset', 'base'],
    },
    {
      name: 'Bull Case',
      ticker,
      wacc: {
        ...baseWacc,
        rf: baseWacc.rf - 0.5,
        erp: baseWacc.erp - 0.3,
      },
      growth: {
        ...baseGrowth,
        ss: baseGrowth.ss + 1.0,
        acqSpread: baseGrowth.acqSpread + 30,
        devSpread: baseGrowth.devSpread + 30,
        leakage: baseGrowth.leakage + 0.3,
      },
      metrics: calculateScenarioMetrics(
        { ...baseWacc, rf: baseWacc.rf - 0.5, erp: baseWacc.erp - 0.3 },
        {
          ...baseGrowth,
          ss: baseGrowth.ss + 1.0,
          acqSpread: baseGrowth.acqSpread + 30,
          devSpread: baseGrowth.devSpread + 30,
          leakage: baseGrowth.leakage + 0.3,
        },
        impliedCapRate,
        currentAFFO
      ),
      tags: ['preset', 'bull'],
    },
    {
      name: 'Bear Case',
      ticker,
      wacc: {
        ...baseWacc,
        rf: baseWacc.rf + 0.75,
        erp: baseWacc.erp + 0.5,
      },
      growth: {
        ...baseGrowth,
        ss: baseGrowth.ss - 1.5,
        acqVol: baseGrowth.acqVol * 0.5,
        acqSpread: baseGrowth.acqSpread - 40,
        devVol: baseGrowth.devVol * 0.5,
        leakage: baseGrowth.leakage - 0.5,
      },
      metrics: calculateScenarioMetrics(
        { ...baseWacc, rf: baseWacc.rf + 0.75, erp: baseWacc.erp + 0.5 },
        {
          ...baseGrowth,
          ss: baseGrowth.ss - 1.5,
          acqVol: baseGrowth.acqVol * 0.5,
          acqSpread: baseGrowth.acqSpread - 40,
          devVol: baseGrowth.devVol * 0.5,
          leakage: baseGrowth.leakage - 0.5,
        },
        impliedCapRate,
        currentAFFO
      ),
      tags: ['preset', 'bear'],
    },
  ];
};
