/**
 * Dividend Service
 * Provides real dividend data for REITs from multiple sources:
 *
 *   1. Supabase `historical_financials` table (if dividend_per_share is populated)
 *   2. SEC EDGAR XBRL companyfacts endpoint (direct fetch as fallback)
 *   3. Institutional profiles in mockData.ts (final fallback)
 *
 * XBRL Fields for Dividends (for Agent 1 / edgarService.ts to add):
 *   - CommonStockDividendsPerShareDeclared (us-gaap) [preferred - per-share declared]
 *   - CommonStockDividendsPerShareCashPaid (us-gaap) [per-share actually paid]
 *   - PaymentsOfDividends (us-gaap) [aggregate cash outflow, in USD]
 *   - PaymentsOfDividendsCommonStock (us-gaap) [common-only dividends paid]
 *   - DividendsCommonStock (us-gaap) [total common dividends, may include preferred]
 *
 * The preferred approach is: CommonStockDividendsPerShareDeclared * 4 quarters / current price
 */

import { supabase } from './supabaseClient';
import { REITS } from './mockData';

const SEC_BASE_URL = 'https://data.sec.gov/api/xbrl/companyfacts';
const USER_AGENT = 'REITLens Analytics Platform admin@reitlens.com';

// Cache: ticker -> dividend data with timestamp
interface DividendCacheEntry {
  data: DividendData;
  timestamp: number;
}

const dividendCache: Map<string, DividendCacheEntry> = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

export interface QuarterlyDividend {
  fiscalDate: string;
  dpsPerShare: number | null;    // Dividends per share declared
  totalDividendsPaid: number | null; // Aggregate dividends paid (in USD)
  period: string;                // Q1, Q2, Q3, Q4
  source: 'DB' | 'EDGAR' | 'Estimated';
}

export interface DividendData {
  ticker: string;
  quarterlyDividends: QuarterlyDividend[];
  trailing12mDPS: number;        // Sum of last 4 quarters DPS
  annualizedDividendYield: number; // TTM DPS / current price * 100
  currentPrice: number | null;
  lastUpdated: Date | null;
  source: 'DB' | 'EDGAR' | 'Estimated';
  isEstimated: boolean;
}

/**
 * CIK lookup - uses the REITS array from mockData
 */
function getCIK(ticker: string): string | null {
  const reit = REITS.find(r => r.ticker === ticker);
  return reit ? reit.cik.replace(/^0+/, '') : null;
}

/**
 * Get current share price from the REIT definition (nominal price).
 * In a production system, this would call marketDataService.
 */
function getCurrentPrice(ticker: string): number {
  const reit = REITS.find(r => r.ticker === ticker);
  return reit ? reit.nominalPrice : 100;
}

/**
 * Get dividend data for a ticker.
 * Tries DB first, then EDGAR, then falls back to institutional profile estimates.
 */
export async function getDividendData(ticker: string): Promise<DividendData> {
  // Check cache
  const cached = dividendCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Attempt 1: Query Supabase for dividend data
  const dbResult = await fetchDividendsFromDB(ticker);
  if (dbResult && dbResult.quarterlyDividends.length >= 4) {
    dividendCache.set(ticker, { data: dbResult, timestamp: Date.now() });
    return dbResult;
  }

  // Attempt 2: Fetch directly from SEC EDGAR
  const edgarResult = await fetchDividendsFromEDGAR(ticker);
  if (edgarResult && edgarResult.quarterlyDividends.length >= 4) {
    dividendCache.set(ticker, { data: edgarResult, timestamp: Date.now() });
    return edgarResult;
  }

  // Attempt 3: Fallback to institutional profile estimate
  const fallback = getEstimatedDividends(ticker);
  dividendCache.set(ticker, { data: fallback, timestamp: Date.now() });
  return fallback;
}

/**
 * Fetch dividend data from Supabase historical_financials table.
 * Requires that dividend_per_share column is populated (Agent 1 backfill).
 */
