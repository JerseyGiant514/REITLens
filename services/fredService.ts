/**
 * FRED API Service
 * Fetches real macroeconomic data from the Federal Reserve Economic Data (FRED) API.
 *
 * Series used:
 *   DGS10          - 10-Year Treasury Constant Maturity Rate (daily)
 *   BAMLH0A0HYM2   - ICE BofA US High Yield Index Option-Adjusted Spread (daily)
 *   FEDFUNDS        - Effective Federal Funds Rate (monthly)
 *   CPIAUCSL        - Consumer Price Index for All Urban Consumers (monthly)
 *
 * API docs: https://fred.stlouisfed.org/docs/api/fred/
 * Rate limit: 120 requests/minute per API key
 *
 * Falls back to synthetic data when VITE_FRED_API_KEY is not configured.
 */

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

// 1-hour cache TTL (macro data updates at most daily)
const CACHE_TTL_MS = 1000 * 60 * 60;

export interface FREDObservation {
  date: string;
  value: number;
}

export interface FREDSeriesData {
  seriesId: string;
  seriesName: string;
  observations: FREDObservation[];
  lastUpdated: Date | null;
  source: 'FRED' | 'Mock';
  unit: string;
}

export interface MacroSnapshot {
  yield10y: FREDSeriesData;
  hySpread: FREDSeriesData;
  fedFunds: FREDSeriesData;
  cpi: FREDSeriesData;
  fetchedAt: Date;
}

interface CachedMacroData {
  data: MacroSnapshot;
  timestamp: number;
}

// In-memory cache
let macroCache: CachedMacroData | null = null;

// Per-series cache for individual fetches
const seriesCache: Map<string, { data: FREDSeriesData; timestamp: number }> = new Map();

const SERIES_CONFIG: Record<string, { name: string; unit: string }> = {
  DGS10: { name: '10-Year Treasury Yield', unit: 'Percent' },
  BAMLH0A0HYM2: { name: 'ICE BofA US HY OAS', unit: 'Percent' },
  FEDFUNDS: { name: 'Effective Federal Funds Rate', unit: 'Percent' },
  CPIAUCSL: { name: 'CPI All Urban Consumers', unit: 'Index 1982-84=100' },
};

/**
 * Get the FRED API key from environment
 */
function getFredApiKey(): string | null {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const key = import.meta.env.VITE_FRED_API_KEY as string;
      if (key && key.length > 0 && key !== 'undefined') return key;
    }
  } catch {
    // import.meta not available
  }
  try {
    const key = process.env.VITE_FRED_API_KEY;
    if (key && key.length > 0) return key;
  } catch {
    // process.env not available
  }
  return null;
}

/**
 * Fetch a single FRED series
 */
async function fetchFREDSeries(
  seriesId: string,
  startDate: string,
  endDate?: string
): Promise<FREDSeriesData> {
  const apiKey = getFredApiKey();
  const config = SERIES_CONFIG[seriesId] || { name: seriesId, unit: 'Unknown' };

  // Check per-series cache
  const cacheKey = `${seriesId}:${startDate}`;
  const cached = seriesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!apiKey) {
    // no API key configured, using synthetic data
    const synthetic = generateSyntheticSeries(seriesId, startDate, endDate);
    return synthetic;
  }

  try {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: apiKey,
      file_type: 'json',
      observation_start: startDate,
      sort_order: 'asc',
    });

    if (endDate) {
      params.set('observation_end', endDate);
    }

    const url = `${FRED_BASE_URL}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FRED API returned ${response.status} for ${seriesId}`);
    }

    const json = await response.json();

    if (!json.observations || json.observations.length === 0) {
      // no observations returned, using synthetic data
      return generateSyntheticSeries(seriesId, startDate, endDate);
    }

    // Parse observations, filtering out "." (missing data marker in FRED)
    const observations: FREDObservation[] = json.observations
      .filter((obs: any) => obs.value !== '.' && obs.value != null)
      .map((obs: any) => ({
        date: obs.date,
        value: parseFloat(obs.value),
      }));

    const lastObs = observations.length > 0
      ? new Date(observations[observations.length - 1].date)
      : null;

    const result: FREDSeriesData = {
      seriesId,
      seriesName: config.name,
      observations,
      lastUpdated: lastObs,
      source: 'FRED',
      unit: config.unit,
    };

    // Cache the result
    seriesCache.set(cacheKey, { data: result, timestamp: Date.now() });
    // FRED data fetched successfully

    return result;
  } catch (error: any) {
    // FRED fetch failed, using synthetic data
    return generateSyntheticSeries(seriesId, startDate, endDate);
  }
}

/**
 * Generate synthetic data for a FRED series when API key is not available.
 * Clearly marks data as Mock source.
 */
