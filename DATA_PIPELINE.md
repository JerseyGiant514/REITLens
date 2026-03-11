# DATA PIPELINE - Institutional Upgrade Documentation

## Overview

This document describes the data pipeline changes implemented as part of the REITLens V1.0 institutional upgrade (Items 1, 9, and 11 from the upgrade plan).

---

## 1. REIT Registry (Item 1) - Single Source of Truth

### Problem
Three separate REIT lists existed with conflicting data:
- `scripts/backfillEDGARData.ts` (CIK list)
- `scripts/setupREITs.ts` (REIT master data)
- `services/mockData.ts` (REIT definitions with prices, shares)

CIK conflicts existed: CUBE (1298675 vs 1394803), RHP (1364479 vs 1122304). The scripts values are correct (verified against SEC EDGAR).

### Solution

**File**: `services/reitRegistry.ts`

This file is the single canonical registry. All other files import from it.

#### Structure

```typescript
// Full registry entry with all metadata
interface REITRegistryEntry {
  id: string;                 // Internal ID (matches existing component references)
  ticker: string;             // NYSE ticker symbol
  cik: string;                // SEC CIK (unpadded) - verified against EDGAR
  cikPadded: string;          // 10-digit zero-padded CIK for SEC URLs
  name: string;               // Full company name
  sector: Sector;             // enum from types.ts
  propertyType: string;       // Property classification
  isActive: boolean;          // Whether actively tracked
  sharesOutstanding: number;  // Millions
  nominalPrice: number;       // Approximate USD price
  description: string;        // Company description
}
```

#### Derived Exports

| Export | Used By | Description |
|--------|---------|-------------|
| `REITS` | mockData.ts, all components | Array conforming to `REIT` interface |
| `REIT_CIK_MAP` | backfillEDGARData.ts | `{ticker, cik, name}` for SEC scripts |
| `REIT_SETUP_DATA` | setupREITs.ts | Database seeding data |
| `INSTITUTIONAL_PROFILES` | mockData.ts, realDataService.ts | Analytical profiles per ticker |
| `getInstitutionalProfile()` | realDataService.ts | Profile lookup with default fallback |
| `getREITByTicker()` | Any | Lookup helper |
| `getAllTickers()` | seedProfiles.ts | All tickers list |

#### How to Add a New REIT

1. Add entry to `REIT_REGISTRY` array in `services/reitRegistry.ts`
2. Add institutional profile to `INSTITUTIONAL_PROFILES` in same file
3. Run `npx tsx scripts/setupREITs.ts` to sync to Supabase
4. Run `npx tsx scripts/seedProfiles.ts` to seed profile to DB
5. Run `npx tsx scripts/backfillEDGARData.ts full` to backfill financials

#### Import Chain

```
services/reitRegistry.ts  (CANONICAL SOURCE)
    |
    +-- services/mockData.ts  (re-exports REITS, uses profiles)
    |       |
    |       +-- App.tsx, components/*.tsx (import REITS from mockData)
    |       +-- services/dataService.ts (import from mockData)
    |       +-- services/realDataService.ts (import from mockData)
    |
    +-- scripts/backfillEDGARData.ts  (imports REIT_CIK_MAP)
    +-- scripts/setupREITs.ts  (imports REIT_SETUP_DATA)
    +-- scripts/seedProfiles.ts  (imports INSTITUTIONAL_PROFILES, getAllTickers)
    +-- services/realDataService.ts  (imports getInstitutionalProfile)
```

### CIK Values (Verified March 2026)

| Ticker | CIK | Name |
|--------|-----|------|
| PLD | 1045609 | Prologis, Inc. |
| REXR | 1571283 | Rexford Industrial Realty |
| EQR | 906107 | Equity Residential |
| AVB | 915912 | AvalonBay Communities |
| ESS | 920522 | Essex Property Trust |
| MAA | 912595 | Mid-America Apartment Communities |
| O | 726728 | Realty Income Corp |
| SPG | 1063761 | Simon Property Group |
| BXP | 1037540 | BXP Inc. (parent REIT, NOT 1043121 which is LP) |
| VNO | 899689 | Vornado Realty Trust |
| INVH | 1687229 | Invitation Homes Inc. |
| AMH | 1562401 | American Homes 4 Rent |
| PSA | 1393311 | Public Storage |
| EXR | 1289490 | Extra Space Storage |
| CUBE | 1298675 | CubeSmart (NOT 1394803) |
| HST | 1070750 | Host Hotels & Resorts |
| RHP | 1364479 | Ryman Hospitality Properties (NOT 1122304) |

