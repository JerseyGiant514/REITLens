/**
 * Correlation & Factor Exposure Service
 * Pearson correlation matrix, OLS regression, and portfolio statistics
 * for institutional portfolio analytics
 */

import { fetchYahooEOD } from './marketDataService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrelationResult {
  tickers: string[];
  matrix: number[][];
  pairwise: PairwiseCorrelation[];
}

export interface PairwiseCorrelation {
  ticker1: string;
  ticker2: string;
  correlation: number;
}

export interface FactorExposure {
  factorName: string;
  factorTicker: string;
  beta: number;
  rSquared: number;
  alpha: number;
  tStat: number;
  residualVol: number;
}

export interface PortfolioStats {
  expectedReturn: number;
  portfolioVariance: number;
  portfolioVol: number;
  sharpeRatio: number;
  diversificationRatio: number;
  maxDrawdown: number;
}

export interface CorrelationAnalysis {
  correlationMatrix: CorrelationResult;
  factorExposures: Map<string, FactorExposure[]>;
  portfolioStats: PortfolioStats | null;
}

// ─── Factor Definitions ──────────────────────────────────────────────────────

export const FACTOR_DEFS = [
  { name: 'Market (SPY)', ticker: 'SPY', description: 'Broad equity market beta' },
  { name: 'Interest Rate (TLT)', ticker: 'TLT', description: '20+ Year Treasury bond sensitivity' },
  { name: 'Real Estate (VNQ)', ticker: 'VNQ', description: 'REIT sector benchmark' },
];

// ─── Core Math ────────────────────────────────────────────────────────────────

/**
 * Calculate daily returns from a price series
 */
export const calculateDailyReturns = (prices: number[]): number[] => {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    } else {
      returns.push(0);
    }
  }
  return returns;
};

/**
 * Calculate the mean of an array
 */
const mean = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
};

/**
 * Calculate the standard deviation
 */
const stdDev = (arr: number[]): number => {
  const m = mean(arr);
  const squaredDiffs = arr.map(v => (v - m) ** 2);
  return Math.sqrt(mean(squaredDiffs));
};

/**
 * Pearson correlation coefficient between two arrays
 */
export const pearsonCorrelation = (x: number[], y: number[]): number => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);
  const xMean = mean(xSlice);
  const yMean = mean(ySlice);

  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - xMean;
    const dy = ySlice[i] - yMean;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denominator = Math.sqrt(sumX2 * sumY2);
  if (denominator === 0) return 0;

  return sumXY / denominator;
};

/**
 * Calculate the full NxN Pearson correlation matrix
 */
export const calculateCorrelationMatrix = (
  priceData: Map<string, number[]>
): CorrelationResult => {
  const tickers = Array.from(priceData.keys());
  const n = tickers.length;

  // Calculate returns for each ticker
  const returnsMap = new Map<string, number[]>();
  tickers.forEach(ticker => {
    const prices = priceData.get(ticker)!;
    returnsMap.set(ticker, calculateDailyReturns(prices));
  });

  // Build correlation matrix
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const pairwise: PairwiseCorrelation[] = [];

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0; // Diagonal

    for (let j = i + 1; j < n; j++) {
      const returns1 = returnsMap.get(tickers[i])!;
      const returns2 = returnsMap.get(tickers[j])!;

      // Align to same length
      const minLen = Math.min(returns1.length, returns2.length);
      const r1 = returns1.slice(-minLen);
      const r2 = returns2.slice(-minLen);

      const corr = pearsonCorrelation(r1, r2);
      matrix[i][j] = corr;
      matrix[j][i] = corr;

      pairwise.push({
        ticker1: tickers[i],
        ticker2: tickers[j],
        correlation: corr,
      });
    }
  }

  return { tickers, matrix, pairwise };
};

/**
 * Simple OLS regression: Y = alpha + beta * X + epsilon
 * Returns beta, R-squared, alpha, t-statistic, and residual volatility
 */