function generateSyntheticSeries(
  seriesId: string,
  startDate: string,
  endDate?: string
): FREDSeriesData {
  const config = SERIES_CONFIG[seriesId] || { name: seriesId, unit: 'Unknown' };
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const observations: FREDObservation[] = [];

  // Base values and volatility by series
  const seriesParams: Record<string, { base: number; amplitude: number; frequency: number }> = {
    DGS10: { base: 4.25, amplitude: 0.40, frequency: 0.02 },
    BAMLH0A0HYM2: { base: 3.50, amplitude: 0.30, frequency: 0.015 },
    FEDFUNDS: { base: 5.25, amplitude: 0.15, frequency: 0.01 },
    CPIAUCSL: { base: 310, amplitude: 3.0, frequency: 0.005 },
  };

  const params = seriesParams[seriesId] || { base: 2.0, amplitude: 0.5, frequency: 0.02 };

  // Determine step: daily for DGS10/BAMLH0A0HYM2, monthly for FEDFUNDS/CPIAUCSL
  const isDaily = seriesId === 'DGS10' || seriesId === 'BAMLH0A0HYM2';
  const stepDays = isDaily ? 1 : 30;

  let current = new Date(start);
  let i = 0;
  while (current <= end) {
    // Skip weekends for daily series
    if (isDaily) {
      const dow = current.getDay();
      if (dow === 0 || dow === 6) {
        current.setDate(current.getDate() + 1);
        continue;
      }
    }

    const value = params.base + Math.sin(i * params.frequency) * params.amplitude;
    observations.push({
      date: current.toISOString().split('T')[0],
      value: parseFloat(value.toFixed(4)),
    });

    current.setDate(current.getDate() + stepDays);
    i++;
  }

  return {
    seriesId,
    seriesName: `${config.name} (SYNTHETIC)`,
    observations,
    lastUpdated: null,
    source: 'Mock',
    unit: config.unit,
  };
}

/**
 * Fetch all macro series for the Macro dashboard.
 * Returns a MacroSnapshot with all four series.
 * Uses a single combined cache.
 */
export async function fetchMacroSnapshot(
  lookbackDays: number = 365
): Promise<MacroSnapshot> {
  // Check combined cache
  if (macroCache && Date.now() - macroCache.timestamp < CACHE_TTL_MS) {
    return macroCache.data;
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startStr = startDate.toISOString().split('T')[0];

  // Fetch all series in parallel
  const [yield10y, hySpread, fedFunds, cpi] = await Promise.all([
    fetchFREDSeries('DGS10', startStr),
    fetchFREDSeries('BAMLH0A0HYM2', startStr),
    fetchFREDSeries('FEDFUNDS', startStr),
    fetchFREDSeries('CPIAUCSL', startStr),
  ]);

  const snapshot: MacroSnapshot = {
    yield10y,
    hySpread,
    fedFunds,
    cpi,
    fetchedAt: new Date(),
  };

  macroCache = { data: snapshot, timestamp: Date.now() };
  return snapshot;
}

/**
 * Get a single FRED series (useful for individual chart components).
 */
export async function getFREDSeries(
  seriesId: string,
  lookbackDays: number = 365
): Promise<FREDSeriesData> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);
  const startStr = startDate.toISOString().split('T')[0];

  return fetchFREDSeries(seriesId, startStr);
}

/**
 * Get the latest observation for a FRED series.
 */
export function getLatestValue(series: FREDSeriesData): FREDObservation | null {
  if (!series.observations || series.observations.length === 0) return null;
  return series.observations[series.observations.length - 1];
}

/**
 * Compute week-over-week change in basis points.
 */
export function computeWoWChangeBps(series: FREDSeriesData): number | null {
  const obs = series.observations;
  if (!obs || obs.length < 6) return null;

  const latest = obs[obs.length - 1].value;
  // Find the observation ~5 trading days ago
  const weekAgo = obs[Math.max(0, obs.length - 6)].value;
  return Math.round((latest - weekAgo) * 100);
}

/**
 * Build time-aligned chart data from multiple FRED series.
 * Merges observations by date and forward-fills missing values.
 */
export function buildAlignedChartData(
  series: FREDSeriesData[],
  keys: string[]
): Array<Record<string, any>> {
  // Collect all unique dates
  const dateSet = new Set<string>();
  series.forEach(s => s.observations.forEach(o => dateSet.add(o.date)));
  const allDates = Array.from(dateSet).sort();

  // Build lookup maps
  const lookups = series.map(s => {
    const map = new Map<string, number>();
    s.observations.forEach(o => map.set(o.date, o.value));
    return map;
  });

  // Merge with forward-fill
  const result: Array<Record<string, any>> = [];
  const lastValues: number[] = new Array(series.length).fill(0);

  for (const date of allDates) {
    const row: Record<string, any> = { date };
    for (let i = 0; i < series.length; i++) {
      const val = lookups[i].get(date);
      if (val !== undefined) {
        lastValues[i] = val;
      }
      row[keys[i]] = lastValues[i];
    }
    result.push(row);
  }

  return result;
}

/**
 * Clear FRED cache (useful for manual refresh).
 */
export function clearFREDCache(): void {
  macroCache = null;
  seriesCache.clear();
  // cache cleared
}

/**
 * Check if the FRED API key is configured.
 */
export function isFREDConfigured(): boolean {
  return getFredApiKey() !== null;
}
