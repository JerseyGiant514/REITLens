# DATA_SOURCES_UPDATED.md -- Real Data Integration (Agent 4)

## Overview

This document describes the real data integration work completed for items 7, 8, 10, and 15 of the institutional upgrade plan. The goal was to replace synthetic/hardcoded data with real API-backed data in the Macro dashboard, dividend calculations, return decomposition, and to add data freshness indicators.

---

## Item 7: FRED API Integration for Macro Page

### Files Created/Modified
- **`services/fredService.ts`** (NEW) -- FRED API client with caching
- **`components/Macro.tsx`** (MODIFIED) -- Rewired from synthetic to FRED data
- **`.env.example`** (MODIFIED) -- Added `VITE_FRED_API_KEY` documentation

### FRED Series Used
| Series ID | Name | Frequency | Usage |
|-----------|------|-----------|-------|
| DGS10 | 10-Year Treasury Constant Maturity Rate | Daily | Risk-free rate, yield curve analysis |
| BAMLH0A0HYM2 | ICE BofA US High Yield Index OAS | Daily | Credit spread monitoring |
| FEDFUNDS | Effective Federal Funds Rate | Monthly | Policy rate tracking |
| CPIAUCSL | CPI All Urban Consumers | Monthly | Inflation monitoring |

### API Details
- **Endpoint**: `https://api.stlouisfed.org/fred/series/observations`
- **Authentication**: API key via `VITE_FRED_API_KEY` env variable
- **Rate Limit**: 120 requests/minute per key
- **Registration**: Free at https://fred.stlouisfed.org/docs/api/api_key.html
- **Caching**: 1-hour TTL (in-memory, per-series). Macro data updates at most daily.

### Fallback Behavior
When `VITE_FRED_API_KEY` is not configured:
1. The fredService generates synthetic data using deterministic sin() functions
2. Series names are suffixed with "(SYNTHETIC)" for clarity
3. The Macro page displays an amber warning: "FRED API key not configured"
4. The `source` field on all returned data is `'Mock'`
5. The StalenessIndicator shows red (stale) since `lastUpdated` is null

### Key Functions
- `fetchMacroSnapshot(lookbackDays)` -- Fetches all 4 series in parallel
- `getFREDSeries(seriesId, lookbackDays)` -- Individual series fetch
- `buildAlignedChartData(series[], keys[])` -- Merges multi-frequency series by date with forward-fill
- `computeWoWChangeBps(series)` -- Week-over-week change in basis points
- `isFREDConfigured()` -- Checks if API key is present

---

## Item 8: Real Dividend Data from EDGAR

### Files Created
- **`services/dividendService.ts`** (NEW) -- Multi-source dividend data service

### Data Source Priority
1. **Supabase DB** (`historical_financials.dividend_per_share`) -- Fastest, requires backfill
2. **SEC EDGAR XBRL** (live fetch) -- Direct from SEC, 200ms rate limit per request
3. **Institutional Profiles** (estimated) -- Hardcoded yields by ticker (2.5% - 7.1%)

### XBRL Fields for Dividends

**Agent 1 (edgarService.ts) should add these fields to the EDGAR extraction:**

| XBRL Field | Unit | Priority | Notes |
|------------|------|----------|-------|
| `CommonStockDividendsPerShareDeclared` | USD/shares | HIGH | Preferred: direct per-share declared |
| `CommonStockDividendsPerShareCashPaid` | USD/shares | HIGH | Alternative: per-share paid |
| `PaymentsOfDividends` | USD | MEDIUM | Aggregate cash outflow; need shares to derive DPS |
| `PaymentsOfDividendsCommonStock` | USD | MEDIUM | Common-only dividends |
| `DividendsCommonStock` | USD | LOW | May include preferred |

**Recommended backfill addition to `edgarService.ts`:**
```typescript
// In parseQuarterlyFundamentals, add:
const dps = this.getFactValues(facts, ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid']);
// Store in historical_financials.dividend_per_share column
```

### Dividend Yield Calculation
```
Trailing 12-Month DPS = Sum of last 4 quarters' dividends per share
Annualized Dividend Yield = (TTM DPS / Current Price) * 100
```

### Key Functions
- `getDividendData(ticker)` -- Returns full dividend data with source attribution
- `getDividendYield(ticker)` -- Returns just the yield (used by historicalReturnsService)
- `getBatchDividendYields(tickers[])` -- Batch fetch with rate limiting

---

## Item 10: Historical Returns Decomposition (Refactored)

### Files Modified
- **`services/historicalReturnsService.ts`** (REWRITTEN) -- Real data-backed return decomposition

### Methodology

#### Formula
```
Total Return = Dividend Yield Contribution + AFFO Growth Contribution + Multiple Rerating

Where:
- Total Return: Annualized price return from Yahoo Finance adjusted close data
- Dividend Yield: From dividendService (DB > EDGAR > Estimated)
- AFFO Growth: Annualized revenue growth from historical_financials (proxy for AFFO)
- Multiple Rerating: RESIDUAL = Total Return - Dividend Yield - Growth
```

