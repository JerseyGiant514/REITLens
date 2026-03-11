import { supabase } from './supabaseClient';
import { FinancialsQuarterly, MarketDaily, REITKPIs, MacroDaily } from '../types';
import { REITS, generateFinancials, generateKPIs, MACRO_DATA } from './mockData';
import {
  getInstitutionalProfile as getRegistryProfile,
  InstitutionalProfile,
  INSTITUTIONAL_PROFILES,
  DEFAULT_PROFILE,
} from './reitRegistry';
import { trackDataFallback } from './errorTracking';

/**
 * Real Data Service
 *
 * Fetches financial data from the historical_financials table (SEC EDGAR data).
 * Falls back to mock data when real data is unavailable.
 *
 * FFO Computation (Item 9 - Institutional Upgrade):
 *   Real FFO = Net Income + Depreciation & Amortization - Gains on Property Sales
 *   Real AFFO = FFO - Maintenance CapEx
 *   Falls back to approximated FFO when D&A data unavailable.
 *
 * Institutional Profiles (Item 11 - Institutional Upgrade):
 *   Profiles are fetched from the reit_profiles database table first,
 *   falling back to hardcoded values in reitRegistry.ts for resilience.
 */

// Cache for database queries to avoid repeated fetches
const dbCache: Map<string, { data: any; timestamp: number }> = new Map();
const DB_CACHE_MS = 1000 * 60 * 5; // 5 minute cache

function getCached<T>(key: string): T | null {
  const cached = dbCache.get(key);
  if (cached && Date.now() - cached.timestamp < DB_CACHE_MS) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  dbCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Get the Supabase REIT ID for a given local reitId
 */
async function getSupabaseReitId(reitId: string): Promise<string | null> {
  const reit = REITS.find(r => r.id === reitId);
  if (!reit) return null;

  const cacheKey = `reit-uuid:${reit.ticker}`;
  const cached = getCached<string>(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', reit.ticker)
      .single();

    if (data?.id) {
      setCache(cacheKey, data.id);
      return data.id;
    }
  } catch (e: any) {
    // Table might not exist yet
    trackDataFallback('realDataService', `Supabase REIT ID lookup failed for ${reit.ticker}: ${e?.message || e}`);
  }
  return null;
}

// ============================================================================
// INSTITUTIONAL PROFILE - DB-backed with hardcoded fallback (Item 11)
// ============================================================================

// Cache for DB profiles
const profileCache: Map<string, { data: InstitutionalProfile; timestamp: number }> = new Map();
const PROFILE_CACHE_MS = 1000 * 60 * 15; // 15 minute cache for profiles

/**
 * Get institutional profile for a ticker.
 * Priority: DB (reit_profiles table) > Hardcoded (reitRegistry.ts) > Default
 */
async function getInstitutionalProfileFromDB(ticker: string): Promise<InstitutionalProfile> {
  const cacheKey = `profile:${ticker}`;
  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_MS) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('reit_profiles')
      .select('*')
      .eq('ticker', ticker)
      .maybeSingle();

    if (!error && data) {
      const profile: InstitutionalProfile = {
        baselineCapRate: data.baseline_cap_rate,
        targetLTV: data.target_ltv,
        operatingMargin: data.operating_margin,
        growthAlpha: data.growth_alpha,
        acqVolumePct: data.acq_volume_pct,
        acqSpreadBps: data.acq_spread_bps,
        devPipelinePct: data.dev_pipeline_pct,
        ytcSpreadBps: data.ytc_spread_bps,
        recurringCapexIntensity: data.recurring_capex_intensity,
        straightLineRentPct: data.straight_line_rent_pct,
        gaExpensePct: data.ga_expense_pct,
        dividendYield: data.dividend_yield,
      };
      profileCache.set(cacheKey, { data: profile, timestamp: Date.now() });
      return profile;
    }
  } catch (e: any) {
    // reit_profiles table may not exist yet - fall back to hardcoded
    trackDataFallback('realDataService', `DB profile fetch failed for ${ticker}, using hardcoded: ${e?.message || e}`);
  }

  // Fallback to hardcoded profiles from registry
  const hardcoded = getRegistryProfile(ticker);
  profileCache.set(cacheKey, { data: hardcoded, timestamp: Date.now() });
  return hardcoded;
}

/**
 * Synchronous profile getter (for use in contexts where async is not possible).
 * Uses cached DB data if available, otherwise falls back to registry.
 */
