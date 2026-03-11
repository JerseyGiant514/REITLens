# SEC EDGAR Integration Setup

## Overview

**FREE and COMPREHENSIVE** alternative to paid financial APIs

✅ **100% FREE** - No API keys, no rate limits, no costs
✅ **Official Data** - Direct from SEC 10-Q/10-K filings
✅ **Comprehensive** - Revenue, assets, debt, equity, cash flows
✅ **Historical** - Data back to ~2009 (when XBRL became mandatory)
✅ **Reliable** - Government source, always available

---

## What We've Built

### 1. EDGAR Service ([services/edgarService.ts](../services/edgarService.ts))
Comprehensive SEC EDGAR data fetching and parsing:
- Fetches company facts from SEC XBRL API
- Parses quarterly fundamentals (10-Q filings)
- Extracts revenue, operating income, net income, assets, debt, equity
- Stores data in `historical_financials` table

### 2. Backfill Script ([scripts/backfillEDGARData.ts](../scripts/backfillEDGARData.ts))
Automated data population:
- Full backfill: All 17 REITs, 10 years of data
- Incremental updates: Check for new quarterly filings
- Test mode: Single REIT for validation

### 3. REIT Setup Script ([scripts/setupREITs.ts](../scripts/setupREITs.ts))
Populates REIT master data with CIK numbers

---

## How It Works

### SEC EDGAR XBRL API

The SEC provides company facts in XBRL format via their public API:

```
https://data.sec.gov/api/xbrl/companyfacts/CIK{CIK}.json
```

Example:
```
https://data.sec.gov/api/xbrl/companyfacts/CIK0001045609.json  # Prologis
```

This returns ALL quarterly and annual financial data in structured JSON format.

### Data Parsing

The service extracts quarterly data from multiple XBRL fact sets:
- **Revenues**: `us-gaap:Revenues`, `RevenueFromContractWithCustomerExcludingAssessedTax`
- **Operating Income**: `us-gaap:OperatingIncomeLoss`
- **Net Income**: `us-gaap:NetIncomeLoss`
- **Assets**: `us-gaap:Assets`
- **Debt**: `us-gaap:LongTermDebt`, `DebtInstrumentCarryingAmount`
- **Equity**: `us-gaap:StockholdersEquity`
- **Operating CF**: `us-gaap:NetCashProvidedByUsedInOperatingActivities`
- **CapEx**: `us-gaap:PaymentsToAcquirePropertyPlantAndEquipment`
- **Dividends**: `us-gaap:PaymentsOfDividends`
- **PP&E**: `us-gaap:PropertyPlantAndEquipmentNet`

---

## Setup & Usage

### Step 1: Ensure Database Table Exists

Make sure you've created the `historical_financials` table in Supabase:

```sql
-- See docs/database_schema_quarterly_fundamentals.sql
-- Table should be named: historical_financials
```

### Step 2: Setup REITs with CIK Numbers

```bash
npx tsx scripts/setupREITs.ts
```

This adds CIK numbers to all REITs in the database.

### Step 3: Run Initial Backfill

**Test with one REIT first:**
```bash
npx tsx scripts/backfillEDGARData.ts test
```

**Full backfill (all 17 REITs, 10 years):**
```bash
npx tsx scripts/backfillEDGARData.ts full
```

**Check available REITs:**
```bash
npx tsx scripts/backfillEDGARData.ts info
```

### Step 4: Set Up Incremental Updates (Optional)

**Manual update:**
```bash
npx tsx scripts/backfillEDGARData.ts incremental
```

**Daily cron job:**
```bash
# Check for new quarterly filings daily at 2 AM
0 2 * * * cd /path/to/project && npx tsx scripts/backfillEDGARData.ts incremental
```

---

## REITs & CIK Numbers

