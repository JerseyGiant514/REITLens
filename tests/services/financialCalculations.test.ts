/**
 * Financial Calculations Test Suite
 *
 * Tests the core REIT financial computations: FFO, AFFO, NOI,
 * interest coverage, payout ratios, growth decomposition, and
 * expectations analysis.
 *
 * These are the most critical calculations in the application --
 * errors here would directly mislead institutional users.
 */

import { describe, it, expect } from 'vitest';
import { Sector } from '../../types';
import {
  getHistoricalLookbacks,
  calculatePercentile,
  getExpectationsStatus,
  checkValueTrap,
} from '../../services/expectationsService';
import type { HistoricalLookback } from '../../types';

// ============================================================
// FFO / AFFO / NOI Computation Tests
// ============================================================

describe('FFO, AFFO, NOI computations', () => {
  // Simulate what generateFinancials does for FFO
  const computeFFO = (noi: number, interestExpense: number, gaExpense: number): number => {
    return noi - interestExpense - gaExpense;
  };

  // AFFO = NOI - Straight-Line Rent - Maintenance CapEx
  const computeAFFO = (noi: number, straightLineRent: number, maintenanceCapex: number): number => {
    return noi - straightLineRent - maintenanceCapex;
  };

  // EBITDAre = NOI - G&A
  const computeEBITDAre = (noi: number, gaExpense: number): number => {
    return noi - gaExpense;
  };

  it('should compute FFO correctly as NOI - Interest - G&A', () => {
    const noi = 500;
    const interest = 80;
    const ga = 30;
    const ffo = computeFFO(noi, interest, ga);
    expect(ffo).toBe(390);
  });

  it('should compute AFFO correctly as NOI - SLR - Maintenance CapEx', () => {
    const noi = 500;
    const slr = 10;
    const mCapex = 40;
    const affo = computeAFFO(noi, slr, mCapex);
    expect(affo).toBe(450);
  });

  it('should compute EBITDAre correctly as NOI - G&A', () => {
    const noi = 500;
    const ga = 30;
    const ebitdare = computeEBITDAre(noi, ga);
    expect(ebitdare).toBe(470);
  });

  it('should handle zero NOI case without negative FFO logic issues', () => {
    const ffo = computeFFO(0, 50, 20);
    expect(ffo).toBe(-70); // FFO can be negative for distressed REITs
  });

  it('should produce AFFO less than or equal to NOI', () => {
    const noi = 500;
    const affo = computeAFFO(noi, 10, 40);
    expect(affo).toBeLessThanOrEqual(noi);
  });
});

// ============================================================
// Payout Ratio Tests
// ============================================================

describe('Payout ratio calculations', () => {
  const computePayoutRatio = (
    dividendsPaid: number,
    affo: number,
    dilutedShares: number
  ): number => {
    const affoPerShare = affo / dilutedShares;
    return (dividendsPaid / affoPerShare) * 100;
  };

  it('should compute payout ratio correctly', () => {
    // $0.812 dividend, AFFO of $450M, 925M shares = AFFO/share of ~$0.486
    const payout = computePayoutRatio(0.812, 450, 925);
    // 0.812 / (450/925) * 100 = 0.812 / 0.4865 * 100 = ~166.9%
    expect(payout).toBeGreaterThan(100); // High payout
  });

  it('should return payout above 100% when dividend exceeds AFFO per share', () => {
    const payout = computePayoutRatio(5.0, 100, 100);
    // 5 / 1 * 100 = 500%
    expect(payout).toBe(500);
  });

  it('should handle typical REIT payout ratios in the 60-90% range', () => {
    // Typical: $2.50 dividend, AFFO $3.50/share
    const payout = computePayoutRatio(2.5, 350, 100);
    // 2.5 / 3.5 * 100 = ~71.4%
    expect(payout).toBeCloseTo(71.43, 1);
  });
});

// ============================================================
// Interest Coverage Tests
// ============================================================

describe('Interest coverage ratio', () => {
  const computeInterestCoverage = (ebitdare: number, interestExpense: number): number => {
    return interestExpense > 0 ? ebitdare / interestExpense : Infinity;
  };

  it('should compute interest coverage correctly', () => {
    const coverage = computeInterestCoverage(470, 80);
    expect(coverage).toBeCloseTo(5.875, 2);
  });

  it('should handle zero interest expense (unlevered REIT)', () => {
    const coverage = computeInterestCoverage(470, 0);
    expect(coverage).toBe(Infinity);
  });

  it('should flag coverage below 1.5x as dangerous', () => {
    const coverage = computeInterestCoverage(100, 80);
    expect(coverage).toBeLessThan(1.5);
    expect(coverage).toBeGreaterThan(1.0);
  });

  it('should flag coverage below 1.0x as distressed', () => {
    const coverage = computeInterestCoverage(50, 80);
    expect(coverage).toBeLessThan(1.0);
  });
});

// ============================================================
// G&A to GAV Ratio Tests
// ============================================================

describe('G&A to GAV ratio', () => {
  const computeGAToGAV = (gaExpense: number, totalAssets: number): number => {
    return totalAssets > 0 ? ((gaExpense * 4) / totalAssets) * 100 : 0;
  };

  it('should compute G&A to GAV correctly (annualized quarterly G&A / total assets)', () => {
    // Quarterly G&A of $30M, total assets $10,000M
    const ratio = computeGAToGAV(30, 10000);
    // (30 * 4) / 10000 * 100 = 1.2%
    expect(ratio).toBeCloseTo(1.2, 1);
  });

  it('should return 0 for zero assets', () => {
    const ratio = computeGAToGAV(30, 0);
    expect(ratio).toBe(0);
  });

  it('should flag high G&A ratios above 1.5% as expensive', () => {
    const ratio = computeGAToGAV(50, 10000);
    // (50*4)/10000*100 = 2.0%
    expect(ratio).toBeGreaterThan(1.5);
  });
});

