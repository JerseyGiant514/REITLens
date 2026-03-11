# Historical Returns Data Investigation Report

**Date:** 2026-02-25
**Status:** ✅ DATA EXISTS BUT NOT DISPLAYING IN UI

---

## Executive Summary

The historical returns data **DOES EXIST** in Supabase and was successfully populated by the `calculateRealReturns.ts` script. However, there is a **property naming mismatch** between the service layer and the component that is preventing the data from displaying correctly in the UI.

---

## Investigation Findings

### 1. Database Status: ✅ POPULATED

**Table:** `historical_returns`
**Total Records:** 51
**REITs with Data:** 17
**Most Recent Data:** 2026-02-25

#### Sample Data (PLD - Prologis):
```
1Y: Total 17.9% = Yield 3.5% + Growth 8.7% + Valuation 5.8%
3Y: Total 8.0% = Yield 3.5% + Growth 2.7% + Valuation 1.8%
5Y: Total 10.7% = Yield 3.5% + Growth 4.3% + Valuation 2.9%
```

#### REITs with Data:
- PLD (Prologis, Inc.)
- REXR (Rexford Industrial Realty)
- EQR (Equity Residential)
- AVB (AvalonBay Communities)
- ESS (Essex Property Trust)
- MAA (Mid-America Apartment)
- O (Realty Income Corp)
- SPG (Simon Property Group)
- BXP (Boston Properties)
- VNO (Vornado Realty Trust)
- INVH (Invitation Homes Inc.)
- AMH (American Homes 4 Rent)
- PSA (Public Storage)
- EXR (Extra Space Storage)
- CUBE (CubeSmart)
- HST (Host Hotels & Resorts)
- RHP (Ryman Hospitality Properties)

---

### 2. Script Execution: ✅ WORKING

**Script:** `scripts/calculateRealReturns.ts`

The script successfully:
- Fetches data from Yahoo Finance API
- Calculates annualized returns for 1Y, 3Y, 5Y periods
- Decomposes returns into: Yield + Growth + Valuation
- Inserts/updates data in Supabase

**Console Output Sample:**
```
📊 Calculating ACTUAL historical returns from market data...

🔍 Fetching real data for PLD...
  1Y: Total 17.9% = Yield 3.5% + Growth 8.7% + Valuation 5.8%
  3Y: Total 8.0% = Yield 3.5% + Growth 2.7% + Valuation 1.8%
  5Y: Total 10.7% = Yield 3.5% + Growth 4.3% + Valuation 2.9%
```

---

### 3. Service Layer: ✅ FETCHING DATA

**File:** `services/historicalReturnsService.ts`

The service successfully:
- Queries Supabase for historical returns
- Transforms data to TypeScript interface
- Returns properly formatted data

**Interface (camelCase):**
```typescript
export interface HistoricalReturn {
  period: '1Y' | '3Y' | '5Y' | '10Y';
  totalReturn: number;
  dividendYieldContribution: number;
  affoGrowthContribution: number;
  multipleReratingContribution: number;
}
```

**Sample Query Result:**
```json
[
  {
    "period": "1Y",
    "totalReturn": 17.93,
    "dividendYieldContribution": 3.5,
    "affoGrowthContribution": 8.66,
    "multipleReratingContribution": 5.77
  }
]
```

---

### 4. Component Layer: ❌ PROPERTY MISMATCH

**File:** `components/ReturnDecomposition.tsx`

**Problem:** The component is trying to access properties using **snake_case** naming, but the service returns **camelCase** properties.

**Lines 100-112:**
```typescript
useEffect(() => {
  async function loadHistoricalReturns() {
    try {
      console.log(`[ReturnDecomp] Loading returns for ${ticker}...`);
      const returns = await HistoricalReturnsService.getReturnsForTicker(ticker);
      console.log(`[ReturnDecomp] Loaded ${returns.length} periods:`, returns);
      setHistoricalReturns(returns);
    } catch (error) {
      console.error('Failed to load historical returns:', error);
    }
  }
  loadHistoricalReturns();
}, [ticker]);
```

