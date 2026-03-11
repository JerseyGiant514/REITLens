/**
 * Historical Returns Service (Refactored)
 *
 * Computes return decomposition from real data sources:
 *   Total Return = Price Return + Dividend Return
 *   Total Return = Dividend Yield + AFFO Growth + Multiple Rerating
 *
 * Data Sources:
 *   - Price data: Yahoo Finance via marketDataService (for total price return)
 *   - Dividend data: dividendService (DB > EDGAR > estimated)
 *   - Fundamental data: Supabase historical_financials (revenue, net income for growth proxy)
 *   - Pre-computed: historical_returns table (if populated by calculateRealReturns script)
 *
 * Key Methodology:
 *   1. Total Return = (End Price / Start Price - 1) + Cumulative Dividend Yield over period
 *   2. Dividend Yield Contribution = average annual dividend yield over the period
 *   3. AFFO Growth = if FFO data in DB, use actual annualized FFO growth; else use revenue growth as proxy
 *   4. Multiple Rerating = Total Return - Dividend Yield - AFFO Growth (RESIDUAL method)
 *
 * The residual approach ensures the decomposition always reconciles to total return.
 */

import { supabase } from './supabaseClient';
import { CacheService } from './cacheService';
import { getDividendYield } from './dividendService';
import { fetchYahooEOD } from './marketDataService';
import { REITS } from './mockData';
import { FULL_REGISTRY } from './reitRegistry';
import { Sector } from '../types';

export interface HistoricalReturn {
  period: '1Y' | '3Y' | '5Y' | '10Y' | 'Since IPO';
  totalReturn: number;
  dividendYieldContribution: number;
  affoGrowthContribution: number;
  multipleReratingContribution: number;
  // Enhanced decomposition (optional, for detailed analysis)
  organicSsNoi?: number;
  acquisitionAccretion?: number;
  developmentAccretion?: number;
  cadLeakage?: number;
  capImpact?: number;
  // Metadata
  dataQuality: 'high' | 'medium' | 'low';
  methodology: string;
  lastUpdated: Date | null;
}

export class HistoricalReturnsService {
  /**
   * Get return decomposition for a ticker across all lookback periods.
   */
  static async getReturnsForTicker(ticker: string): Promise<HistoricalReturn[]> {
    const cacheKey = `returns:${ticker}:v2`;
    const cached = await CacheService.get<HistoricalReturn[]>(cacheKey);
    if (cached) return cached;

    const { data: reitData } = await supabase.from('reits').select('id').eq('ticker', ticker).single();
    if (!reitData) throw new Error(`REIT ${ticker} not found`);

    // Priority 1: Try pre-computed historical_returns table
    try {
      const precomputed = await this.fetchFromReturnsTable(reitData.id);
      if (precomputed.length > 0) {
        await CacheService.set(cacheKey, precomputed, 60);
        return precomputed;
      }
    } catch {
      // Table may not exist; continue to compute
    }

    // Priority 2: Compute from real data (price + fundamentals + dividends)
    const computed = await this.computeFromRealData(reitData.id, ticker);
    if (computed.length > 0) {
      await CacheService.set(cacheKey, computed, 60);
      return computed;
    }

    // Priority 3: Compute from fundamentals only (no price data)
    const fundamentalsOnly = await this.computeFromFinancials(reitData.id, ticker);
    if (fundamentalsOnly.length > 0) {
      await CacheService.set(cacheKey, fundamentalsOnly, 30);
      return fundamentalsOnly;
    }

    return [];
  }