| Ticker | CIK | Name | Sector |
|--------|-----|------|--------|
| PLD | 1045609 | Prologis Inc | Industrial |
| REXR | 1524015 | Rexford Industrial Realty | Industrial |
| EQR | 906107 | Equity Residential | Residential |
| AVB | 915912 | AvalonBay Communities | Residential |
| ESS | 920522 | Essex Property Trust | Residential |
| MAA | 912595 | Mid-America Apartment Communities | Residential |
| O | 726728 | Realty Income Corp | Retail |
| SPG | 1063761 | Simon Property Group | Retail |
| BXP | 1043121 | Boston Properties | Office |
| VNO | 899689 | Vornado Realty Trust | Office |
| INVH | 1687229 | Invitation Homes | SFR |
| AMH | 1601047 | American Homes 4 Rent | SFR |
| PSA | 1393311 | Public Storage | Self-Storage |
| EXR | 1289490 | Extra Space Storage | Self-Storage |
| CUBE | 1434924 | CubeSmart | Self-Storage |
| HST | 1070750 | Host Hotels & Resorts | Lodging |
| RHP | 1364479 | Ryman Hospitality Properties | Lodging |

---

## Performance

- **Data Fetched**: 14/17 REITs successfully parsed
  - 3 REITs had 404 errors (need CIK verification)
- **Quarters Parsed**: ~20-30 quarters per REIT
- **Speed**: ~8.8 seconds for all 17 REITs
- **Rate Limiting**: 200ms between requests (5 req/sec, SEC recommends max 10/sec)
- **Cost**: $0.00

---

## Current Status

### ✅ Working
- SEC EDGAR API connectivity
- XBRL data parsing
- Quarterly fundamentals extraction
- REIT CIK mapping
- Data structure validation

### ⚠️ Needs Attention
- Supabase connectivity from Node.js (getting "fetch failed" errors)
- Fix CIK numbers for: REXR, AMH, CUBE (404 errors)
- Database storage once connectivity is resolved

---

## Troubleshooting

### Supabase Connection Issues

If you get "TypeError: fetch failed" when storing data:

1. **Check Supabase URL**: Ensure VITE_SUPABASE_URL is correct in .env
2. **Check Network**: Firewall/proxy might be blocking HTTPS
3. **Manual Test**: Try connecting to Supabase from browser:
   ```
   https://your-project.supabase.co/rest/v1/reits?select=*
   ```

### Missing CIK Numbers

Some REITs return 404 from SEC. This means wrong CIK or delisted company:
- **REXR** (1524015): Verify CIK
- **AMH** (1601047): Verify CIK
- **CUBE** (1434924): Verify CIK

To find correct CIK:
1. Go to https://www.sec.gov/edgar/searchedgar/companysearch
2. Search for company name
3. Copy CIK from results
4. Update in scripts/setupREITs.ts and scripts/backfillEDGARData.ts

---

## Next Steps

1. **Resolve Supabase Connection**: Fix Node.js fetch to Supabase
2. **Fix CIK Numbers**: Verify and correct 404ing CIKs
3. **Verify Data**: Check stored data in database
4. **Replace Mock Data**: Update dataService.ts to use EDGAR data instead of mock generators
5. **Add REIT-Specific Metrics**: Parse FFO, AFFO, NOI from SEC filings (might be in text sections, not XBRL)

---

## Advantages Over FMP

| Feature | SEC EDGAR | FMP Free Tier |
|---------|-----------|---------------|
| **Cost** | $0 forever | $0 (limited) |
| **REIT Support** | ✅ All REITs | ❌ Premium only |
| **Rate Limits** | None (be respectful) | 250 calls/day |
| **Historical Data** | ~15 years | ~5 years |
| **Balance Sheet** | ✅ Included | ❌ Premium only |
| **Cash Flow** | ✅ Included | ❌ Premium only |
| **Data Source** | Official filings | Aggregated/processed |
| **Reliability** | 100% (government) | Depends on subscription |

---

## Resources

- **SEC EDGAR API Docs**: https://www.sec.gov/edgar/sec-api-documentation
- **XBRL US GAAP Taxonomy**: https://www.sec.gov/structureddata/osd-inline-xbrl.html
- **Company Search**: https://www.sec.gov/edgar/searchedgar/companysearch
- **Our EDGAR Service**: [services/edgarService.ts](../services/edgarService.ts)
- **Backfill Script**: [scripts/backfillEDGARData.ts](../scripts/backfillEDGARData.ts)