**Lines 171-189 (THE ISSUE):**
```typescript
const historicals = historicalReturns.length > 0
  ? historicalReturns.map(ret =>
      buildBar(
        ret.period + ' Hist.',
        ret.dividend_yield_contribution,  // ❌ WRONG - should be ret.dividendYieldContribution
        ret.affo_growth_contribution,     // ❌ WRONG - should be ret.affoGrowthContribution
        {
          ss: ret.organic_ss_noi || 0,
          acqVol: growth.acqVol,
          acqSpread: growth.acqSpread,
          devVol: growth.devVol,
          devSpread: growth.devSpread,
          leakage: ret.cad_leakage || 0,
          cap: ret.cap_impact || 0
        },
        ret.multiple_rerating_contribution,  // ❌ WRONG - should be ret.multipleReratingContribution
        false
      )
    )
  : [/* fallback dummy data */];
```

**Result:** Because all properties return `undefined`, the component falls back to hardcoded dummy data in lines 191-194.

---

## Root Cause Analysis

### The Mismatch Chain:

1. **Database Schema** (snake_case):
   - `dividend_yield_contribution`
   - `affo_growth_contribution`
   - `multiple_rerating_contribution`

2. **Service Layer** (converts to camelCase):
   ```typescript
   const returns: HistoricalReturn[] = (data || []).map(row => ({
     period: row.period as '1Y' | '3Y' | '5Y' | '10Y',
     totalReturn: parseFloat(row.total_return),
     dividendYieldContribution: parseFloat(row.dividend_yield_contribution),
     affoGrowthContribution: parseFloat(row.affo_growth_contribution),
     multipleReratingContribution: parseFloat(row.multiple_rerating_contribution)
   }));
   ```

3. **Component** (incorrectly uses snake_case):
   ```typescript
   ret.dividend_yield_contribution  // undefined!
   ret.affo_growth_contribution     // undefined!
   ret.multiple_rerating_contribution  // undefined!
   ```

---

## Verification Scripts

### 1. Database Verification
**File:** `scripts/verifyHistoricalReturns.ts`

Run with:
```bash
npx tsx scripts/verifyHistoricalReturns.ts
```

Shows all historical returns data in the database.

### 2. Data Population
**File:** `scripts/calculateRealReturns.ts`

Run with:
```bash
npx tsx scripts/calculateRealReturns.ts
```

Fetches fresh data from Yahoo Finance and populates Supabase.

---

## Solution

Fix the property access in `components/ReturnDecomposition.tsx` line 172-189:

**Change FROM:**
```typescript
ret.dividend_yield_contribution
ret.affo_growth_contribution
ret.multiple_rerating_contribution
```

**Change TO:**
```typescript
ret.dividendYieldContribution
ret.affoGrowthContribution
ret.multipleReratingContribution
```

---

## Console Logs to Watch

When the fix is applied, you should see in the browser console:

```
[ReturnDecomp] Loading returns for PLD...
[ReturnDecomp] Loaded 3 periods: [...]
[ReturnDecomp] Chart data: [...]
```

The chart should then display real historical data instead of dummy data.

---

## Additional Notes

### Other Potential Issues:
1. The component also references fields that don't exist in the database:
   - `ret.organic_ss_noi` (line 178)
   - `ret.cad_leakage` (line 183)
   - `ret.cap_impact` (line 184)

   These are all set to `0` as fallback, which is fine for now.

2. The `calculateRealReturns.ts` script uses a simplified decomposition:
   - Growth = 60% of price return
   - Valuation = 40% of price return
   - Yield = from Yahoo Finance dividend yield (or 3.5% default)

   This is noted as "rough" and "simplified" in the code comments.

### Future Enhancements:
1. Add more detailed growth decomposition fields to the database:
   - `organic_ss_noi`
   - `cad_leakage`
   - `cap_impact`

2. Improve the decomposition algorithm in `calculateRealReturns.ts` to be more accurate.

3. Add 10Y historical returns data.

---

## Summary Checklist

- ✅ Database table exists
- ✅ Data is populated (51 records for 17 REITs)
- ✅ Service layer fetches data correctly
- ✅ Service returns properly typed data
- ❌ Component uses wrong property names
- ✅ Verification script created
- ✅ Data population script working

**Next Step:** Fix property names in `ReturnDecomposition.tsx`
