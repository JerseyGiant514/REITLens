/**
 * Data Service Test Suite
 *
 * Tests the unified accessor layer (Medallion Architecture):
 * - Cache behavior (memory cache with TTL)
 * - Fallback pattern (DB > Live SEC > Mock)
 * - SEC data normalization
 * - Synchronous vs async data access patterns
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FinancialsQuarterly } from '../../types';

// We test the dataService logic by importing functions and mocking dependencies.
// The dataService imports from mockData and realDataService, so we mock those.

// Mock the supabase client to avoid real database calls
vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        gt: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      upsert: () => Promise.resolve({ error: null }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

describe('normalizeSECData', () => {
  // Import after mocks are set up
  let normalizeSECData: typeof import('../../services/dataService').normalizeSECData;

  beforeEach(async () => {
    const dataService = await import('../../services/dataService');
    normalizeSECData = dataService.normalizeSECData;
  });

  it('should return empty array for null input', () => {
    const result = normalizeSECData(null, '1');
    expect(result).toEqual([]);
  });

  it('should return empty array for missing us-gaap facts', () => {
    const result = normalizeSECData({ facts: {} }, '1');
    expect(result).toEqual([]);
  });

  it('should return empty array for missing facts key', () => {
    const result = normalizeSECData({}, '1');
    expect(result).toEqual([]);
  });

  it('should normalize SEC EDGAR data into FinancialsQuarterly format', () => {
    const mockSECData = {
      facts: {
        'us-gaap': {
          Revenues: {
            units: {
              USD: [
                { end: '2024-03-31', val: 1800000000 },
                { end: '2024-06-30', val: 1900000000 },
              ],
            },
          },
          NetIncomeLoss: {
            units: {
              USD: [
                { end: '2024-03-31', val: 400000000 },
                { end: '2024-06-30', val: 420000000 },
              ],
            },
          },
          Assets: {
            units: {
              USD: [
                { end: '2024-03-31', val: 50000000000 },
                { end: '2024-06-30', val: 51000000000 },
              ],
            },
          },
          LongTermDebt: {
            units: {
              USD: [
                { end: '2024-03-31', val: 15000000000 },
                { end: '2024-06-30', val: 15500000000 },
              ],
            },
          },
        },
        dei: {
          EntityCommonStockSharesOutstanding: {
            units: {
              shares: [{ end: '2024-06-30', val: 925000000 }],
            },
          },
        },
      },
    };

    const result = normalizeSECData(mockSECData, '1'); // PLD has id '1'
    expect(result).toHaveLength(2);

    // Check first quarter
    const q1 = result[0];
    expect(q1.periodEndDate).toBe('2024-03-31');
    expect(q1.reitId).toBe('1');
    expect(q1.revenue).toBe(1800); // 1.8B / 1M = 1800
    expect(q1.netIncome).toBe(400); // 400M / 1M = 400
    expect(q1.totalAssets).toBe(50000); // 50B / 1M = 50000
    expect(q1.totalDebt).toBe(15000);
  });

  it('should compute derived metrics from SEC data', () => {
    const mockSECData = {
      facts: {
        'us-gaap': {
          Revenues: {
            units: {
              USD: [{ end: '2024-06-30', val: 2000000000 }],
            },
          },
          NetIncomeLoss: { units: { USD: [{ end: '2024-06-30', val: 500000000 }] } },
          Assets: { units: { USD: [{ end: '2024-06-30', val: 60000000000 }] } },
          LongTermDebt: { units: { USD: [{ end: '2024-06-30', val: 20000000000 }] } },
        },
        dei: {},
      },
    };

    const result = normalizeSECData(mockSECData, '1');
    expect(result).toHaveLength(1);

    const q = result[0];
    // NOI = revenue * margin (PLD is Industrial, margin = 0.65 from getMargin for INDUSTRIAL)
    // Actually PLD sector is INDUSTRIAL in REITS array, getMargin returns 0.65 for Industrial
    // Wait, the code checks for RESIDENTIAL (0.70), INDUSTRIAL (0.65), DATA_CENTERS (0.55), default 0.65
    // PLD is Industrial, so margin = 0.65
    // NOI = 2000 * 0.65 = 1300 ... wait, the code does: Math.round((rev.val * margin) / 1000000)
    // NOI = (2000000000 * 0.65) / 1000000 = 1300
    expect(q.noi).toBe(1300);

    // Equity = assets - debt
    expect(q.equity).toBe(40000); // 60000 - 20000
  });
});

describe('getFinancials fallback pattern', () => {
  let getFinancials: typeof import('../../services/dataService').getFinancials;
  let generateFinancials: typeof import('../../services/mockData').generateFinancials;

  beforeEach(async () => {
    const dataService = await import('../../services/dataService');
    const mockData = await import('../../services/mockData');
    getFinancials = dataService.getFinancials;
    generateFinancials = mockData.generateFinancials;
  });

  it('should fall back to mock data when no cache or live data is available', () => {
    const result = getFinancials('1'); // PLD
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);

    // Should match mock data format
    const mockResult = generateFinancials('1');
    expect(result.length).toBe(mockResult.length);
  });

  it('should use live financials when provided and matching reitId', () => {
    const liveData: FinancialsQuarterly[] = [
      {
        periodEndDate: '2024-12-31',
        reitId: '1',
        revenue: 2000,
        netIncome: 500,
        operatingCashFlow: 900,
        totalAssets: 60000,
        totalDebt: 20000,
        equity: 40000,
        dilutedShares: 925,
        dividendsPaid: 0.812,
        noi: 1300,
        ffo: 1100,
        straightLineRent: 40,
        maintenanceCapex: 104,
        growthCapex: 52,
        gaExpense: 60,
        ebitdare: 1240,
        interestExpense: 225,
      },
    ];

    const result = getFinancials('1', liveData);
    expect(result).toEqual(liveData);
  });

  it('should NOT use live financials when reitId does not match', () => {
    const liveData: FinancialsQuarterly[] = [
      {
        periodEndDate: '2024-12-31',
        reitId: '99', // Different REIT
        revenue: 2000,
        netIncome: 500,
        operatingCashFlow: 900,
        totalAssets: 60000,
        totalDebt: 20000,
        equity: 40000,
        dilutedShares: 925,
        dividendsPaid: 0.812,
        noi: 1300,
        ffo: 1100,
        straightLineRent: 40,
        maintenanceCapex: 104,
        growthCapex: 52,
        gaExpense: 60,
        ebitdare: 1240,
        interestExpense: 225,
      },
    ];

    const result = getFinancials('1', liveData);
    // Should fall back to mock since reitId doesn't match
    expect(result).not.toEqual(liveData);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getMarketDataSync', () => {
  let getMarketDataSync: typeof import('../../services/dataService').getMarketDataSync;

  beforeEach(async () => {
    const dataService = await import('../../services/dataService');
    getMarketDataSync = dataService.getMarketDataSync;
  });

  it('should return mock market data synchronously when no cache', () => {
    const result = getMarketDataSync('1');
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('date');
    expect(result[0]).toHaveProperty('closePrice');
    expect(result[0]).toHaveProperty('marketCap');
    expect(result[0]).toHaveProperty('dividendYield');
    expect(result[0].reitId).toBe('1');
  });
});
