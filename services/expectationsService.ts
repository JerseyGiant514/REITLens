
import { HistoricalLookback, ExpectationsData, Sector, FinancialsQuarterly } from '../types';
import { REITS, INSTITUTIONAL_PROFILES, getInstitutionalProfile } from './reitRegistry';
import { loadRealFinancials, getMarketDataSync } from './dataService';

// ============================================================================
// PERCENTILE DISTRIBUTION TYPES
// ============================================================================

export interface DistributionStats {
  low: number;   // 5th percentile
  p25: number;   // 25th percentile
  med: number;   // 50th percentile (median)
  p75: number;   // 75th percentile
  high: number;  // 95th percentile
}

export interface SectorExpectations {
  g: DistributionStats;
  cap: DistributionStats;
  multiple: DistributionStats;
  nav: DistributionStats;
  spread: DistributionStats;
}

// ============================================================================
// PERCENTILE COMPUTATION UTILITIES
// ============================================================================

/**
 * Compute a specific percentile from a sorted array of numbers.
 * Uses linear interpolation between values.
 * @param sorted - Pre-sorted array of numbers (ascending)
 * @param p - Percentile as fraction (0.0 to 1.0)
 */
function sortedPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * Compute the full 5-percentile distribution from a set of values.
 * Returns { low (5th), p25, med (50th), p75, high (95th) }.
 */
function computeDistribution(values: number[]): DistributionStats | null {
  if (values.length < 2) return null;

  const sorted = [...values].sort((a, b) => a - b);
  return {
    low: sortedPercentile(sorted, 0.05),
    p25: sortedPercentile(sorted, 0.25),
    med: sortedPercentile(sorted, 0.50),
    p75: sortedPercentile(sorted, 0.75),
    high: sortedPercentile(sorted, 0.95),
  };
}

// ============================================================================
// HARDCODED FALLBACK VALUES (original implementation)
// ============================================================================

function getHardcodedBase(sector: Sector): { g: number; cap: number; multiple: number } {
  const isGrowth = sector === Sector.INDUSTRIAL || sector === Sector.DATA_CENTERS || sector === Sector.TOWERS;
  const isDistressed = sector === Sector.OFFICE;
  const isSFR = sector === Sector.SFR;

  return {
    g: isGrowth ? 4.5 : isSFR ? 3.8 : isDistressed ? -1.5 : 2.5,
    cap: isGrowth ? 4.2 : isSFR ? 5.2 : isDistressed ? 8.5 : 5.8,
    multiple: isGrowth ? 26.4 : isSFR ? 22.5 : isDistressed ? 10.5 : 16.5
  };
}

function getHardcodedVolatility(sector: Sector): { g: number; cap: number; multiple: number } {
  const isGrowth = sector === Sector.INDUSTRIAL || sector === Sector.DATA_CENTERS || sector === Sector.TOWERS;
  return {
    g: isGrowth ? 1.5 : 1.0,
    cap: 0.8,
    multiple: 4.0
  };
}

function buildHardcodedLookback(type: 'g' | 'cap' | 'multiple', sector: Sector): HistoricalLookback[] {
  const base = getHardcodedBase(sector);
  const volatility = getHardcodedVolatility(sector);
  const periods: ('1Y' | '3Y' | '5Y' | '10Y')[] = ['1Y', '3Y', '5Y', '10Y'];

  return periods.map(period => {
    const multiplier = period === '1Y' ? 1.1 : period === '3Y' ? 1.05 : period === '5Y' ? 1.0 : 0.95;
    const med = base[type] * multiplier;
    const vol = volatility[type];

    return {
      period,
      median: med,
      low: med - vol * 2,
      p25: med - vol * 0.67,
      p75: med + vol * 0.67,
      high: med + vol * 2
    };
  });
}

/** Hardcoded NAV distribution fallback */
const HARDCODED_NAV_STATS: DistributionStats = {
  low: 75.0, p25: 88.0, med: 98.0, p75: 108.0, high: 125.0
};