async function fetchDividendsFromDB(ticker: string): Promise<DividendData | null> {
  try {
    const { data: reitData } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', ticker)
      .single();

    if (!reitData) return null;

    const { data: financials, error } = await supabase
      .from('historical_financials')
      .select('fiscal_date, period, dividend_per_share, data_source')
      .eq('reit_id', reitData.id)
      .order('fiscal_date', { ascending: false })
      .limit(8);

    if (error || !financials || financials.length === 0) return null;

    // Check if dividend_per_share is actually populated
    const withDPS = financials.filter(f => f.dividend_per_share != null && f.dividend_per_share > 0);
    if (withDPS.length === 0) return null;

    const currentPrice = getCurrentPrice(ticker);
    const quarterlyDividends: QuarterlyDividend[] = withDPS.map(f => ({
      fiscalDate: f.fiscal_date,
      dpsPerShare: f.dividend_per_share,
      totalDividendsPaid: null, // Not stored per-quarter in this table
      period: f.period || 'Unknown',
      source: 'DB' as const,
    }));

    // Trailing 12-month DPS = sum of most recent 4 quarters
    const last4 = quarterlyDividends.slice(0, 4);
    const trailing12mDPS = last4.reduce((sum, q) => sum + (q.dpsPerShare || 0), 0);
    const annualizedDividendYield = currentPrice > 0 ? (trailing12mDPS / currentPrice) * 100 : 0;

    const lastDate = withDPS.length > 0 ? new Date(withDPS[0].fiscal_date) : null;

    return {
      ticker,
      quarterlyDividends,
      trailing12mDPS,
      annualizedDividendYield,
      currentPrice,
      lastUpdated: lastDate,
      source: 'DB',
      isEstimated: false,
    };
  } catch (e) {
    // DB fetch failed, will try EDGAR
    return null;
  }
}

/**
 * Fetch dividend per share data directly from SEC EDGAR XBRL.
 * Uses CommonStockDividendsPerShareDeclared and PaymentsOfDividends.
 */