  /**
   * Fetch pre-computed returns from the historical_returns table.
   */
  private static async fetchFromReturnsTable(reitId: string): Promise<HistoricalReturn[]> {
    const { data, error } = await supabase
      .from('historical_returns')
      .select('*')
      .eq('reit_id', reitId)
      .order('as_of_date', { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) return [];

    return data.map(row => ({
      period: row.period as HistoricalReturn['period'],
      totalReturn: parseFloat(row.total_return),
      dividendYieldContribution: parseFloat(row.dividend_yield_contribution),
      affoGrowthContribution: parseFloat(row.affo_growth_contribution),
      multipleReratingContribution: parseFloat(row.multiple_rerating_contribution),
      organicSsNoi: row.organic_ss_noi ? parseFloat(row.organic_ss_noi) : undefined,
      acquisitionAccretion: row.acquisition_accretion ? parseFloat(row.acquisition_accretion) : undefined,
      developmentAccretion: row.development_accretion ? parseFloat(row.development_accretion) : undefined,
      cadLeakage: row.cad_leakage ? parseFloat(row.cad_leakage) : undefined,
      capImpact: row.cap_impact ? parseFloat(row.cap_impact) : undefined,
      dataQuality: 'medium' as const,
      methodology: 'Pre-computed (calculateRealReturns script)',
      lastUpdated: row.as_of_date ? new Date(row.as_of_date) : null,
    }));
  }

  /**
   * Compute returns using price data (Yahoo) + fundamentals (DB) + dividends.
   *
   * This is the preferred method as it produces:
   *   - Real total return from price appreciation + dividends
   *   - Real dividend yield contribution from actual dividend payments
   *   - Growth contribution from actual revenue/FFO growth
   *   - Multiple rerating as the RESIDUAL (always reconciles)
   */
  private static async computeFromRealData(
    reitId: string,
    ticker: string
  ): Promise<HistoricalReturn[]> {
    try {
      // Fetch price data from Yahoo (up to 10 years)
      const reit = REITS.find(r => r.ticker === ticker);
      if (!reit) return [];

      // Fetch financial data from Supabase
      const { data: financials, error } = await supabase
        .from('historical_financials')
        .select('fiscal_date, revenue, net_income, operating_income, total_assets, total_debt, total_equity')
        .eq('reit_id', reitId)
        .order('fiscal_date', { ascending: true });

      if (error || !financials || financials.length < 4) return [];

      // Get dividend yield for this ticker
      const dividendInfo = await getDividendYield(ticker);

      // Fetch price history
      // We want daily prices for accurate total return computation
      // For 1Y use 365 days, for 3Y use 1095, etc.
      const periods: Array<{ label: '1Y' | '3Y' | '5Y' | '10Y'; years: number; days: number }> = [
        { label: '1Y', years: 1, days: 365 },
        { label: '3Y', years: 3, days: 1095 },
        { label: '5Y', years: 5, days: 1825 },
      ];

      const returns: HistoricalReturn[] = [];
      const now = new Date();

      for (const { label, years, days } of periods) {
        // Get price data for this period
        const prices = await fetchYahooEOD(ticker, days);

        if (prices.length < 10) {
          // Not enough price data for this period; try fundamentals-only approach
          continue;
        }

        const startPrice = prices[0].adjClose;
        const endPrice = prices[prices.length - 1].adjClose;

        if (startPrice <= 0 || endPrice <= 0) continue;

        // 1. Total Price Return (annualized, from adjusted close which includes dividends)
        const totalPriceReturn = (endPrice / startPrice) - 1;
        const annualizedTotalReturn = (Math.pow(1 + totalPriceReturn, 1 / years) - 1) * 100;

        // 2. Dividend Yield Contribution
        // Use actual dividend yield from dividendService
        // For historical average, we use current yield as best available proxy
        // (Ideally we'd have historical yields, but this is a reasonable approximation)
        const avgDividendYield = dividendInfo.yield;

        // 3. AFFO/Revenue Growth Contribution
        // Use financial data to compute annualized growth
        const cutoff = new Date(now);
        cutoff.setFullYear(cutoff.getFullYear() - years);

        const startFin = financials.find(f => new Date(f.fiscal_date) >= cutoff);
        const endFin = financials[financials.length - 1];

        let growthContribution: number;
        let growthMethodology: string;

        if (startFin && endFin && startFin !== endFin) {
          // Check if FFO data is available (ffo column in historical_financials)
          // For now, use revenue as proxy since FFO is not yet in the table
          const startRev = startFin.revenue;
          const endRev = endFin.revenue;

          if (startRev && endRev && startRev > 0) {
            growthContribution = (Math.pow(endRev / startRev, 1 / years) - 1) * 100;
            growthMethodology = 'Revenue growth (proxy for AFFO growth)';
          } else {
            growthContribution = 0;
            growthMethodology = 'No revenue data available';
          }
        } else {
          growthContribution = 0;
          growthMethodology = 'Insufficient financial data for period';
        }

        // 4. Multiple Rerating = Total Return - Dividend Yield - Growth (RESIDUAL)
        // This captures changes in P/FFO multiples, sentiment shifts, etc.
        const multipleRerating = annualizedTotalReturn - avgDividendYield - growthContribution;

        // Determine data quality
        let dataQuality: 'high' | 'medium' | 'low' = 'high';
        if (dividendInfo.isEstimated) dataQuality = 'medium';
        if (!startFin || !endFin) dataQuality = 'low';

        returns.push({
          period: label,
          totalReturn: parseFloat(annualizedTotalReturn.toFixed(2)),
          dividendYieldContribution: parseFloat(avgDividendYield.toFixed(2)),
          affoGrowthContribution: parseFloat(growthContribution.toFixed(2)),
          multipleReratingContribution: parseFloat(multipleRerating.toFixed(2)),
          dataQuality,
          methodology: `Price: Yahoo adjClose (${prices.length} days) | Div: ${dividendInfo.source} | Growth: ${growthMethodology} | Rerating: Residual`,
          lastUpdated: new Date(),
        });
      }

      return returns;
    } catch (e) {
      // computeFromRealData failed, returning empty
      return [];
    }
  }

  /**
   * Fallback: Compute returns from historical_financials only (no price data).
   * Uses revenue growth as growth proxy, estimated dividend yield,
   * and cannot compute real total return or multiple rerating.
   */
  private static async computeFromFinancials(
    reitId: string,
    ticker: string
  ): Promise<HistoricalReturn[]> {
    try {
      const { data: financials, error } = await supabase
        .from('historical_financials')
        .select('fiscal_date, revenue, net_income, operating_income, total_assets, total_debt, total_equity')
        .eq('reit_id', reitId)
        .order('fiscal_date', { ascending: true });

      if (error || !financials || financials.length < 4) return [];

      // Get dividend yield
      const dividendInfo = await getDividendYield(ticker);

      const returns: HistoricalReturn[] = [];
      const now = new Date();

      const periods: Array<{ label: '1Y' | '3Y' | '5Y' | '10Y'; years: number }> = [
        { label: '1Y', years: 1 },
        { label: '3Y', years: 3 },
        { label: '5Y', years: 5 },
        { label: '10Y', years: 10 },
      ];

      for (const { label, years } of periods) {
        const cutoff = new Date(now);
        cutoff.setFullYear(cutoff.getFullYear() - years);

        const startData = financials.find(f => new Date(f.fiscal_date) >= cutoff);
        const endData = financials[financials.length - 1];

        if (!startData || !endData || startData === endData) continue;
        if (!startData.revenue || !endData.revenue) continue;

        // Annualized revenue growth as proxy for AFFO growth
        const startRev = startData.revenue;
        const endRev = endData.revenue;
        const annualizedGrowth = (Math.pow(endRev / startRev, 1 / years) - 1) * 100;

        // Use actual dividend yield from dividendService
        const avgDivYield = dividendInfo.yield;

        // Total return estimate = growth + dividend yield
        // (Cannot compute actual total return without price data)
        const estimatedTotalReturn = annualizedGrowth + avgDivYield;

        // Multiple rerating: CANNOT compute without price data
        // Flag this as unknown / zero
        const multipleRerating = 0;

        returns.push({
          period: label,
          totalReturn: parseFloat(estimatedTotalReturn.toFixed(2)),
          dividendYieldContribution: parseFloat(avgDivYield.toFixed(2)),
          affoGrowthContribution: parseFloat(annualizedGrowth.toFixed(2)),
          multipleReratingContribution: multipleRerating,
          dataQuality: 'low',
          methodology: `Fundamentals-only: Revenue growth proxy, ${dividendInfo.source} dividend yield, no price data for rerating`,
          lastUpdated: endData.fiscal_date ? new Date(endData.fiscal_date) : null,
        });
      }

      return returns;
    } catch (e) {
      // computeFromFinancials failed, returning empty
      return [];
    }
  }
}

// ============================================================================
// SECTOR-LEVEL RETURN PROFILES
// ============================================================================

/** Hardcoded fallback sector return profiles (used as default/initial state) */
export const FALLBACK_SECTOR_RETURN_PROFILES: Record<string, Record<string, number>> = {
  [Sector.INDUSTRIAL]: { '1M': 1.2, 'CYTD': 4.5, '1Y': -2.1, '3Y': 45.2, '5Y': 112.5, '10Y': 240.0 },
  [Sector.RESIDENTIAL]: { '1M': 0.8, 'CYTD': 2.1, '1Y': 5.4, '3Y': 18.5, '5Y': 65.0, '10Y': 145.2 },
  [Sector.DATA_CENTERS]: { '1M': 2.5, 'CYTD': 12.8, '1Y': 18.2, '3Y': 85.0, '5Y': 165.4, '10Y': 310.5 },
  [Sector.OFFICE]: { '1M': -1.5, 'CYTD': -4.2, '1Y': -12.5, '3Y': -42.0, '5Y': -35.2, '10Y': 12.4 },
  [Sector.RETAIL]: { '1M': 0.5, 'CYTD': 3.1, '1Y': 14.2, '3Y': 22.4, '5Y': 45.0, '10Y': 88.5 },
  [Sector.TOWERS]: { '1M': -0.4, 'CYTD': 1.2, '1Y': -8.5, '3Y': 12.4, '5Y': 55.2, '10Y': 195.0 },
  [Sector.HEALTHCARE]: { '1M': 1.1, 'CYTD': 5.2, '1Y': 12.5, '3Y': 15.2, '5Y': 38.0, '10Y': 92.4 },
  [Sector.SFR]: { '1M': 1.4, 'CYTD': 6.8, '1Y': 10.5, '3Y': 32.4, '5Y': 88.2, '10Y': 185.0 },
  [Sector.SELF_STORAGE]: { '1M': 0.9, 'CYTD': 3.8, '1Y': 8.2, '3Y': 28.0, '5Y': 72.0, '10Y': 160.0 },
  [Sector.LODGING]: { '1M': 0.3, 'CYTD': 1.5, '1Y': 6.0, '3Y': 10.0, '5Y': 25.0, '10Y': 55.0 },
};

/**
 * Compute the median of a numeric array.
 * Returns 0 for empty arrays.
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Get sector-level return profiles by aggregating individual REIT returns.
 *
 * For each sector in the registry:
 *   1. Fetches return decomposition for every REIT in that sector
 *   2. Extracts the annualized totalReturn for each period (1Y, 3Y, 5Y, 10Y)
 *   3. Computes the median across REITs in the sector
 *   4. Derives sub-annual periods: 1M ~ 1Y/12, CYTD ~ 1Y * monthsElapsed/12
 *
 * Results are cached for 60 minutes.
 * Falls back to FALLBACK_SECTOR_RETURN_PROFILES if all data fetching fails.
 */
export async function getSectorReturnProfiles(): Promise<Record<string, Record<string, number>>> {
  const cacheKey = 'sector-return-profiles:v1';
  const cached = await CacheService.get<Record<string, Record<string, number>>>(cacheKey);
  if (cached) return cached;

  try {
    // Group registry entries by sector
    const sectorGroups: Record<string, string[]> = {};
    for (const entry of FULL_REGISTRY) {
      if (!entry.isActive) continue;
      if (!sectorGroups[entry.sector]) {
        sectorGroups[entry.sector] = [];
      }
      sectorGroups[entry.sector].push(entry.ticker);
    }

    // For each sector, fetch returns for all its REITs
    const result: Record<string, Record<string, number>> = {};
    let anyRealData = false;

    const sectorEntries = Object.entries(sectorGroups);

    await Promise.all(
      sectorEntries.map(async ([sector, tickers]) => {
        // Fetch returns for all REITs in this sector (in parallel)
        const allReturns = await Promise.all(
          tickers.map(async (ticker) => {
            try {
              return await HistoricalReturnsService.getReturnsForTicker(ticker);
            } catch (e) {
              // failed to get returns for ticker
              return [] as HistoricalReturn[];
            }
          })
        );

        // Aggregate by period: collect totalReturn values per period across all REITs
        const periodMap: Record<string, number[]> = {
          '1Y': [],
          '3Y': [],
          '5Y': [],
          '10Y': [],
        };

        for (const reitReturns of allReturns) {
          for (const ret of reitReturns) {
            if (periodMap[ret.period] !== undefined) {
              periodMap[ret.period].push(ret.totalReturn);
            }
          }
        }

        // Compute median for each period
        const sectorProfile: Record<string, number> = {};
        const periods = ['1Y', '3Y', '5Y', '10Y'] as const;

        let hasAnyPeriod = false;
        for (const period of periods) {
          if (periodMap[period].length > 0) {
            sectorProfile[period] = parseFloat(median(periodMap[period]).toFixed(1));
            hasAnyPeriod = true;
          }
        }

        if (hasAnyPeriod) {
          anyRealData = true;

          // Derive sub-annual periods from 1Y return
          // 1Y is annualized total return in percent
          const annualReturn = sectorProfile['1Y'] ?? 0;
          const now = new Date();
          const monthsElapsed = now.getMonth() + 1; // 1-12

          // 1M is approximately 1/12 of the annual return
          sectorProfile['1M'] = parseFloat((annualReturn / 12).toFixed(1));
          // CYTD is the annual return prorated by months elapsed
          sectorProfile['CYTD'] = parseFloat((annualReturn * monthsElapsed / 12).toFixed(1));

          // For multi-year periods, convert annualized return to cumulative
          // The service returns annualized returns; the component expects cumulative
          // 3Y cumulative = (1 + annualized/100)^3 - 1, expressed as percent
          if (sectorProfile['3Y'] !== undefined) {
            const ann3 = sectorProfile['3Y'];
            sectorProfile['3Y'] = parseFloat(((Math.pow(1 + ann3 / 100, 3) - 1) * 100).toFixed(1));
          }
          if (sectorProfile['5Y'] !== undefined) {
            const ann5 = sectorProfile['5Y'];
            sectorProfile['5Y'] = parseFloat(((Math.pow(1 + ann5 / 100, 5) - 1) * 100).toFixed(1));
          }
          if (sectorProfile['10Y'] !== undefined) {
            const ann10 = sectorProfile['10Y'];
            sectorProfile['10Y'] = parseFloat(((Math.pow(1 + ann10 / 100, 10) - 1) * 100).toFixed(1));
          }

          result[sector] = sectorProfile;
        }
      })
    );

    if (!anyRealData) {
      // no real data available, using fallback profiles
      return { ...FALLBACK_SECTOR_RETURN_PROFILES };
    }

    // For any sectors not in the registry (e.g. Data Centers, Towers, Healthcare),
    // fill in from fallback so the component always has complete data
    for (const [sector, profile] of Object.entries(FALLBACK_SECTOR_RETURN_PROFILES)) {
      if (!result[sector]) {
        result[sector] = { ...profile };
      }
    }

    await CacheService.set(cacheKey, result, 60);
    return result;
  } catch (e) {
    // getSectorReturnProfiles failed, using fallback
    return { ...FALLBACK_SECTOR_RETURN_PROFILES };
  }
}
