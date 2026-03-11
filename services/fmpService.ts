import { supabase } from './supabaseClient';

// FMP migrated from /api/v3/ to /stable/ endpoints (Aug 2025)
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

// Get API key at runtime to ensure env vars are loaded
const getFMPApiKey = (): string => {
  const key = process.env.VITE_FMP_API_KEY || '';
  if (!key) {
    // FMP API key not set
  }
  return key;
};

interface FMPIncomeStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  eps: number;
  epsdiluted: number;
}

interface FMPBalanceSheet {
  date: string;
  symbol: string;
  period: string;
  totalAssets: number;
  totalDebt: number;
  netDebt: number;
  totalStockholdersEquity: number;
  cashAndCashEquivalents: number;
  propertyPlantEquipmentNet: number;
  [key: string]: any;
}

interface FMPCashFlow {
  date: string;
  symbol: string;
  period: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  dividendsPaid: number;
  acquisitionsNet: number;
  [key: string]: any;
}

interface FMPKeyMetrics {
  date: string;
  symbol: string;
  period: string;
  dividendYield: number;
  dividendPerShare: number;
  marketCap: number;
  enterpriseValue: number;
  peRatio: number;
  priceToSalesRatio: number;
  [key: string]: any;
}

export interface QuarterlyFundamentals {
  ticker: string;
  fiscalDate: Date;
  period: string;
  fiscalYear: number;
  calendarYear: number;
  calendarQuarter: number;
  revenue: number;
  operatingIncome: number;
  netIncome: number;
  ffo?: number;
  affo?: number;
  noi?: number;
  sameStoreNoiGrowth?: number;
  totalAssets?: number;
  totalDebt?: number;
  totalEquity?: number;
  ffoPerShare?: number;
  affoPerShare?: number;
  dividendPerShare?: number;
}

export class FMPService {
  /**
   * BATCH FETCH: Get quarterly fundamentals for multiple tickers
   *
   * Note: FMP Free Tier Limitations (as of Feb 2026):
   * - Income Statement: ✅ Available
   * - Balance Sheet: ❌ Premium only
   * - Cash Flow: ❌ Premium only
   * - Key Metrics: ❌ Premium only
   *
   * This function fetches what's available and calculates approximations for missing data
   */
  static async batchFetchQuarterlyFundamentals(
    tickers: string[],
    lookbackYears: number = 10
  ): Promise<Map<string, QuarterlyFundamentals[]>> {
    const results = new Map<string, QuarterlyFundamentals[]>();
    const limit = lookbackYears * 4; // quarters

    for (const ticker of tickers) {
      try {

        // Fetch income statement (only available endpoint in free tier)
        const response = await fetch(
          `${FMP_BASE_URL}/income-statement?symbol=${ticker}&period=quarter&limit=${limit}&apikey=${getFMPApiKey()}`
        );
        const incomeStatements = await response.json();

        // Validate response
        if (!Array.isArray(incomeStatements)) {
          // FMP returned non-array response
          continue;
        }

        if (incomeStatements.length === 0) {
          // no data returned for ticker
          continue;
        }

        // Map income statements to fundamentals (other fields will be null/approximated)
        const fundamentals = incomeStatements.map(income =>
          this.mapToQuarterlyFundamentals(income, undefined, undefined, undefined)
        );

        results.set(ticker, fundamentals);

        // Store in database
        await this.storeFundamentals(ticker, fundamentals);

        // ticker data stored

        // Rate limiting: Small delay between tickers to avoid overwhelming API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        // ticker fetch failed
      }
    }

    // batch fetch complete
    return results;
  }

  /**
   * Lazy loading: Check database first, fetch from API if missing
   */
  static async getQuarterlyFundamentals(
    ticker: string,
    lookbackYears: number = 5
  ): Promise<QuarterlyFundamentals[]> {
    // 1. Get REIT ID
    const { data: reit } = await supabase
      .from('reits')
      .select('id, cik')
      .eq('ticker', ticker)
      .single();

    if (!reit) throw new Error(`REIT ${ticker} not found`);

    // 2. Check what we have in DB
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - lookbackYears);

    const { data: existing } = await supabase
      .from('historical_financials')
      .select('*')
      .eq('reit_id', reit.id)
      .gte('fiscal_date', cutoffDate.toISOString().split('T')[0])
      .order('fiscal_date', { ascending: false });

    // 3. If data is missing or incomplete, trigger batch fetch for this ticker
    const expectedQuarters = lookbackYears * 4;
    if (!existing || existing.length < expectedQuarters * 0.8) {
      // triggering batch fetch for missing data
      await this.batchFetchQuarterlyFundamentals([ticker], lookbackYears);

      // Re-query after fetch
      const { data: refreshed } = await supabase
        .from('historical_financials')
        .select('*')
        .eq('reit_id', reit.id)
        .gte('fiscal_date', cutoffDate.toISOString().split('T')[0])
        .order('fiscal_date', { ascending: false});

      return (refreshed || []).map(row => ({
        ...this.mapDBRow(row),
        ticker
      }));
    }