export const calculateFactorExposure = (
  reitReturns: number[],
  factorReturns: number[],
  factorName: string,
  factorTicker: string
): FactorExposure => {
  const n = Math.min(reitReturns.length, factorReturns.length);
  if (n < 5) {
    return {
      factorName,
      factorTicker,
      beta: 0,
      rSquared: 0,
      alpha: 0,
      tStat: 0,
      residualVol: 0,
    };
  }

  const y = reitReturns.slice(-n);
  const x = factorReturns.slice(-n);

  const xMean = mean(x);
  const yMean = mean(y);

  // OLS: beta = Cov(X,Y) / Var(X)
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    sumXY += dx * dy;
    sumX2 += dx * dx;
  }

  const beta = sumX2 > 0 ? sumXY / sumX2 : 0;
  const alpha = yMean - beta * xMean;

  // Residuals and R-squared
  let ssRes = 0;
  let ssTot = 0;
  const residuals: number[] = [];

  for (let i = 0; i < n; i++) {
    const predicted = alpha + beta * x[i];
    const residual = y[i] - predicted;
    residuals.push(residual);
    ssRes += residual * residual;
    ssTot += (y[i] - yMean) ** 2;
  }

  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
  const residualVol = stdDev(residuals) * Math.sqrt(252); // Annualized

  // t-statistic for beta
  const se = sumX2 > 0 ? Math.sqrt(ssRes / ((n - 2) * sumX2)) : 0;
  const tStat = se > 0 ? beta / se : 0;

  return {
    factorName,
    factorTicker,
    beta,
    rSquared: Math.max(0, Math.min(1, rSquared)),
    alpha: alpha * 252, // Annualized alpha
    tStat,
    residualVol,
  };
};

/**
 * Calculate portfolio-level statistics given weights and correlation matrix
 */
export const calculatePortfolioStats = (
  weights: number[],
  correlationMatrix: number[][],
  individualVols: number[],
  individualReturns: number[],
  riskFreeRate: number = 0.04
): PortfolioStats => {
  const n = weights.length;

  // Portfolio expected return
  const expectedReturn = weights.reduce((sum, w, i) => sum + w * individualReturns[i], 0);

  // Portfolio variance = w' * Sigma * w
  // Sigma_ij = rho_ij * sigma_i * sigma_j
  let portfolioVariance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portfolioVariance += weights[i] * weights[j] *
        correlationMatrix[i][j] * individualVols[i] * individualVols[j];
    }
  }

  const portfolioVol = Math.sqrt(Math.max(0, portfolioVariance));

  // Sharpe ratio
  const sharpeRatio = portfolioVol > 0
    ? (expectedReturn - riskFreeRate) / portfolioVol
    : 0;

  // Diversification ratio = weighted vol / portfolio vol
  const weightedVol = weights.reduce((sum, w, i) => sum + w * individualVols[i], 0);
  const diversificationRatio = portfolioVol > 0
    ? weightedVol / portfolioVol
    : 1;

  return {
    expectedReturn,
    portfolioVariance,
    portfolioVol,
    sharpeRatio,
    diversificationRatio,
    maxDrawdown: 0, // Will be calculated from actual return series
  };
};

/**
 * Calculate maximum drawdown from a return series
 */
export const calculateMaxDrawdown = (cumulativeReturns: number[]): number => {
  let peak = -Infinity;
  let maxDD = 0;

  for (const val of cumulativeReturns) {
    if (val > peak) peak = val;
    const drawdown = (peak - val) / peak;
    if (drawdown > maxDD) maxDD = drawdown;
  }

  return maxDD;
};

// ─── High-Level Analytics ─────────────────────────────────────────────────────

/**
 * Fetch price data for multiple tickers and compute correlation analysis
 */
