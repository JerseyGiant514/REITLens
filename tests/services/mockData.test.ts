/**
 * Mock Data Generator Test Suite
 *
 * Validates that mock data generators produce properly shaped data
 * matching the TypeScript interfaces. This is critical because mock
 * data is the fallback when real data is unavailable, and downstream
 * components assume these shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  REITS,
  generateFinancials,
  generateMarketData,
  generateKPIs,
  generateDebtMaturity,
  MACRO_DATA,
} from '../../services/mockData';
import type {
  REIT,
  FinancialsQuarterly,
  MarketDaily,
  REITKPIs,
  DebtMaturity,
  MacroDaily,
} from '../../types';
import { Sector } from '../../types';

// ============================================================
// REIT Master Data Tests
// ============================================================

describe('REITS master data', () => {
  it('should contain at least 15 REITs', () => {
    expect(REITS.length).toBeGreaterThanOrEqual(15);
  });

  it('should have unique tickers', () => {
    const tickers = REITS.map(r => r.ticker);
    const uniqueTickers = new Set(tickers);
    expect(uniqueTickers.size).toBe(tickers.length);
  });

  it('should have unique IDs', () => {
    const ids = REITS.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid sector assignments', () => {
    const validSectors = Object.values(Sector);
    for (const reit of REITS) {
      expect(validSectors).toContain(reit.sector);
    }
  });

  it('should have positive shares outstanding and nominal price', () => {
    for (const reit of REITS) {
      expect(reit.sharesOutstanding).toBeGreaterThan(0);
      expect(reit.nominalPrice).toBeGreaterThan(0);
    }
  });

  it('should have CIK numbers that are padded string format', () => {
    for (const reit of REITS) {
      expect(reit.cik).toBeDefined();
      expect(reit.cik.length).toBeGreaterThan(0);
    }
  });

  it('should contain key REITs: PLD, O, SPG, BXP', () => {
    const tickers = REITS.map(r => r.ticker);
    expect(tickers).toContain('PLD');
    expect(tickers).toContain('O');
    expect(tickers).toContain('SPG');
    expect(tickers).toContain('BXP');
  });
});

// ============================================================
// Financial Data Shape Tests
// ============================================================

describe('generateFinancials', () => {
  it('should return 8 quarters of data', () => {
    const financials = generateFinancials('1');
    expect(financials).toHaveLength(8);
  });

  it('should match FinancialsQuarterly interface shape', () => {
    const financials = generateFinancials('1');
    const q = financials[0];

    // All required fields from FinancialsQuarterly interface
    expect(q).toHaveProperty('periodEndDate');
    expect(q).toHaveProperty('reitId');
    expect(q).toHaveProperty('revenue');
    expect(q).toHaveProperty('netIncome');
    expect(q).toHaveProperty('operatingCashFlow');
    expect(q).toHaveProperty('totalAssets');
    expect(q).toHaveProperty('totalDebt');
    expect(q).toHaveProperty('equity');
    expect(q).toHaveProperty('dilutedShares');
    expect(q).toHaveProperty('dividendsPaid');
    expect(q).toHaveProperty('noi');
    expect(q).toHaveProperty('ffo');
    expect(q).toHaveProperty('straightLineRent');
    expect(q).toHaveProperty('maintenanceCapex');
    expect(q).toHaveProperty('growthCapex');
    expect(q).toHaveProperty('gaExpense');
    expect(q).toHaveProperty('ebitdare');
    expect(q).toHaveProperty('interestExpense');
  });

  it('should have positive revenue and assets for all quarters', () => {
    const financials = generateFinancials('1');
    for (const q of financials) {
      expect(q.revenue).toBeGreaterThan(0);
      expect(q.totalAssets).toBeGreaterThan(0);
      expect(q.noi).toBeGreaterThan(0);
    }
  });

  it('should have increasing revenue across quarters (growth pattern)', () => {
    const financials = generateFinancials('1');
    for (let i = 1; i < financials.length; i++) {
      expect(financials[i].revenue).toBeGreaterThanOrEqual(financials[i - 1].revenue);
    }
  });

  it('should maintain FFO = NOI - Interest - G&A identity', () => {
    const financials = generateFinancials('1');
    for (const q of financials) {
      const expectedFFO = q.noi - q.interestExpense - q.gaExpense;
      expect(q.ffo).toBe(expectedFFO);
    }
  });

  it('should maintain EBITDAre = NOI - G&A identity', () => {
    const financials = generateFinancials('1');
    for (const q of financials) {
      const expectedEBITDAre = q.noi - q.gaExpense;
      expect(q.ebitdare).toBe(expectedEBITDAre);
    }
  });

  it('should work for all defined REITs without errors', () => {
    for (const reit of REITS) {
      expect(() => generateFinancials(reit.id)).not.toThrow();
      const result = generateFinancials(reit.id);
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Market Data Shape Tests
// ============================================================

describe('generateMarketData', () => {
  it('should return 60 days of market data', () => {
    const marketData = generateMarketData('1');
    expect(marketData).toHaveLength(60);
  });

  it('should match MarketDaily interface shape', () => {
    const marketData = generateMarketData('1');
    const d = marketData[0];

    expect(d).toHaveProperty('date');
    expect(d).toHaveProperty('reitId');
    expect(d).toHaveProperty('closePrice');
    expect(d).toHaveProperty('marketCap');
    expect(d).toHaveProperty('dividendYield');
  });

  it('should have positive prices and market caps', () => {
    const marketData = generateMarketData('1');
    for (const d of marketData) {
      expect(d.closePrice).toBeGreaterThan(0);
      expect(d.marketCap).toBeGreaterThan(0);
      expect(d.dividendYield).toBeGreaterThan(0);
    }
  });

  it('should have dates in ISO format (YYYY-MM-DD)', () => {
    const marketData = generateMarketData('1');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const d of marketData) {
      expect(d.date).toMatch(dateRegex);
    }
  });
});

// ============================================================
// KPI Data Shape Tests
// ============================================================

describe('generateKPIs', () => {
  it('should return 5 quarters of KPI data', () => {
    const kpis = generateKPIs('1');
    expect(kpis).toHaveLength(5);
  });

  it('should match REITKPIs interface shape', () => {
    const kpis = generateKPIs('1');
    const k = kpis[0];

    expect(k).toHaveProperty('periodEndDate');
    expect(k).toHaveProperty('reitId');
    expect(k).toHaveProperty('sameStoreNOIGrowth');
    expect(k).toHaveProperty('occupancy');
    expect(k).toHaveProperty('leasingSpread');
    expect(k).toHaveProperty('walt');
    expect(k).toHaveProperty('cashNoiGrowth');
    expect(k).toHaveProperty('gaToGav');
    expect(k).toHaveProperty('interestCoverage');
    expect(k).toHaveProperty('payoutAffo');
  });

  it('should include growth decomposition data', () => {
    const kpis = generateKPIs('1');
    for (const k of kpis) {
      expect(k.growthDecomp).toBeDefined();
      if (k.growthDecomp) {
        expect(k.growthDecomp).toHaveProperty('ssNoi');
        expect(k.growthDecomp).toHaveProperty('acquisitionAccretion');
        expect(k.growthDecomp).toHaveProperty('devAlpha');
        expect(k.growthDecomp).toHaveProperty('structuralLeakage');
        expect(k.growthDecomp).toHaveProperty('capImpact');
        expect(k.growthDecomp).toHaveProperty('netAffoGrowth');
      }
    }
  });

  it('should have occupancy between 85% and 100%', () => {
    const kpis = generateKPIs('1');
    for (const k of kpis) {
      expect(k.occupancy).toBeGreaterThanOrEqual(85);
      expect(k.occupancy).toBeLessThanOrEqual(100);
    }
  });

  it('should have positive interest coverage for healthy REITs', () => {
    const kpis = generateKPIs('1'); // PLD is a healthy REIT
    for (const k of kpis) {
      expect(k.interestCoverage).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Debt Maturity Shape Tests
// ============================================================

describe('generateDebtMaturity', () => {
  it('should return 6 years of maturity data', () => {
    const maturities = generateDebtMaturity('1');
    expect(maturities).toHaveLength(6);
  });

  it('should match DebtMaturity interface shape', () => {
    const maturities = generateDebtMaturity('1');
    const m = maturities[0];

    expect(m).toHaveProperty('year');
    expect(m).toHaveProperty('reitId');
    expect(m).toHaveProperty('amount');
  });

  it('should have consecutive years starting from 2025', () => {
    const maturities = generateDebtMaturity('1');
    expect(maturities[0].year).toBe(2025);
    for (let i = 1; i < maturities.length; i++) {
      expect(maturities[i].year).toBe(maturities[i - 1].year + 1);
    }
  });

  it('should have positive maturity amounts', () => {
    const maturities = generateDebtMaturity('1');
    for (const m of maturities) {
      expect(m.amount).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Macro Data Tests
// ============================================================

describe('MACRO_DATA', () => {
  it('should contain at least 2 macro data points', () => {
    expect(MACRO_DATA.length).toBeGreaterThanOrEqual(2);
  });

  it('should include 10-Year Treasury', () => {
    const treasury = MACRO_DATA.find(m => m.seriesId === 'DGS10');
    expect(treasury).toBeDefined();
    expect(treasury!.seriesName).toBe('10-Year Treasury');
    expect(treasury!.value).toBeGreaterThan(0);
  });

  it('should include HY Spread', () => {
    const hySpread = MACRO_DATA.find(m => m.seriesId === 'BAMLH0A0HYM2');
    expect(hySpread).toBeDefined();
    expect(hySpread!.seriesName).toBe('HY Spread');
    expect(hySpread!.value).toBeGreaterThan(0);
  });

  it('should match MacroDaily interface shape', () => {
    for (const m of MACRO_DATA) {
      expect(m).toHaveProperty('date');
      expect(m).toHaveProperty('seriesId');
      expect(m).toHaveProperty('value');
      expect(m).toHaveProperty('seriesName');
    }
  });
});

// ============================================================
// Cross-REIT Consistency Tests
// ============================================================

describe('Cross-REIT consistency', () => {
  it('should produce different financials for different REITs', () => {
    const pld = generateFinancials('1'); // PLD (Industrial)
    const bxp = generateFinancials('19'); // BXP (Office)

    // Different REITs should have different revenues
    expect(pld[0].revenue).not.toBe(bxp[0].revenue);
  });

  it('should reflect sector-specific operating margins', () => {
    // PLD (Industrial) should have higher NOI/revenue ratio than BXP (Office)
    const pld = generateFinancials('1');
    const bxp = generateFinancials('19');

    const pldMargin = pld[0].noi / pld[0].revenue;
    const bxpMargin = bxp[0].noi / bxp[0].revenue;

    // Industrial REITs typically have higher operating margins than Office
    expect(pldMargin).toBeGreaterThan(bxpMargin);
  });

  it('should reflect sector-specific leverage levels', () => {
    // BXP (Office) typically has higher leverage than PLD (Industrial)
    const pld = generateFinancials('1');
    const bxp = generateFinancials('19');

    const pldLTV = pld[0].totalDebt / pld[0].totalAssets;
    const bxpLTV = bxp[0].totalDebt / bxp[0].totalAssets;

    expect(bxpLTV).toBeGreaterThan(pldLTV);
  });
});