function getInstitutionalProfile(ticker: string): InstitutionalProfile {
  const cacheKey = `profile:${ticker}`;
  const cached = profileCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_MS) {
    return cached.data;
  }
  return getRegistryProfile(ticker);
}

// ============================================================================
// FINANCIALS - Real data with FFO computation (Item 9)
// ============================================================================

/**
 * Fetch real quarterly financials from database
 * Falls back to mock data if unavailable
 *
 * FFO computation priority:
 *   1. DB-stored FFO (computed during EDGAR backfill from D&A + gains)
 *   2. Computed from DB fields: Net Income + D&A - Gains on Sales
 *   3. Approximated: NOI - Interest - G&A (legacy fallback)
 */
export async function getRealFinancials(reitId: string): Promise<FinancialsQuarterly[]> {
  const cacheKey = `financials:${reitId}`;
  const cached = getCached<FinancialsQuarterly[]>(cacheKey);
  if (cached) return cached;

  try {
    const supabaseId = await getSupabaseReitId(reitId);
    if (!supabaseId) return generateFinancials(reitId);

    const { data, error } = await supabase
      .from('historical_financials')
      .select('*')
      .eq('reit_id', supabaseId)
      .order('fiscal_date', { ascending: false })
      .limit(8);

    if (error || !data || data.length === 0) {
      return generateFinancials(reitId);
    }

    const reit = REITS.find(r => r.id === reitId)!;
    // Try to load from DB first, fall back to registry
    const profile = await getInstitutionalProfileFromDB(reit.ticker);

    const financials: FinancialsQuarterly[] = data.map(row => {
      const revenue = row.revenue ? Math.round(row.revenue / 1_000_000) : 0;
      const netIncome = row.net_income ? Math.round(row.net_income / 1_000_000) : 0;
      const totalAssets = row.total_assets ? Math.round(row.total_assets / 1_000_000) : 0;
      const totalDebt = row.total_debt ? Math.round(row.total_debt / 1_000_000) : 0;
      const equity = row.total_equity ? Math.round(row.total_equity / 1_000_000) : totalAssets - totalDebt;
      const capex = row.capex ? Math.round(row.capex / 1_000_000) : 0;

      // NEW: Extract real D&A, gains, and interest from DB
      const depreciationDA = row.depreciation_amortization
        ? Math.round(row.depreciation_amortization / 1_000_000)
        : 0;
      const gainLossOnSales = row.gain_loss_on_sales
        ? Math.round(row.gain_loss_on_sales / 1_000_000)
        : 0;

      // Real interest expense from XBRL (not the hardcoded 4.5% estimate)
      const interestExpense = row.interest_expense
        ? Math.round(row.interest_expense / 1_000_000)
        : (totalDebt > 0 ? Math.round(totalDebt * 0.045 / 4) : 0);

      // Calculate NOI: use actual operating income if available, else estimate
      const noi = row.operating_income
        ? Math.round(row.operating_income / 1_000_000)
        : Math.round(revenue * profile.operatingMargin);

      // ═══════════════════════════════════════════════════════════════
      // FFO COMPUTATION (Item 9 - Institutional Upgrade)
      //
      // Priority:
      //   1. DB-stored FFO (pre-computed during EDGAR backfill)
      //   2. Real formula: Net Income + D&A - Gains on Property Sales
      //   3. Legacy approximation: NOI - Interest - G&A
      // ═══════════════════════════════════════════════════════════════
      let ffo: number;
      let ffoIsReal = false;

      if (row.ffo) {
        // Priority 1: Pre-computed FFO from EDGAR backfill
        ffo = Math.round(row.ffo / 1_000_000);
        ffoIsReal = true;
      } else if (depreciationDA > 0) {
        // Priority 2: Compute from DB fields
        // Real FFO = Net Income + D&A - Gains on Sales
        ffo = netIncome + depreciationDA - gainLossOnSales;
        ffoIsReal = true;
      } else {
        // Priority 3: Legacy approximation (fallback)
        ffo = noi - interestExpense - Math.round(revenue * profile.gaExpensePct);
      }

      const gaExpense = Math.round(revenue * profile.gaExpensePct);

      // Maintenance CapEx: use actual capex if available, else estimate from NOI
      const maintenanceCapex = capex > 0
        ? Math.round(capex * 0.60) // 60% of total capex is maintenance (conservative)
        : Math.round(noi * profile.recurringCapexIntensity);

      return {
        periodEndDate: row.fiscal_date,
        reitId,
        revenue,
        netIncome,
        operatingCashFlow: row.operating_cash_flow
          ? Math.round(row.operating_cash_flow / 1_000_000)
          : Math.round(revenue * 0.45),
        totalAssets,
        totalDebt,
        equity,
        dilutedShares: reit.sharesOutstanding,
        dividendsPaid: row.dividends_per_share
          ? row.dividends_per_share
          : (reit.nominalPrice * profile.dividendYield) / 4,
        noi,
        ffo,
        straightLineRent: Math.round(revenue * profile.straightLineRentPct),
        maintenanceCapex,
        growthCapex: capex > 0
          ? Math.round(capex * 0.40) // 40% of total capex is growth
          : Math.round(noi * (profile.devPipelinePct / 4)),
        gaExpense,
        ebitdare: noi - gaExpense,
        interestExpense
      };
    }).reverse(); // Ascending order

    setCache(cacheKey, financials);
    return financials;

  } catch (e: any) {
    // failed to fetch real financials, using mock
    trackDataFallback('realDataService', `DB fetch failed for ${reitId}: ${e?.message || e}`, { reitId });
    return generateFinancials(reitId);
  }
}