---

## 2. FFO/AFFO Real Computation (Item 9)

### Problem
FFO was approximated as `NOI - Interest - G&A` in realDataService.ts. This is not the NAREIT-standard FFO formula. Interest expense was hardcoded at 4.5% of debt. D&A and gains on property sales were not extracted from XBRL.

### Solution

#### XBRL Fields Added to edgarService.ts

| Field | XBRL Names Tried | Purpose |
|-------|-------------------|---------|
| Depreciation & Amortization | `DepreciationDepletionAndAmortization`, `DepreciationAndAmortization`, `Depreciation`, `DepreciationAmortizationAndAccretionNet`, `DepreciationDepletionAndAmortizationExcludingDiscontinuedOperations` | Real FFO add-back |
| Gain/Loss on Property Sales | `GainLossOnSaleOfProperties`, `GainLossOnDispositionOfAssets`, `GainsLossesOnSalesOfInvestmentRealEstate`, `GainLossOnSaleOfPropertyPlantEquipment`, `GainOnSaleOfProperties` | Real FFO exclusion |
| Interest Expense | `InterestExpense`, `InterestExpenseDebt`, `InterestIncomeExpenseNet`, `InterestAndDebtExpense` | Actual interest (not estimated) |
| Dividends Per Share | `CommonStockDividendsPerShareDeclared`, `CommonStockDividendsPerShareCashPaid` | Real dividend data (USD/shares units) |

#### FFO Formula (NAREIT Standard)

```
Real FFO = Net Income + Depreciation & Amortization - Gains on Property Sales
```

This matches the NAREIT definition: FFO excludes depreciation of real estate assets and gains/losses from sales of depreciable real estate, because real estate generally appreciates rather than depreciates.

#### AFFO Formula

```
AFFO = FFO - Maintenance CapEx
```

Where Maintenance CapEx = 60% of total CapEx (conservative split). A more precise AFFO would require supplemental data to distinguish maintenance from growth capex.

#### FFO Priority Chain (in realDataService.ts)

1. **DB-stored FFO**: Pre-computed during EDGAR backfill (most accurate)
2. **Computed from DB fields**: `Net Income + D&A - Gains on Sales` (when D&A available)
3. **Legacy approximation**: `NOI - Interest - G&A` (fallback when XBRL fields unavailable)

#### Database Schema Changes

New columns added to `historical_financials` table (via `sql/001_institutional_profiles.sql`):

```sql
depreciation_amortization  NUMERIC  -- D&A from XBRL
gain_loss_on_sales         NUMERIC  -- Gains/losses on property sales
interest_expense           NUMERIC  -- Actual interest from XBRL
dividends_per_share        NUMERIC  -- DPS from XBRL (USD/shares)
ffo                        NUMERIC  -- Pre-computed FFO
affo                       NUMERIC  -- Pre-computed AFFO
```

#### Backfill Behavior

The updated `edgarService.ts`:
- Extracts all new XBRL fields during backfill
- Computes FFO and AFFO in-memory before storage
- Updates existing records with new FFO data (if columns exist)
- Gracefully falls back to old schema if migration not yet applied
- Logs extraction stats: `Parsed 20 quarters for PLD (D&A: 18, FFO: 18, Interest: 20)`

---

## 3. Institutional Profiles in Database (Item 11)

### Problem
20 analytical parameters per REIT were hardcoded in `realDataService.ts` with no version control, audit trail, or ability to update without code deployment.

### Solution

#### Database Table: `reit_profiles`

**Migration file**: `sql/001_institutional_profiles.sql`

```sql
CREATE TABLE reit_profiles (
  id                        UUID PRIMARY KEY,
  ticker                    TEXT NOT NULL UNIQUE,
  baseline_cap_rate         NUMERIC(6,4),
  target_ltv                NUMERIC(6,4),
  operating_margin          NUMERIC(6,4),
  ga_expense_pct            NUMERIC(6,4),
  straight_line_rent_pct    NUMERIC(6,4),
  dividend_yield            NUMERIC(6,4),
  growth_alpha              NUMERIC(6,2),
  acq_volume_pct            NUMERIC(6,4),
  acq_spread_bps            NUMERIC(8,2),
  dev_pipeline_pct          NUMERIC(6,4),
  ytc_spread_bps            NUMERIC(8,2),
  recurring_capex_intensity NUMERIC(6,4),
  source_notes              TEXT,
  version                   INTEGER DEFAULT 1,
  created_at                TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ  -- auto-updated via trigger
);
```