    return (existing || []).map(row => ({
      ...this.mapDBRow(row),
      ticker
    }));
  }

  /**
   * Group API results by ticker symbol
   */
  private static groupByTicker<T extends { symbol: string }>(
    data: T[]
  ): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    for (const item of data) {
      const ticker = item.symbol;
      if (!grouped.has(ticker)) {
        grouped.set(ticker, []);
      }
      grouped.get(ticker)!.push(item);
    }

    return grouped;
  }

  /**
   * Store fundamentals in database
   * Updated to use 'historical_financials' table and store comprehensive data
   */
  private static async storeFundamentals(
    ticker: string,
    fundamentals: QuarterlyFundamentals[]
  ) {
    // Get REIT ID
    const { data: reit } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', ticker)
      .single();

    if (!reit) {
      // REIT not found in database, skipping storage
      return;
    }

    for (const fund of fundamentals) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('historical_financials')
        .select('id')
        .eq('reit_id', reit.id)
        .eq('fiscal_date', fund.fiscalDate.toISOString().split('T')[0])
        .maybeSingle();

      if (existing) continue;

      // Insert new record with comprehensive data
      const { error } = await supabase
        .from('historical_financials')
        .insert({
          reit_id: reit.id,
          fiscal_date: fund.fiscalDate.toISOString().split('T')[0],
          period: fund.period,
          fiscal_year: fund.fiscalYear,
          calendar_year: fund.calendarYear,
          calendar_quarter: fund.calendarQuarter,
          revenue: fund.revenue,
          operating_income: fund.operatingIncome,
          net_income: fund.netIncome,
          ffo: fund.ffo || null,
          affo: fund.affo || null,
          total_assets: fund.totalAssets || null,
          total_debt: fund.totalDebt || null,
          total_equity: fund.totalEquity || null,
          dividend_per_share: fund.dividendPerShare || null,
          data_source: 'FMP'
        });

      if (error) {
        // error storing record
      }
    }
  }

  /**
   * Map FMP API response to QuarterlyFundamentals
   * Now includes balance sheet, cash flow, and key metrics data
   */
  private static mapToQuarterlyFundamentals(
    income: FMPIncomeStatement,
    balance?: FMPBalanceSheet,
    cashFlow?: FMPCashFlow,
    metrics?: FMPKeyMetrics
  ): QuarterlyFundamentals {
    const fiscalDate = new Date(income.date);
    const calendarYear = fiscalDate.getFullYear();
    const calendarQuarter = Math.floor(fiscalDate.getMonth() / 3) + 1;

    // Calculate FFO approximation (Net Income + Depreciation - Gains on Sales)
    // Note: FMP doesn't provide FFO directly, but we can approximate
    const estimatedFFO = income.netIncome; // Basic approximation, will enhance later

    return {
      ticker: income.symbol,
      fiscalDate,
      period: income.period,
      fiscalYear: parseInt(income.calendarYear),
      calendarYear,
      calendarQuarter,
      revenue: income.revenue,
      operatingIncome: income.operatingIncome,
      netIncome: income.netIncome,
      ffo: estimatedFFO,
      affo: estimatedFFO * 0.95, // Rough approximation: FFO - maintenance capex
      totalAssets: balance?.totalAssets,
      totalDebt: balance?.totalDebt,
      totalEquity: balance?.totalStockholdersEquity,
      dividendPerShare: metrics?.dividendPerShare
    };
  }

  /**
   * Map database row to QuarterlyFundamentals interface
   */
  private static mapDBRow(row: any): Omit<QuarterlyFundamentals, 'ticker'> {
    return {
      fiscalDate: new Date(row.fiscal_date),
      period: row.period,
      fiscalYear: row.fiscal_year,
      calendarYear: row.calendar_year,
      calendarQuarter: row.calendar_quarter,
      revenue: parseFloat(row.revenue) || 0,
      operatingIncome: parseFloat(row.operating_income) || 0,
      netIncome: parseFloat(row.net_income) || 0,
      ffo: row.ffo ? parseFloat(row.ffo) : undefined,
      affo: row.affo ? parseFloat(row.affo) : undefined,
      noi: row.noi ? parseFloat(row.noi) : undefined,
      sameStoreNoiGrowth: row.same_store_noi_growth ? parseFloat(row.same_store_noi_growth) : undefined,
      totalAssets: row.total_assets ? parseFloat(row.total_assets) : undefined,
      totalDebt: row.total_debt ? parseFloat(row.total_debt) : undefined,
      totalEquity: row.total_equity ? parseFloat(row.total_equity) : undefined,
      ffoPerShare: row.ffo_per_share ? parseFloat(row.ffo_per_share) : undefined,
      affoPerShare: row.affo_per_share ? parseFloat(row.affo_per_share) : undefined,
      dividendPerShare: row.dividend_per_share ? parseFloat(row.dividend_per_share) : undefined
    };
  }

  /**
   * Get the nearest quarter end date for a lookback period
   */
  static getNearestQuarterEnd(lookbackYears: number): Date {
    const targetDate = new Date();
    targetDate.setFullYear(targetDate.getFullYear() - lookbackYears);
    return this.getQuarterEnd(targetDate);
  }

  /**
   * Get the quarter end date for a given date
   */
  private static getQuarterEnd(date: Date): Date {
    const month = date.getMonth();
    const year = date.getFullYear();

    // Quarter end months: March (2), June (5), September (8), December (11)
    if (month < 3) return new Date(year, 2, 31); // Q1: March 31
    if (month < 6) return new Date(year, 5, 30); // Q2: June 30
    if (month < 9) return new Date(year, 8, 30); // Q3: September 30
    return new Date(year, 11, 31); // Q4: December 31
  }
}