/** Hardcoded Spread-to-10Y distribution fallback (in bps * 100 for display) */
const HARDCODED_SPREAD_STATS: DistributionStats = {
  low: 50, p25: 125, med: 175, p75: 225, high: 300
};

// ============================================================================
// DATA-DRIVEN SECTOR EXPECTATIONS COMPUTATION
// ============================================================================

/** Cache for computed sector expectations */
const sectorExpectationsCache: Map<string, { data: SectorExpectations; timestamp: number }> = new Map();
const SECTOR_CACHE_MS = 1000 * 60 * 10; // 10 minute cache

/**
 * Get all REIT tickers in the same sector as the given ticker.
 */
function getSectorPeers(ticker: string): string[] {
  const reit = REITS.find(r => r.ticker === ticker);
  if (!reit) return [];

  return REITS
    .filter(r => r.sector === reit.sector && r.isActive)
    .map(r => r.ticker);
}

/**
 * Compute YoY revenue growth rates from quarterly financial data.
 * Compares each quarter to the same quarter one year prior (4 quarters back).
 * Returns growth rates as percentages.
 */
function computeRevenueGrowthRates(financials: FinancialsQuarterly[]): number[] {
  if (financials.length < 5) return [];

  const growthRates: number[] = [];
  for (let i = 4; i < financials.length; i++) {
    const current = financials[i].revenue;
    const prior = financials[i - 4].revenue;
    if (prior > 0 && current > 0) {
      growthRates.push(((current - prior) / prior) * 100);
    }
  }
  return growthRates;
}

/**
 * Compute NOI growth rates from quarterly financial data.
 * Falls back to revenue growth if NOI is unavailable.
 */
function computeNOIGrowthRates(financials: FinancialsQuarterly[]): number[] {
  if (financials.length < 5) return [];

  const growthRates: number[] = [];
  for (let i = 4; i < financials.length; i++) {
    const currentNOI = financials[i].noi;
    const priorNOI = financials[i - 4].noi;
    if (priorNOI > 0 && currentNOI > 0) {
      growthRates.push(((currentNOI - priorNOI) / priorNOI) * 100);
    }
  }

  // Fall back to revenue growth if NOI growth is empty
  if (growthRates.length === 0) {
    return computeRevenueGrowthRates(financials);
  }
  return growthRates;
}

/**
 * Compute implied cap rate from the latest financials and market data.
 * Cap Rate = TTM NOI / Enterprise Value
 * Returns as percentage.
 */
function computeImpliedCapRate(financials: FinancialsQuarterly[], reitId: string): number | null {
  if (financials.length < 4) return null;

  const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
  if (ttmNOI <= 0) return null;

  const latest = financials[financials.length - 1];
  const marketData = getMarketDataSync(reitId);
  if (marketData.length === 0) return null;

  const latestMarket = marketData[marketData.length - 1];
  const mktCap = latestMarket.closePrice * latest.dilutedShares;
  const ev = mktCap + latest.totalDebt;

  if (ev <= 0) return null;
  return (ttmNOI / ev) * 100;
}

/**
 * Compute P/FFO (or EV/NOI) proxy multiple from the latest financials.
 * Uses EV/NOI as a cleaner leverage-adjusted alternative.
 */
function computeMultiple(financials: FinancialsQuarterly[], reitId: string): number | null {
  if (financials.length < 4) return null;

  const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
  if (ttmNOI <= 0) return null;

  const latest = financials[financials.length - 1];
  const marketData = getMarketDataSync(reitId);
  if (marketData.length === 0) return null;

  const latestMarket = marketData[marketData.length - 1];
  const mktCap = latestMarket.closePrice * latest.dilutedShares;
  const ev = mktCap + latest.totalDebt;

  if (ev <= 0) return null;
  return ev / ttmNOI;
}