async function fetchDividendsFromEDGAR(ticker: string): Promise<DividendData | null> {
  const cik = getCIK(ticker);
  if (!cik) return null;

  try {
    const paddedCik = cik.padStart(10, '0');
    const url = `${SEC_BASE_URL}/CIK${paddedCik}.json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // SEC EDGAR returned non-OK status
      return null;
    }

    const data = await response.json();
    const usGaap = data?.facts?.['us-gaap'];
    if (!usGaap) return null;

    // Try to get dividends per share (preferred)
    const dpsField = usGaap['CommonStockDividendsPerShareDeclared']
      || usGaap['CommonStockDividendsPerShareCashPaid'];

    // Also try aggregate dividends paid
    const totalDivField = usGaap['PaymentsOfDividends']
      || usGaap['PaymentsOfDividendsCommonStock']
      || usGaap['DividendsCommonStock'];

    const reit = REITS.find(r => r.ticker === ticker);
    const sharesOutstanding = reit ? reit.sharesOutstanding * 1_000_000 : null;
    const currentPrice = getCurrentPrice(ticker);

    const quarterlyDividends: QuarterlyDividend[] = [];

    if (dpsField) {
      // Per-share data available in USD/shares unit
      const dpsUnits = dpsField.units?.['USD/shares'] || dpsField.units?.USD || [];
      const filtered = dpsUnits
        .filter((f: any) => f.form === '10-Q' || f.form === '10-K')
        .filter((f: any) => {
          const endDate = new Date(f.end);
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 3);
          return endDate >= cutoff;
        })
        .sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime());

      for (const fact of filtered) {
        quarterlyDividends.push({
          fiscalDate: fact.end,
          dpsPerShare: fact.val,
          totalDividendsPaid: null,
          period: fact.fp || 'Unknown',
          source: 'EDGAR',
        });
      }
    } else if (totalDivField && sharesOutstanding) {
      // Only aggregate data available; derive per-share
      const totalUnits = totalDivField.units?.USD || [];
      const filtered = totalUnits
        .filter((f: any) => f.form === '10-Q' || f.form === '10-K')
        .filter((f: any) => {
          const endDate = new Date(f.end);
          const cutoff = new Date();
          cutoff.setFullYear(cutoff.getFullYear() - 3);
          return endDate >= cutoff;
        })
        .sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime());

      for (const fact of filtered) {
        const dps = fact.val / sharesOutstanding;
        quarterlyDividends.push({
          fiscalDate: fact.end,
          dpsPerShare: parseFloat(dps.toFixed(4)),
          totalDividendsPaid: fact.val,
          period: fact.fp || 'Unknown',
          source: 'EDGAR',
        });
      }
    }

    if (quarterlyDividends.length === 0) {
      // no XBRL dividend facts found
      return null;
    }

    // Trailing 12-month DPS
    const last4 = quarterlyDividends.slice(0, 4);
    const trailing12mDPS = last4.reduce((sum, q) => sum + (q.dpsPerShare || 0), 0);
    const annualizedDividendYield = currentPrice > 0 ? (trailing12mDPS / currentPrice) * 100 : 0;

    const lastDate = quarterlyDividends.length > 0 ? new Date(quarterlyDividends[0].fiscalDate) : null;

    // EDGAR dividend data fetched successfully

    // Rate limit: 200ms delay
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      ticker,
      quarterlyDividends,
      trailing12mDPS,
      annualizedDividendYield,
      currentPrice,
      lastUpdated: lastDate,
      source: 'EDGAR',
      isEstimated: false,
    };
  } catch (error: any) {
    // EDGAR fetch failed
    return null;
  }
}

/**
 * Fallback: estimate dividends from institutional profile data.
 * Uses the hardcoded dividendYield from mockData INSTITUTIONAL_PROFILES.
 */
function getEstimatedDividends(ticker: string): DividendData {
  const reit = REITS.find(r => r.ticker === ticker);
  const currentPrice = reit ? reit.nominalPrice : 100;

  // Use the profile dividend yield (varies by ticker: 2.5% to 7.1%)
  // The profiles are in mockData.ts INSTITUTIONAL_PROFILES
  const ESTIMATED_YIELDS: Record<string, number> = {
    PLD: 2.9, REXR: 2.7, EQR: 3.8, AVB: 3.5, ESS: 3.2, MAA: 3.8,
    O: 5.4, SPG: 6.2, BXP: 7.1, VNO: 6.5, INVH: 3.1, AMH: 3.3,
    PSA: 4.2, EXR: 3.9, CUBE: 4.5, HST: 5.5, RHP: 4.8,
  };

  const estimatedYield = ESTIMATED_YIELDS[ticker] || 4.2;
  const annualDPS = currentPrice * (estimatedYield / 100);
  const quarterlyDPS = annualDPS / 4;

  const now = new Date();
  const quarters: QuarterlyDividend[] = [];
  for (let i = 0; i < 4; i++) {
    const qDate = new Date(now);
    qDate.setMonth(qDate.getMonth() - i * 3);
    const lastDayOfQuarter = new Date(qDate.getFullYear(), qDate.getMonth() + 1, 0);
    quarters.push({
      fiscalDate: lastDayOfQuarter.toISOString().split('T')[0],
      dpsPerShare: parseFloat(quarterlyDPS.toFixed(4)),
      totalDividendsPaid: null,
      period: `Q${Math.floor(lastDayOfQuarter.getMonth() / 3) + 1}`,
      source: 'Estimated',
    });
  }

  return {
    ticker,
    quarterlyDividends: quarters,
    trailing12mDPS: annualDPS,
    annualizedDividendYield: estimatedYield,
    currentPrice,
    lastUpdated: null,
    source: 'Estimated',
    isEstimated: true,
  };
}

/**
 * Get dividend yield for use in other services (e.g., return decomposition).
 * Returns annualized yield as a percentage (e.g., 4.2 for 4.2%).
 */
export async function getDividendYield(ticker: string): Promise<{
  yield: number;
  isEstimated: boolean;
  source: 'DB' | 'EDGAR' | 'Estimated';
  lastUpdated: Date | null;
}> {
  const data = await getDividendData(ticker);
  return {
    yield: data.annualizedDividendYield,
    isEstimated: data.isEstimated,
    source: data.source,
    lastUpdated: data.lastUpdated,
  };
}

/**
 * Batch fetch dividend yields for multiple tickers.
 */
export async function getBatchDividendYields(
  tickers: string[]
): Promise<Map<string, DividendData>> {
  const results = new Map<string, DividendData>();

  for (const ticker of tickers) {
    try {
      const data = await getDividendData(ticker);
      results.set(ticker, data);
    } catch (error: any) {
      // failed to get dividend data for ticker
    }
    // Rate limit for EDGAR calls
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Clear dividend cache.
 */
export function clearDividendCache(): void {
  dividendCache.clear();
  // cache cleared
}