export const runCorrelationAnalysis = async (
  tickers: string[],
  weights: number[],
  days: number = 365
): Promise<CorrelationAnalysis> => {
  // Fetch price data for all tickers + factors
  const allTickers = [...tickers, ...FACTOR_DEFS.map(f => f.ticker)];
  const priceDataPromises = allTickers.map(async (ticker) => {
    const eod = await fetchYahooEOD(ticker, days);
    return { ticker, prices: eod.map(p => p.adjClose) };
  });

  const results = await Promise.all(priceDataPromises);

  // Build price data map (only for holdings, not factors)
  const holdingPriceData = new Map<string, number[]>();
  const allPriceData = new Map<string, number[]>();

  results.forEach(({ ticker, prices }) => {
    if (prices.length > 0) {
      allPriceData.set(ticker, prices);
      if (tickers.includes(ticker)) {
        holdingPriceData.set(ticker, prices);
      }
    }
  });

  // 1. Correlation Matrix (holdings only)
  const correlationMatrix = calculateCorrelationMatrix(holdingPriceData);

  // 2. Factor Exposures for each holding
  const factorExposures = new Map<string, FactorExposure[]>();

  for (const ticker of tickers) {
    const holdingPrices = allPriceData.get(ticker);
    if (!holdingPrices || holdingPrices.length < 5) continue;

    const holdingReturns = calculateDailyReturns(holdingPrices);
    const exposures: FactorExposure[] = [];

    for (const factor of FACTOR_DEFS) {
      const factorPrices = allPriceData.get(factor.ticker);
      if (!factorPrices || factorPrices.length < 5) continue;

      const factorReturns = calculateDailyReturns(factorPrices);
      const exposure = calculateFactorExposure(
        holdingReturns,
        factorReturns,
        factor.name,
        factor.ticker
      );
      exposures.push(exposure);
    }

    factorExposures.set(ticker, exposures);
  }

  // 3. Portfolio Statistics
  let portfolioStats: PortfolioStats | null = null;

  if (correlationMatrix.tickers.length >= 2 && weights.length === correlationMatrix.tickers.length) {
    const individualVols: number[] = [];
    const individualReturns: number[] = [];

    for (const ticker of correlationMatrix.tickers) {
      const prices = holdingPriceData.get(ticker);
      if (prices && prices.length > 1) {
        const returns = calculateDailyReturns(prices);
        individualVols.push(stdDev(returns) * Math.sqrt(252)); // Annualized
        individualReturns.push(mean(returns) * 252); // Annualized
      } else {
        individualVols.push(0);
        individualReturns.push(0);
      }
    }

    portfolioStats = calculatePortfolioStats(
      weights,
      correlationMatrix.matrix,
      individualVols,
      individualReturns
    );

    // Calculate max drawdown from portfolio returns
    if (holdingPriceData.size > 0) {
      // Build portfolio cumulative returns
      const firstTicker = correlationMatrix.tickers[0];
      const nDays = (holdingPriceData.get(firstTicker)?.length || 1) - 1;
      const portfolioReturns: number[] = [];

      for (let d = 0; d < nDays; d++) {
        let dayReturn = 0;
        correlationMatrix.tickers.forEach((ticker, i) => {
          const prices = holdingPriceData.get(ticker);
          if (prices && d + 1 < prices.length && prices[d] > 0) {
            dayReturn += weights[i] * ((prices[d + 1] - prices[d]) / prices[d]);
          }
        });
        portfolioReturns.push(dayReturn);
      }

      // Build cumulative series
      let cumReturn = 1;
      const cumSeries = portfolioReturns.map(r => {
        cumReturn *= (1 + r);
        return cumReturn;
      });

      portfolioStats.maxDrawdown = calculateMaxDrawdown(cumSeries);
    }
  }

  return {
    correlationMatrix,
    factorExposures,
    portfolioStats,
  };
};

/**
 * Get color for correlation value
 * -1 (red) -> 0 (neutral) -> +1 (blue/green)
 */
export const getCorrelationColor = (value: number): string => {
  if (value >= 0.8) return 'rgba(56, 189, 248, 0.8)';    // Strong positive - lightBlue
  if (value >= 0.5) return 'rgba(56, 189, 248, 0.5)';    // Moderate positive
  if (value >= 0.2) return 'rgba(56, 189, 248, 0.25)';   // Weak positive
  if (value >= -0.2) return 'rgba(148, 163, 184, 0.15)'; // Near zero - neutral
  if (value >= -0.5) return 'rgba(244, 63, 94, 0.25)';   // Weak negative
  if (value >= -0.8) return 'rgba(244, 63, 94, 0.5)';    // Moderate negative
  return 'rgba(244, 63, 94, 0.8)';                        // Strong negative - rose
};

/**
 * Get text color for correlation value (for readability)
 */
export const getCorrelationTextColor = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 0.7) return '#ffffff';
  if (abs >= 0.3) return '#e2e8f0';
  return '#94a3b8';
};