/**
 * Compute Price/NAV estimate for a REIT.
 * NAV = (NOI / sectorMedianCapRate) - Debt
 * Returns as percentage (100 = at NAV, >100 = premium, <100 = discount).
 */
function computePriceToNAV(
  financials: FinancialsQuarterly[],
  reitId: string,
  sectorMedianCapRate: number
): number | null {
  if (financials.length < 4 || sectorMedianCapRate <= 0) return null;

  const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
  if (ttmNOI <= 0) return null;

  const latest = financials[financials.length - 1];
  const marketData = getMarketDataSync(reitId);
  if (marketData.length === 0) return null;

  const latestMarket = marketData[marketData.length - 1];
  const mktCap = latestMarket.closePrice * latest.dilutedShares;

  const gavEstimate = ttmNOI / (sectorMedianCapRate / 100);
  const navEstimate = gavEstimate - latest.totalDebt;

  if (navEstimate <= 0) return null;
  return (mktCap / navEstimate) * 100;
}

/**
 * Compute the full sector expectations from real data across all sector peers.
 * This is the main data-driven computation function.
 *
 * @param ticker - The ticker to find sector peers for
 * @returns A promise resolving to computed SectorExpectations, or null if insufficient data
 */
export async function computeSectorExpectations(ticker: string): Promise<SectorExpectations | null> {
  const cacheKey = `sector:${ticker}`;
  const cached = sectorExpectationsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SECTOR_CACHE_MS) {
    return cached.data;
  }

  const peers = getSectorPeers(ticker);
  if (peers.length === 0) return null;

  // Load financials for all sector peers in parallel
  const peerREITs = peers.map(t => REITS.find(r => r.ticker === t)!).filter(Boolean);
  const peerFinancials: Map<string, FinancialsQuarterly[]> = new Map();

  await Promise.all(
    peerREITs.map(async (reit) => {
      try {
        const financials = await loadRealFinancials(reit.id);
        if (financials.length > 0) {
          peerFinancials.set(reit.id, financials);
        }
      } catch {
        // Skip this peer if data loading fails
      }
    })
  );

  // Need at least 2 peers with data to compute a meaningful distribution
  if (peerFinancials.size < 2) return null;

  // ── Collect growth rates across all peers ──
  const allGrowthRates: number[] = [];
  for (const [, financials] of peerFinancials) {
    allGrowthRates.push(...computeNOIGrowthRates(financials));
  }

  // ── Collect implied cap rates ──
  const allCapRates: number[] = [];
  for (const [reitId, financials] of peerFinancials) {
    const cap = computeImpliedCapRate(financials, reitId);
    if (cap !== null && cap > 0 && cap < 20) {
      allCapRates.push(cap);
    }
  }

  // ── Collect EV/NOI multiples ──
  const allMultiples: number[] = [];
  for (const [reitId, financials] of peerFinancials) {
    const mult = computeMultiple(financials, reitId);
    if (mult !== null && mult > 0 && mult < 60) {
      allMultiples.push(mult);
    }
  }

  // Compute distributions
  const gDist = computeDistribution(allGrowthRates);
  const capDist = computeDistribution(allCapRates);
  const multDist = computeDistribution(allMultiples);

  // If we couldn't compute any of the core distributions, return null
  if (!gDist || !capDist || !multDist) return null;

  // ── Compute NAV distribution using the computed median cap rate ──
  const allNavRatios: number[] = [];
  for (const [reitId, financials] of peerFinancials) {
    const navRatio = computePriceToNAV(financials, reitId, capDist.med);
    if (navRatio !== null && navRatio > 0 && navRatio < 300) {
      allNavRatios.push(navRatio);
    }
  }
  const navDist = computeDistribution(allNavRatios) || HARDCODED_NAV_STATS;

  // ── Compute spread distribution (implied cap rate - 10Y proxy) ──
  // Since we don't have live treasury data in this service, we store the
  // cap rate distribution and let the component compute spreads.
  // Instead, use the institutional profiles' baselineCapRate as a proxy
  // for what "normal" spreads look like in this sector.
  const allSpreads: number[] = [];
  for (const peerTicker of peers) {
    const profile = getInstitutionalProfile(peerTicker);
    // Spread estimate = baseline cap rate (%) * 100 to get bps-like values
    // relative to a ~4.25% treasury => spread ~ (capRate - 4.25) * 100 bps
    const capRatePercent = profile.baselineCapRate * 100;
    const spreadBps = (capRatePercent - 4.25) * 100;
    if (spreadBps > -200 && spreadBps < 800) {
      allSpreads.push(spreadBps);
    }
  }
  // Also include actual implied cap rate spreads from computed data
  for (const cap of allCapRates) {
    const spreadBps = (cap - 4.25) * 100;
    if (spreadBps > -200 && spreadBps < 800) {
      allSpreads.push(spreadBps);
    }
  }
  const spreadDist = computeDistribution(allSpreads) || HARDCODED_SPREAD_STATS;

  const result: SectorExpectations = {
    g: gDist,
    cap: capDist,
    multiple: multDist,
    nav: navDist,
    spread: spreadDist,
  };

  sectorExpectationsCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// ============================================================================
