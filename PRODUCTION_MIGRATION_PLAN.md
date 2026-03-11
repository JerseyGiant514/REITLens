# REITLens Production Migration Plan

## Executive Summary
Transition from prototype mock data to production-grade data infrastructure following the Medallion Architecture (Bronze → Silver → Gold layers) with efficient caching.

## Current State Analysis
✅ **Already Implemented:**
- Supabase connection configured
- Basic portfolios table with RLS
- Auth system in place
- Yahoo Finance API integration for market data
- SEC EDGAR API key available

❌ **Needs Migration (52 instances of mock data identified):**
- All financial data (revenues, NOI, FFO, AFFO)
- Operational KPIs (occupancy, SS-NOI growth, WALT)
- Historical returns decomposition
- Sector benchmarks
- Institutional profiles
- Debt schedules
- Macro economic data

---

## Phase 1: Foundation (Week 1) - CRITICAL PRIORITY

### 1.1 Core Data Tables
**Goal:** Create master data tables for REITs and basic financials

**Tables to Create:**
```sql
- reits (master registry)
- financials_quarterly (normalized quarterly financials)
- market_data_daily (price/market cap time series)
- data_cache (application-level caching)
```

**Success Criteria:**
- Can query REIT list from database instead of hardcoded array
- Can store/retrieve quarterly financials
- Cache layer operational with TTL

### 1.2 Caching Strategy
**Implementation:**
```typescript
// Three-tier caching:
// 1. In-memory (for current session) - 5 min TTL
// 2. LocalStorage (client-side) - 1 hour TTL
// 3. Supabase data_cache table - 24 hour TTL
```

**Cache Keys:**
```typescript
`reit:${ticker}:financials:ttm:${date}`
`sector:${sector}:benchmarks:${date}`
`market:${ticker}:latest`
`historical:${ticker}:returns:${period}`
```

### 1.3 Service Layer Architecture
**Create:** `services/dataService2.ts` (production version)

**Pattern:**
```typescript
async function getData<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  ttl: number
): Promise<T> {
  // 1. Check memory cache
  // 2. Check localStorage
  // 3. Check Supabase cache
  // 4. Fetch from source
  // 5. Populate all cache layers
  // 6. Return data
}
```

---

## Phase 2: Historical Returns (Week 1-2) - HIGH PRIORITY

### 2.1 Historical Returns Table
**Purpose:** Store properly reconciled return decomposition

**Schema:**
```sql
CREATE TABLE historical_returns (
  reit_id UUID,
  sector VARCHAR(50),
  as_of_date DATE,
  period VARCHAR(10), -- '1Y', '3Y', '5Y', '10Y'

  -- Components that MUST reconcile:
  total_return DECIMAL(8,2),
  dividend_yield_contribution DECIMAL(8,2),
  affo_growth_contribution DECIMAL(8,2),
  multiple_rerating_contribution DECIMAL(8,2),

  -- Growth decomposition:
  organic_ss_noi DECIMAL(6,2),
  inorganic_acquisition DECIMAL(6,2),
  development_alpha DECIMAL(6,2),
  cad_leakage DECIMAL(6,2),

  calculated_at TIMESTAMPTZ,
  CONSTRAINT reconciliation_check
    CHECK (ABS(total_return - (dividend_yield_contribution +
               affo_growth_contribution +
               multiple_rerating_contribution)) < 0.01)
);
```

### 2.2 Return Calculation Service
**Create:** `services/returnsService.ts`

**Functions:**
```typescript
// Calculate historical total return from price data
calculateTotalReturn(ticker, startDate, endDate)

// Decompose return into components
decomposeReturn(ticker, period) => {
  totalReturn,
  yieldContribution,
  growthContribution,
  valuationContribution
}

// Get cached or calculate
getHistoricalReturns(ticker, period)
```

### 2.3 Data Sources
- **Price Data:** Yahoo Finance API (already implemented)
- **Dividend History:** SEC EDGAR Form 8-K or company IR sites
- **AFFO/FFO:** Calculate from financials or SEC filings

---

## Phase 3: SEC Data Pipeline (Week 2-3) - HIGH PRIORITY

### 3.1 Bronze Layer: Raw SEC Ingestion
**Tables:**
```sql
- bronze_sec_filings (raw JSON from Company Facts API)
- bronze_market_data (raw price data)
```

**Pipeline:**
```typescript
// 1. Fetch from SEC EDGAR Company Facts API
fetchSECCompanyFacts(cik) => rawJSON

// 2. Store in bronze_sec_filings
storeRawFiling(rawJSON)

// 3. Trigger normalization job
normalizeFiling(filingId)
```

### 3.2 Silver Layer: Normalized Financials
**Mapping Logic:**
```typescript
const TAG_MAPPINGS = {
  'Revenues': 'revenue',
  'NetIncomeLoss': 'net_income',
  'NetCashProvidedByUsedInOperatingActivities': 'operating_cash_flow',
  'Assets': 'total_assets',
  'LiabilitiesAndStockholdersEquity': 'total_liabilities_equity',
  // ... 50+ more mappings
}
```

**Normalization Service:**
```typescript
normalizeFinancials(rawJSON) => {
  // Extract quarterly data
  // Map XBRL tags to internal schema
  // Calculate derived metrics (AFFO, NOI)
  // Validate balance sheet reconciliation
  // Store in financials_quarterly
}
```

### 3.3 Data Quality Checks
```typescript
interface DataQualityCheck {
  balanceSheetReconciles: boolean; // Assets = Liabilities + Equity
  hasRequiredFields: boolean; // Revenue, Net Income, Total Debt
  isRecent: boolean; // Filing < 180 days old
  dataQualityScore: number; // 0.0 to 1.0
}
```