An audit log table `reit_profile_audit` is also created for tracking changes.

#### Profile Loading Priority (in realDataService.ts)

1. **Database** (`reit_profiles` table) - allows runtime updates without deployment
2. **Hardcoded** (`reitRegistry.ts` INSTITUTIONAL_PROFILES) - resilient fallback
3. **Default** (`DEFAULT_PROFILE`) - generic REIT assumptions

Profiles are cached for 15 minutes in-memory.

#### Seed Script: `scripts/seedProfiles.ts`

```bash
npx tsx scripts/seedProfiles.ts           # Upsert all profiles from code to DB
npx tsx scripts/seedProfiles.ts verify     # Show all profiles in DB
npx tsx scripts/seedProfiles.ts diff       # Compare code vs DB values
```

The seed script reads from `reitRegistry.ts` and upserts to the database. It uses `onConflict: 'ticker'` so it is safe to run repeatedly.

#### How to Update a Profile

**Option A: Via Database (preferred for operational changes)**
1. Update the value directly in Supabase dashboard or via SQL
2. The `updated_at` trigger will auto-update the timestamp
3. Changes take effect within 15 minutes (cache expiry)

**Option B: Via Code (for permanent baseline changes)**
1. Update `INSTITUTIONAL_PROFILES` in `services/reitRegistry.ts`
2. Run `npx tsx scripts/seedProfiles.ts` to sync to DB
3. Verify with `npx tsx scripts/seedProfiles.ts verify`

---

## 4. Deployment Checklist

To apply all changes:

1. **Run SQL migration** in Supabase SQL Editor:
   ```
   sql/001_institutional_profiles.sql
   ```
   This creates the `reit_profiles` table and adds FFO columns to `historical_financials`.

2. **Seed profiles to database**:
   ```bash
   npx tsx scripts/seedProfiles.ts
   npx tsx scripts/seedProfiles.ts verify
   ```

3. **Re-backfill EDGAR data** (to populate new FFO fields):
   ```bash
   npx tsx scripts/backfillEDGARData.ts full
   ```

4. **Verify**:
   - Check `historical_financials` table has `ffo`, `affo`, `depreciation_amortization` values
   - Check `reit_profiles` table has all 17 tickers
   - Verify app loads without errors

---

## 5. What Was Implemented vs What Still Needs Work

### Implemented

| Item | Status | Details |
|------|--------|---------|
| Single REIT registry | Done | `services/reitRegistry.ts` with 17 REITs, verified CIKs |
| mockData.ts updated | Done | Now imports from registry, no own REIT definitions |
| Scripts updated | Done | backfillEDGARData.ts, setupREITs.ts import from registry |
| XBRL D&A extraction | Done | 5 field name variants tried |
| XBRL gain/loss extraction | Done | 5 field name variants tried |
| XBRL interest expense | Done | 4 field name variants tried |
| XBRL dividends per share | Done | 2 field name variants, USD/shares units |
| Real FFO computation | Done | Net Income + D&A - Gains on Sales |
| AFFO computation | Done | FFO - Maintenance CapEx (60% of total) |
| FFO fallback chain | Done | DB FFO > Computed > Legacy approximation |
| reit_profiles table | Done | SQL migration created |
| Profile seeding script | Done | With verify and diff modes |
| DB profile loading | Done | With 15-min cache and hardcoded fallback |
| Profile audit log table | Done | Tracks field-level changes |

### Still Needs Work

| Item | Status | Details |
|------|--------|---------|
| Maintenance vs Growth CapEx split | Partial | Using 60/40 heuristic; needs 10-K supplemental data for actual split |
| NOI from XBRL | Not Done | Still using operating_income or revenue * margin; real NOI requires parsing rental income + operating expenses |
| Same-store NOI growth | Not Done | Requires 10-K supplemental data (not in XBRL) |
| Occupancy, WALT, leasing spreads | Not Done | Requires 10-K supplemental data |
| DPS-based dividend yield | Partial | DPS extracted but not yet used in marketDataService |
| Profile audit log population | Not Done | Audit table exists but no trigger to populate it on profile changes |
| Preferred stock dividend adjustments | Not Done | Would make FFO more precise for REITs with preferred equity |
| 10-K annual data | Not Done | Only 10-Q quarterly data extracted; some REITs report key metrics only in 10-K |