// DATA-DRIVEN LOOKBACK BUILDER
// ============================================================================

/**
 * Convert a DistributionStats into HistoricalLookback entries for all periods.
 * For real data we use the same distribution for all lookback periods (since we
 * have limited historical depth), but scale slightly to simulate the period effect
 * that shorter lookbacks are more volatile.
 */
function distributionToLookbacks(dist: DistributionStats): HistoricalLookback[] {
  const periods: ('1Y' | '3Y' | '5Y' | '10Y')[] = ['1Y', '3Y', '5Y', '10Y'];

  return periods.map(period => {
    // Shorter periods have slightly wider distributions
    const widthScale = period === '1Y' ? 1.15 : period === '3Y' ? 1.08 : period === '5Y' ? 1.0 : 0.95;
    // Shorter periods can have slightly shifted medians (more recent trends)
    const centerScale = period === '1Y' ? 1.05 : period === '3Y' ? 1.02 : period === '5Y' ? 1.0 : 0.98;

    const med = dist.med * centerScale;
    const halfRange = (dist.high - dist.low) / 2;
    const scaledHalfRange = halfRange * widthScale;
    const center = (dist.high + dist.low) / 2 * centerScale;

    return {
      period,
      median: med,
      low: center - scaledHalfRange,
      p25: med - (med - dist.p25) * widthScale,
      p75: med + (dist.p75 - med) * widthScale,
      high: center + scaledHalfRange,
    };
  });
}

// ============================================================================
// ASYNC LOOKBACK COMPUTATION (data-driven with hardcoded fallback)
// ============================================================================

/** Cache for computed lookbacks keyed by "sector:type" */
const computedLookbackCache: Map<string, { data: HistoricalLookback[]; timestamp: number }> = new Map();
const LOOKBACK_CACHE_MS = 1000 * 60 * 10; // 10 minute cache

/**
 * Async version of getHistoricalLookbacks that computes from real data.
 * Falls back to hardcoded values if computation fails.
 *
 * @param type - The metric type: 'g' (growth), 'cap' (cap rate), or 'multiple'
 * @param sector - The REIT sector
 * @param ticker - Optional ticker to identify sector peers from
 * @returns Promise resolving to HistoricalLookback array
 */