---

## Phase 4: Macro & Benchmark Data (Week 3) - MEDIUM PRIORITY

### 4.1 FRED Integration
**Data Sources:**
- 10Y Treasury: `DGS10`
- 2Y Treasury: `DGS2`
- HY Spread: `BAMLH0A0HYM2`

**Service:**
```typescript
async function fetchFREDData(seriesId: string, startDate: Date) {
  const url = `https://api.stlouisfed.org/fred/series/observations`;
  const params = {
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json'
  };
  // Fetch, cache, store in macro_data_daily
}
```

### 4.2 Sector Benchmarks
**Calculation:**
```typescript
// From all REITs in a sector, calculate:
calculateSectorBenchmarks(sector, asOfDate) => {
  median_ss_noi_growth: percentile(values, 0.5),
  p25_ss_noi_growth: percentile(values, 0.25),
  p75_ss_noi_growth: percentile(values, 0.75),
  // ... same for cap rates, multiples, yields
}
```

---

## Phase 5: Replace Mock Data Consumers (Week 4) - HIGH PRIORITY

### 5.1 Update Components to Use Real Data

**Priority Order:**
1. **Dashboard Component** - Replace `generateFinancials()` with `getFinancials(ticker)`
2. **ReturnDecomposition** - Use `historical_returns` table
3. **SectorLens** - Use sector benchmarks table
4. **Valuation** - Calculate from real data
5. **BalanceSheet** - Use `debt_maturities` table

**Pattern:**
```typescript
// BEFORE (Mock):
const financials = generateFinancials(reitId);

// AFTER (Real):
const financials = await getFinancials(ticker, {
  useCache: true,
  fallbackToMock: true // During transition
});
```

### 5.2 Feature Flags
```typescript
const FEATURE_FLAGS = {
  USE_REAL_SEC_DATA: true,
  USE_REAL_MARKET_DATA: true,
  USE_REAL_MACRO_DATA: false, // Gradual rollout
  FALLBACK_TO_MOCK: true // Safety net
};
```

---

## Phase 6: Advanced Features (Week 5+) - MEDIUM PRIORITY

### 6.1 Operational KPIs
- Same-store NOI growth from company disclosures
- Occupancy rates from 10-Q supplements
- WALT from lease schedules

### 6.2 Debt Schedules
- Parse 10-K footnotes for maturity schedules
- Extract interest rates and terms
- Store in `debt_maturities` table

### 6.3 Institutional Profiles
- Calculate from historical performance
- Machine learning for growth alpha prediction
- Store calculated profiles, not hardcoded

---

## Implementation Strategy

### Week 1: Foundation
- [ ] Expand Supabase schema (core tables)
- [ ] Implement caching layer
- [ ] Create base service functions
- [ ] Test with 1-2 sample REITs

### Week 2: Historical Returns
- [ ] Build return calculation engine
- [ ] Populate historical_returns table for AVB, PLD, EQR
- [ ] Update ReturnDecomposition component
- [ ] Verify reconciliation

### Week 3: SEC Pipeline
- [ ] Build SEC ingestion pipeline
- [ ] Normalize 10-Q data for 5 REITs
- [ ] Update Dashboard to use real data
- [ ] Add data quality monitoring

### Week 4: Full Migration
- [ ] Migrate all 12 REITs to real data
- [ ] Update all components
- [ ] Remove mock data generators
- [ ] Add fallback logic

### Week 5: Polish
- [ ] Performance optimization
- [ ] Error handling
- [ ] Data quality dashboard
- [ ] Documentation

---

## Success Metrics

### Data Quality
- ✅ 100% of REITs have real market data
- ✅ 90%+ of financials from SEC, not proxies
- ✅ All historical returns reconcile (components sum to total)
- ✅ No mock data in production paths

### Performance
- ✅ < 200ms response time for cached data
- ✅ < 2s for uncached data
- ✅ 95%+ cache hit rate after warm-up

### Reliability
- ✅ Graceful degradation when APIs fail
- ✅ Data quality scores visible to users
- ✅ Source attribution for all metrics

---

## Risk Mitigation

### Risk 1: SEC Data Unavailable
**Mitigation:** Fallback to calculated proxies with quality score < 0.7

### Risk 2: API Rate Limits
**Mitigation:** Aggressive caching, queue system for background updates

### Risk 3: Data Quality Issues
**Mitigation:** Validation layer, manual review for critical REITs

### Risk 4: Migration Breaking Changes
**Mitigation:** Feature flags, gradual rollout, mock fallbacks

---

## Next Steps

1. **Today:** Expand Supabase schema with core tables
2. **Tomorrow:** Implement caching layer
3. **Day 3:** Build historical returns service
4. **Day 4:** Test with AVB data
5. **Day 5:** Update ReturnDecomposition component

---

## Appendix: File Changes Required

### New Files:
- `services/dataService2.ts` - Production data service
- `services/returnsService.ts` - Historical returns logic
- `services/secService.ts` - SEC ingestion pipeline
- `services/cacheService.ts` - Multi-tier caching
- `services/fredService.ts` - Macro data integration
- `utils/dataQuality.ts` - Validation logic
- `migrations/*.sql` - Database migrations

### Modified Files:
- `components/ReturnDecomposition.tsx` - Use real returns
- `components/Dashboard.tsx` - Real financials
- `components/SectorLens.tsx` - Real sector data
- `components/Valuation.tsx` - Real valuation metrics
- `components/BalanceSheet.tsx` - Real debt schedules
- `App.tsx` - Feature flags configuration

### Deprecated Files:
- `services/mockData.ts` - To be removed after migration
- Hardcoded INSTITUTIONAL_PROFILES - Move to database
- Hardcoded REITS array - Move to database