/**
 * Fetch real KPIs from database
 * Falls back to mock data if unavailable
 */
export async function getRealKPIs(reitId: string): Promise<REITKPIs[]> {
  // For now, KPIs require data not available in basic SEC filings
  // (leasing spreads, WALT, occupancy)
  // Use mock KPIs but with real financial underpinnings
  try {
    const financials = await getRealFinancials(reitId);
    if (financials.length === 0) return generateKPIs(reitId);

    const reit = REITS.find(r => r.id === reitId)!;
    const profile = await getInstitutionalProfileFromDB(reit.ticker);

    return financials.slice(-5).map((fin, i) => {
      const prevFin = i > 0 ? financials[financials.length - 5 + i - 1] : fin;

      // Calculate real same-store NOI growth from actual data
      const ssNoi = prevFin && prevFin.noi > 0
        ? ((fin.noi - prevFin.noi) / prevFin.noi) * 100
        : 2.5 + profile.growthAlpha;

      const acqAccretion = (profile.acqVolumePct * profile.acqSpreadBps) / 100;
      const devAlpha = (profile.devPipelinePct * profile.ytcSpreadBps) / 100;
      const structuralLeakage = -(profile.recurringCapexIntensity * 10);
      const capImpact = 0;

      // AFFO = FFO - Maintenance CapEx (using real FFO when available)
      const affo = fin.ffo - fin.maintenanceCapex;
      const payoutAffo = affo > 0
        ? (fin.dividendsPaid / (affo / fin.dilutedShares)) * 100
        : 75;
      const interestCoverage = fin.interestExpense > 0
        ? fin.ebitdare / fin.interestExpense
        : 5;
      const gaToGav = fin.totalAssets > 0
        ? (fin.gaExpense * 4) / fin.totalAssets * 100
        : 0.5;

      return {
        periodEndDate: fin.periodEndDate,
        reitId,
        sameStoreNOIGrowth: ssNoi,
        occupancy: 94.5 + (profile.operatingMargin * 5),
        leasingSpread: 5.0 + (profile.growthAlpha * 4),
        walt: 4.5 + (profile.operatingMargin * 2),
        growthDecomp: {
          ssNoi,
          acquisitionAccretion: acqAccretion,
          devAlpha,
          structuralLeakage,
          capImpact,
          netAffoGrowth: ssNoi + acqAccretion + devAlpha + structuralLeakage + capImpact
        },
        cashNoiGrowth: ssNoi - 0.5,
        gaToGav,
        interestCoverage,
        payoutAffo
      };
    });

  } catch (e: any) {
    trackDataFallback('realDataService', `KPI computation failed for ${reitId}, using mock: ${e?.message || e}`, { reitId });
    return generateKPIs(reitId);
  }
}

/**
 * Get historical financials count for a ticker
 * Useful for checking if real data is available
 */
export async function getHistoricalDataCount(ticker: string): Promise<number> {
  try {
    const { data: reitData } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', ticker)
      .single();

    if (!reitData) return 0;

    const { count } = await supabase
      .from('historical_financials')
      .select('id', { count: 'exact', head: true })
      .eq('reit_id', reitData.id);

    return count || 0;
  } catch (e: any) {
    trackDataFallback('realDataService', `Historical data count failed for ${ticker}: ${e?.message || e}`);
    return 0;
  }
}