export async function computeHistoricalLookbacks(
  type: 'g' | 'cap' | 'multiple',
  sector: Sector,
  ticker?: string
): Promise<HistoricalLookback[]> {
  const cacheKey = `lookback:${sector}:${type}`;
  const cached = computedLookbackCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LOOKBACK_CACHE_MS) {
    return cached.data;
  }

  try {
    // Find a ticker in this sector if not provided
    const sectorTicker = ticker || REITS.find(r => r.sector === sector)?.ticker;
    if (!sectorTicker) return buildHardcodedLookback(type, sector);

    const expectations = await computeSectorExpectations(sectorTicker);
    if (!expectations) return buildHardcodedLookback(type, sector);

    const dist = expectations[type];
    const lookbacks = distributionToLookbacks(dist);

    computedLookbackCache.set(cacheKey, { data: lookbacks, timestamp: Date.now() });
    return lookbacks;

  } catch {
    return buildHardcodedLookback(type, sector);
  }
}

// ============================================================================
// ORIGINAL SYNCHRONOUS API (backward-compatible)
// ============================================================================

/**
 * Get historical lookback distributions for a metric type and sector.
 * This is the SYNCHRONOUS version that returns immediately.
 * It checks for previously computed data in cache, falling back to hardcoded values.
 *
 * For data-driven results, call `computeHistoricalLookbacks()` first (async),
 * then this function will return the cached computed data on subsequent calls.
 */
export const getHistoricalLookbacks = (type: 'g' | 'cap' | 'multiple', sector: Sector): HistoricalLookback[] => {
  // Check if we have computed data in cache
  const cacheKey = `lookback:${sector}:${type}`;
  const cached = computedLookbackCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LOOKBACK_CACHE_MS) {
    return cached.data;
  }

  // Fall back to hardcoded values (original behavior)
  return buildHardcodedLookback(type, sector);
};

export const calculatePercentile = (value: number, lookback: HistoricalLookback): number => {
  if (value <= lookback.low) return 0;
  if (value >= lookback.high) return 100;
  return ((value - lookback.low) / (lookback.high - lookback.low)) * 100;
};

export const getExpectationsStatus = (impliedG: number, historicalG: HistoricalLookback) => {
  const percentile = calculatePercentile(impliedG, historicalG);

  if (percentile > 90) return { label: 'Priced for Perfection', color: 'rose-500', description: 'Market implies 99th percentile growth. High risk of disappointment.' };
  if (percentile > 75) return { label: 'Aggressive', color: 'pumpkin', description: 'Market expectations are significantly above historical medians.' };
  if (percentile < 10) return { label: 'Priced for Disaster', color: 'emerald-400', description: 'Market implies 1st percentile growth. Potential deep value or value trap.' };
  if (percentile < 25) return { label: 'Depressed', color: 'emerald-500', description: 'Market expectations are well below historical norms.' };

  return { label: 'Fairly Valued', color: 'slate-400', description: 'Market expectations align with historical reality.' };
};

export const checkValueTrap = (ticker: string, sector: Sector, impliedG: number, historicalG: HistoricalLookback, payoutRatio: number) => {
  const isLowExpectation = calculatePercentile(impliedG, historicalG) < 25;
  const isOffice = sector === Sector.OFFICE;
  const isHighPayout = payoutRatio > 95;

  if (isLowExpectation) {
    if (isOffice || isHighPayout) {
      return { status: 'Value Trap', reason: isOffice ? 'Structural sector decline' : 'Dividend at risk (High Payout)' };
    }
    return { status: 'Cheap', reason: 'Priced in growth is at odds with historical median without clear secular decline' };
  }

  return { status: 'Neutral', reason: 'Valuation within normal expectations range' };
};

// ============================================================================
// CONVENIENCE: Get hardcoded fallback stats (for use in components)
// ============================================================================

/** Get the hardcoded NAV distribution stats (used as fallback in Valuation.tsx) */
export function getHardcodedNavStats(): DistributionStats {
  return { ...HARDCODED_NAV_STATS };
}

/** Get the hardcoded spread-to-10Y distribution stats (used as fallback) */
export function getHardcodedSpreadStats(): DistributionStats {
  return { ...HARDCODED_SPREAD_STATS };
}