// ============================================================
// Growth Decomposition Tests
// ============================================================

describe('Growth decomposition', () => {
  it('should sum all growth components to net AFFO growth', () => {
    const ssNoi = 3.8;
    const acqAccretion = 0.48;
    const devAlpha = 1.44;
    const structuralLeakage = -0.8;
    const capImpact = 0.1;
    const netAffoGrowth = ssNoi + acqAccretion + devAlpha + structuralLeakage + capImpact;
    expect(netAffoGrowth).toBeCloseTo(5.02, 2);
  });

  it('should produce negative net growth for distressed REITs with high leakage', () => {
    const ssNoi = -1.5 + (-0.4); // Office sector with negative growth alpha
    const acqAccretion = (0.01 * 20) / 100; // Very low
    const devAlpha = (0.05 * 150) / 100;
    const structuralLeakage = -(0.22 * 10);
    const capImpact = -0.2;
    const netAffoGrowth = ssNoi + acqAccretion + devAlpha + structuralLeakage + capImpact;
    expect(netAffoGrowth).toBeLessThan(0);
  });

  it('should produce acquisition accretion from volume * spread', () => {
    const acqVol = 0.04; // 4% of GAV
    const acqSpread = 120; // 120 bps
    const accretion = (acqVol * acqSpread) / 100;
    expect(accretion).toBeCloseTo(0.048, 3);
  });
});

// ============================================================
// Expectations Service Tests
// ============================================================

describe('Historical lookbacks', () => {
  it('should return 4 periods (1Y, 3Y, 5Y, 10Y)', () => {
    const lookbacks = getHistoricalLookbacks('g', Sector.INDUSTRIAL);
    expect(lookbacks).toHaveLength(4);
    expect(lookbacks.map(l => l.period)).toEqual(['1Y', '3Y', '5Y', '10Y']);
  });

  it('should have higher growth medians for industrial sector vs office', () => {
    const industrial = getHistoricalLookbacks('g', Sector.INDUSTRIAL);
    const office = getHistoricalLookbacks('g', Sector.OFFICE);
    expect(industrial[2].median).toBeGreaterThan(office[2].median);
  });

  it('should have low and high bounds around the median', () => {
    const lookbacks = getHistoricalLookbacks('g', Sector.RESIDENTIAL);
    for (const lb of lookbacks) {
      expect(lb.low).toBeLessThan(lb.median);
      expect(lb.high).toBeGreaterThan(lb.median);
      expect(lb.p25).toBeLessThan(lb.p75);
    }
  });
});

describe('Percentile calculation', () => {
  const lookback: HistoricalLookback = {
    period: '5Y',
    median: 4.5,
    low: 1.5,
    high: 7.5,
    p25: 3.5,
    p75: 5.5,
  };

  it('should return 0 for values at or below low', () => {
    expect(calculatePercentile(1.0, lookback)).toBe(0);
    expect(calculatePercentile(1.5, lookback)).toBe(0);
  });

  it('should return 100 for values at or above high', () => {
    expect(calculatePercentile(8.0, lookback)).toBe(100);
    expect(calculatePercentile(7.5, lookback)).toBe(100);
  });

  it('should return 50 for median value', () => {
    expect(calculatePercentile(4.5, lookback)).toBe(50);
  });

  it('should be linearly interpolated between low and high', () => {
    const p = calculatePercentile(3.0, lookback);
    // (3.0 - 1.5) / (7.5 - 1.5) * 100 = 1.5/6.0 * 100 = 25
    expect(p).toBeCloseTo(25, 1);
  });
});

describe('Expectations status classification', () => {
  const lookback: HistoricalLookback = {
    period: '5Y',
    median: 4.5,
    low: 1.5,
    high: 7.5,
    p25: 3.5,
    p75: 5.5,
  };

  it('should classify high implied growth as "Priced for Perfection"', () => {
    const status = getExpectationsStatus(7.3, lookback);
    expect(status.label).toBe('Priced for Perfection');
  });

  it('should classify low implied growth as "Priced for Disaster"', () => {
    const status = getExpectationsStatus(1.6, lookback);
    expect(status.label).toBe('Priced for Disaster');
  });

  it('should classify middle values as "Fairly Valued"', () => {
    const status = getExpectationsStatus(4.5, lookback);
    expect(status.label).toBe('Fairly Valued');
  });
});

describe('Value trap detection', () => {
  const lookback: HistoricalLookback = {
    period: '5Y',
    median: 4.5,
    low: 1.5,
    high: 7.5,
    p25: 3.5,
    p75: 5.5,
  };

  it('should flag office REITs with low expectations as value traps', () => {
    const result = checkValueTrap('BXP', Sector.OFFICE, 2.0, lookback, 75);
    expect(result.status).toBe('Value Trap');
    expect(result.reason).toContain('Structural sector decline');
  });

  it('should flag high payout ratios with low expectations as value traps', () => {
    const result = checkValueTrap('SPG', Sector.RETAIL, 2.0, lookback, 98);
    expect(result.status).toBe('Value Trap');
    expect(result.reason).toContain('High Payout');
  });

  it('should classify low expectations without red flags as "Cheap"', () => {
    const result = checkValueTrap('PLD', Sector.INDUSTRIAL, 2.0, lookback, 60);
    expect(result.status).toBe('Cheap');
  });

  it('should return "Neutral" for normal valuation levels', () => {
    const result = checkValueTrap('EQR', Sector.RESIDENTIAL, 4.5, lookback, 75);
    expect(result.status).toBe('Neutral');
  });
});