#### The Residual Approach
The key insight is that multiple rerating is computed as the **residual** of total return minus the other two components. This ensures:
1. The decomposition always reconciles to actual total return
2. No need for historical P/FFO multiples (which we don't have)
3. Multiple rerating captures all valuation changes, sentiment shifts, and estimation errors

#### Data Source Priority
1. **Pre-computed** (`historical_returns` table) -- From calculateRealReturns.ts script
2. **Real Data** (Yahoo prices + DB fundamentals + dividendService) -- Best quality
3. **Fundamentals Only** (DB financials + dividendService) -- No price data, rerating = 0

#### Data Quality Flags
Each `HistoricalReturn` now includes:
- `dataQuality: 'high' | 'medium' | 'low'` -- Indicates confidence level
- `methodology: string` -- Explains exactly what data sources were used
- `lastUpdated: Date | null` -- When the data was last computed

#### Lookback Periods
- 1Y: 365 days of Yahoo price data + 4 quarters financials
- 3Y: 1095 days of Yahoo price data + 12 quarters financials
- 5Y: 1825 days of Yahoo price data + 20 quarters financials

### Previous Issues Fixed
| Issue | Before | After |
|-------|--------|-------|
| Dividend Yield | Hardcoded 3.5% for all | Real yields from dividendService (2.5-7.1%) |
| AFFO Growth | `revenue growth * 0.6` arbitrary split | Actual annualized revenue growth |
| Multiple Rerating | Always 0 | Computed as residual from total return |
| Total Return | Estimated (growth + div) | Actual from Yahoo adj close prices |
| Data Provenance | No tracking | dataQuality + methodology fields |

---

## Item 15: Staleness Indicators

### Files Created
- **`components/StalenessIndicator.tsx`** (NEW) -- Data freshness badge component

### Component API
```tsx
<StalenessIndicator
  lastUpdated={new Date('2026-02-15')}
  source="FRED"
  maxAgeDays={1}       // optional, defaults by source type
  compact={false}      // optional, shows dot-only if true
/>
```

### Color Coding
| Condition | Color | Dot Animation |
|-----------|-------|---------------|
| Updated within maxAgeDays | Emerald (green) | Pulsing |
| Updated within 1-2x maxAgeDays | Amber (yellow) | Static |
| Updated beyond 2x maxAgeDays or null | Rose (red) | Static |

### Default maxAgeDays by Source
| Source | Default maxAge | Rationale |
|--------|---------------|-----------|
| SEC / EDGAR / DB | 90 days | Quarterly filings lag ~45 days |
| Yahoo | 1 day | EOD price data |
| FRED | 1 day | Daily macro series |
| Mock / Estimated | 0 days | Always shows as stale (red) |

### Tooltip Information
On hover, displays:
- Data source name
- Last updated date (formatted)
- Age in days
- Freshness status (fresh/aging/stale)
- Max age threshold

### Design
- Matches existing dark theme (bg-obsidian, border-white/10)
- Uses text-[7px] and text-[8px] for institutional micro-typography
- Animated pulse dot for fresh data
- Works inline (flex) with other text elements

### Where Staleness Indicators Are Used
1. **Macro.tsx** -- Each FRED series KPI card shows freshness
2. **Macro.tsx** -- Header shows overall yield10y freshness
3. **historicalReturnsService.ts** -- Returns `lastUpdated` field for consumer components
4. **fredService.ts** -- Returns `lastUpdated` from FRED API observation dates
5. **dividendService.ts** -- Returns `lastUpdated` from DB/EDGAR timestamps

---

## What Still Needs Work

### For Agent 1 (Data Pipeline)
1. **Add XBRL dividend fields** to `edgarService.ts` extraction:
   - `CommonStockDividendsPerShareDeclared`
   - `CommonStockDividendsPerShareCashPaid`
   - Store in `historical_financials.dividend_per_share` column
2. **Add `dividend_per_share` column** to `historical_financials` table (SQL migration)
3. **Re-run backfill** with dividend data included

### For Agent 5 (Architecture)
1. **Integrate StalenessIndicator** into other components (Dashboard, Operations, Balance Sheet)
2. **Add DataSourceBadge** to table cells showing real vs mock data

### For Future Work
- Historical dividend yield time series (for accurate multi-year yield contributions)
- FFO/AFFO column in historical_financials (replace revenue growth proxy)
- FRED API proxy for production (avoid exposing API key in client bundle)
- Rate sensitivity regression using actual REIT returns vs yield changes
- Correlation matrix using aligned FRED + Yahoo data

---

## Environment Setup

### Required Environment Variables
```env
# .env
VITE_FRED_API_KEY=your_fred_api_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### How to Get a FRED API Key
1. Go to https://fred.stlouisfed.org/docs/api/api_key.html
2. Create a free account
3. Request an API key (instant approval)
4. Add to `.env` as `VITE_FRED_API_KEY`

---

## Files Summary

| File | Status | Owner |
|------|--------|-------|
| `services/fredService.ts` | NEW | Agent 4 |
| `services/dividendService.ts` | NEW | Agent 4 |
| `services/historicalReturnsService.ts` | REWRITTEN | Agent 4 |
| `components/StalenessIndicator.tsx` | NEW | Agent 4 |
| `components/Macro.tsx` | MODIFIED | Agent 4 |
| `.env.example` | MODIFIED | Agent 4 |
| `DATA_SOURCES_UPDATED.md` | NEW | Agent 4 |
