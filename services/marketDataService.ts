/**
 * Market Data Service
 * Fetches real EOD price data from Yahoo Finance and calculates weighted portfolio returns
 */

import { MarketDaily } from '../types';
import { getAllTickers, updateNominalPrice } from './reitRegistry';

// Cache structure: ticker -> array of price data
const priceCache: Map<string, CachedPriceData> = new Map();
const CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour cache for EOD data

interface CachedPriceData {
  data: EODPrice[];
  timestamp: number;
}

interface EODPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number;
}

interface YahooQuoteResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          high: number[];
          low: number[];
          close: number[];
          volume: number[];
        }>;
        adjclose: Array<{
          adjclose: number[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

/**
 * Returns the correct Yahoo Finance API URL based on the environment.
 * - Development (Vite): Uses Vite dev-server proxy at /yahoo-api/...
 * - Electron (desktop): Calls Yahoo Finance directly (no CORS restrictions)
 * - Web production: Uses the Supabase Edge Function at market-data?ticker=...&days=...
 */
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;

const getMarketDataUrl = (ticker: string, days: number): string => {
  const isDev = import.meta.env.DEV; // Vite sets this to true during dev

  if (isDev) {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - days * 24 * 60 * 60;
    return `/yahoo-api/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  }

  // Electron desktop: call Yahoo Finance directly (no CORS in Electron)
  if (isElectron) {
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - days * 24 * 60 * 60;
    return `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startDate}&period2=${endDate}&interval=1d`;
  }

  // Web production: call the Supabase Edge Function
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/market-data?ticker=${encodeURIComponent(ticker)}&days=${days}`;
};

/**
 * Fetches EOD price data from Yahoo Finance
 * Uses Yahoo Finance v8 query API (no API key required)
 * In production, routes through a Supabase Edge Function proxy.
 */
export const fetchYahooEOD = async (
  ticker: string,
  days: number = 90
): Promise<EODPrice[]> => {
  // Check cache first — key includes days so different timeframes get separate entries
  const cacheKey = `${ticker}_${days}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    // cache hit
    return cached.data;
  }

  try {
    const url = getMarketDataUrl(ticker, days);

    const headers: Record<string, string> = {};
    // In web production (not Electron), add the Supabase anon key for Edge Function auth
    if (!import.meta.env.DEV && !isElectron) {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (anonKey) {
        headers['Authorization'] = `Bearer ${anonKey}`;
        headers['apikey'] = anonKey;
      }
    }
    // Yahoo Finance requires a User-Agent header when called directly
    if (isElectron) {
      headers['User-Agent'] = 'Mozilla/5.0';
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data: YahooQuoteResponse = await response.json();

    if (data.chart.error) {
      throw new Error(`Yahoo API Error: ${data.chart.error.description}`);
    }

    const result = data.chart.result[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      throw new Error(`No data returned for ${ticker}`);
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const adjClose = result.indicators.adjclose?.[0]?.adjclose || quotes.close;

    const eodPrices: EODPrice[] = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0,
      volume: quotes.volume[i] || 0,
      adjClose: adjClose[i] || quotes.close[i] || 0,
    }));

    // Cache the results
    priceCache.set(cacheKey, {
      data: eodPrices,
      timestamp: Date.now(),
    });

    // market data fetched
    return eodPrices;
  } catch (error) {
    // failed to fetch market data
    // Return empty array on error - caller should handle fallback
    return [];
  }
};

/**
 * Converts EOD price data to MarketDaily format
 */
export const convertToMarketDaily = (
  reitId: string,
  ticker: string,
  eodPrices: EODPrice[],
  sharesOutstanding: number // in millions
): MarketDaily[] => {
  return eodPrices.map((price) => {
    const marketCap = price.adjClose * sharesOutstanding;
    // Estimate dividend yield (will be replaced with real data later)
    const dividendYield = 4.2; // Default REIT average

    return {
      date: price.date,
      reitId,
      closePrice: price.adjClose,
      marketCap,
      dividendYield,
    };
  });
};

/**
 * Calculates weighted portfolio performance from individual REIT returns
 * Returns an indexed performance series starting at 100
 */
export interface PortfolioConstituent {
  ticker: string;
  reitId: string;
  weight: number; // 0.0 to 1.0
  sharesOutstanding: number; // in millions
}

export interface AggregatedPerformance {
  date: string;
  indexValue: number; // Starts at 100 (total return, adjClose-based)
  priceIndex: number; // Starts at 100 (price-only, close-based)
  dailyReturn: number; // Percentage
  cumulativeReturn: number; // Percentage since inception (total return)
  priceCumulativeReturn: number; // Percentage since inception (price only)
}

export const calculatePortfolioPerformance = async (
  constituents: PortfolioConstituent[],
  days: number = 90
): Promise<AggregatedPerformance[]> => {
  // calculating portfolio performance

  // Fetch all price data in parallel
  const priceDataPromises = constituents.map((c) =>
    fetchYahooEOD(c.ticker, days).then((prices) => ({
      ...c,
      prices,
    }))
  );

  const constituentData = await Promise.all(priceDataPromises);

  // Filter out any that failed to fetch
  const validConstituents = constituentData.filter((c) => c.prices.length > 0);

  if (validConstituents.length === 0) {
    // no valid price data available
    return [];
  }

  // Find common dates across all constituents
  const allDates = new Set<string>();
  validConstituents.forEach((c) => {
    c.prices.forEach((p) => allDates.add(p.date));
  });

  const commonDates = Array.from(allDates)
    .filter((date) => {
      // Only include dates where ALL constituents have data
      return validConstituents.every((c) => c.prices.some((p) => p.date === date));
    })
    .sort();

  // common dates identified

  // Build lookup maps for O(1) access instead of O(n) find() calls
  const priceMaps = validConstituents.map((c) => {
    const map = new Map<string, EODPrice>();
    c.prices.forEach((p) => map.set(p.date, p));
    return { ...c, priceMap: map };
  });

  // Calculate daily returns for each constituent (both total return and price-only)
  const performanceData: AggregatedPerformance[] = [];
  let totalReturnValue = 100; // adjClose-based (includes dividends)
  let priceValue = 100; // close-based (price appreciation only)

  commonDates.forEach((date, idx) => {
    if (idx === 0) {
      performanceData.push({
        date,
        indexValue: 100,
        priceIndex: 100,
        dailyReturn: 0,
        cumulativeReturn: 0,
        priceCumulativeReturn: 0,
      });
      return;
    }

    const prevDate = commonDates[idx - 1];

    let weightedTotalReturn = 0;
    let weightedPriceReturn = 0;

    priceMaps.forEach((constituent) => {
      const todayData = constituent.priceMap.get(date);
      const yesterdayData = constituent.priceMap.get(prevDate);

      if (todayData && yesterdayData) {
        // Total return (adjClose includes dividend reinvestment)
        if (yesterdayData.adjClose > 0) {
          const totalReturn = (todayData.adjClose - yesterdayData.adjClose) / yesterdayData.adjClose;
          weightedTotalReturn += totalReturn * constituent.weight;
        }
        // Price-only return (raw close)
        if (yesterdayData.close > 0) {
          const priceReturn = (todayData.close - yesterdayData.close) / yesterdayData.close;
          weightedPriceReturn += priceReturn * constituent.weight;
        }
      }
    });

    totalReturnValue *= 1 + weightedTotalReturn;
    priceValue *= 1 + weightedPriceReturn;

    performanceData.push({
      date,
      indexValue: totalReturnValue,
      priceIndex: priceValue,
      dailyReturn: weightedTotalReturn * 100,
      cumulativeReturn: ((totalReturnValue - 100) / 100) * 100,
      priceCumulativeReturn: ((priceValue - 100) / 100) * 100,
    });
  });

  return performanceData;
};

/**
 * Fetches market data for a single REIT
 */
export const fetchREITMarketData = async (
  reitId: string,
  ticker: string,
  sharesOutstanding: number,
  days: number = 90
): Promise<MarketDaily[]> => {
  const eodPrices = await fetchYahooEOD(ticker, days);
  if (eodPrices.length === 0) {
    // no data available, using fallback
    return [];
  }

  return convertToMarketDaily(reitId, ticker, eodPrices, sharesOutstanding);
};

/**
 * Clears the price cache (useful for manual refresh)
 */
export const clearPriceCache = (): void => {
  priceCache.clear();
  // cache cleared
};

/**
 * Gets cache statistics
 */
export const getCacheStats = (): { size: number; tickers: string[] } => {
  return {
    size: priceCache.size,
    tickers: Array.from(priceCache.keys()),
  };
};

/**
 * Refresh registry nominal prices from live Yahoo Finance data.
 * Fetches the most recent closing price for each ticker and updates
 * the REIT registry so that fallback/mock data uses current prices.
 *
 * Call once at app startup. Failures are silent per-ticker —
 * the hardcoded nominal price remains as fallback.
 */
export const refreshRegistryPrices = async (): Promise<void> => {
  const tickers = getAllTickers();

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const prices = await fetchYahooEOD(ticker, 5); // last 5 days is enough
      if (prices.length > 0) {
        const latest = prices[prices.length - 1];
        if (latest.close > 0) {
          updateNominalPrice(ticker, Math.round(latest.close * 100) / 100);
        }
      }
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  if (succeeded > 0) {
    console.log(`[MarketData] Updated ${succeeded}/${tickers.length} registry prices from Yahoo Finance`);
  }
};
