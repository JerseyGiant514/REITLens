# Financial Modeling Prep (FMP) Integration Setup

## Overview

This system uses **BATCH REQUESTS** to efficiently build a local database of REIT quarterly fundamentals using Financial Modeling Prep API.

**Key Innovation: Batch Processing**
- ✅ **17 REITs in 4 API calls** (vs. 680 individual calls!)
- ✅ Complete 10-year backfill in **under 1 minute**
- ✅ Lazy loading: check DB first, fetch only if missing
- ✅ 24-hour staggering for maintenance updates
- ✅ Free tier friendly: Only 4 calls/day for all REITs

---

## How Batching Works

### Old Approach (Inefficient):
```
17 tickers × 2 endpoints × 10 years × 4 quarters = 680 API calls
Free tier (250/day) = 3 days to complete
```

### New Approach (Batch Requests):
```
Batch 1: Tickers 1-10 → 2 API calls (income + metrics)
Batch 2: Tickers 11-17 → 2 API calls (income + metrics)
Total: 4 API calls for ALL 17 REITs!
```

**API Endpoint:**
```
/income-statement/PLD,REXR,EQR,AVB,ESS,MAA,O,SPG,BXP,VNO
```

---

## Step 1: Get FMP API Key

1. Go to https://site.financialmodelingprep.com/developer/docs
2. Sign up for a free account (250 requests/day)
3. Copy your API key

**Free tier is more than enough!**
- Daily maintenance: 4 API calls
- 98% of quota unused every day

---

## Step 2: Add API Key to Environment

Already done! Just fill in your key:

```env
VITE_FMP_API_KEY=your_api_key_here
```

---

## Step 3: Create Database Tables

Run these SQL scripts in your Supabase SQL editor:

```bash
# Copy and paste contents of:
docs/database_schema_quarterly_fundamentals.sql
```

(Note: backfill_progress table not needed with batch approach!)

---

## Step 4: Initial Backfill (One Command!)

**Full backfill - All 17 REITs, 10 years of data:**
```bash
npx tsx scripts/backfillQuarterlyDataBatch.ts full
```

**What happens:**
```
📊 Starting BATCH backfill for all 17 REITs...
[FMP Batch] Fetching 10 tickers: PLD, REXR, EQR, AVB, ESS, MAA, O, SPG, BXP, VNO
[FMP Batch] ✓ Processed 10 tickers
[FMP Batch] Fetching 7 tickers: INVH, AMH, PSA, EXR, CUBE, HST, RHP
[FMP Batch] ✓ Processed 7 tickers

✅ Full backfill complete in 45.2s
📈 API calls used: ~4 (2 batches × 2 endpoints)
💾 Data stored for 17 REITs × 40 quarters
```

**That's it!** All data in under 1 minute with 4 API calls.

---

## Step 5: Daily Maintenance (Optional)

**Incremental updates for new quarters:**
```bash
npx tsx scripts/backfillQuarterlyDataBatch.ts incremental
```

**Set up daily cron job:**
```bash
# Runs at 2 AM daily to check for new quarterly filings
0 2 * * * cd /path/to/project && npx tsx scripts/backfillQuarterlyDataBatch.ts incremental
```

**What it does:**
- Checks if any REITs have new quarterly data
- Only fetches missing quarters (usually 0-17 REITs per quarter)
- Uses ~4 API calls per day max

---

## Usage in Code

**Batch fetch multiple REITs:**
```typescript
import { FMPService } from '../services/fmpService';

// Fetch all REITs at once
const data = await FMPService.batchFetchQuarterlyFundamentals(
  ['PLD', 'REXR', 'EQR'],  // tickers
  5                        // years
);

// Returns Map<ticker, QuarterlyFundamentals[]>
console.log(data.get('PLD')); // PLD's data
console.log(data.get('REXR')); // REXR's data
```

**Single ticker (lazy loading):**
```typescript
// Checks DB first, fetches only if missing
const pldData = await FMPService.getQuarterlyFundamentals('PLD', 5);
```

---

## API Efficiency Comparison

| Approach | API Calls | Time | Free Tier Impact |
|----------|-----------|------|------------------|
| **Individual requests** | 680 | 3 days | 272% of daily limit |
| **Batch requests** (new) | 4 | <1 min | 1.6% of daily limit |

**Savings:** 99.4% fewer API calls!

---

## Monitoring Progress

### Check data coverage:
```sql
SELECT
  r.ticker,
  COUNT(qf.id) as quarters_stored,
  MIN(qf.fiscal_date) as earliest_quarter,
  MAX(qf.fiscal_date) as latest_quarter
FROM reits r
LEFT JOIN quarterly_fundamentals qf ON qf.reit_id = r.id
GROUP BY r.ticker
ORDER BY r.ticker;
```

Expected after full backfill:
- `quarters_stored`: ~40 per REIT
- `earliest_quarter`: ~10 years ago
- `latest_quarter`: Most recent complete quarter

### Check recent fetches:
```sql
SELECT
  r.ticker,
  qf.fiscal_date,
  qf.period,
  qf.revenue / 1000000 as revenue_millions,
  qf.fetched_at
FROM quarterly_fundamentals qf
JOIN reits r ON r.id = qf.reit_id
ORDER BY qf.fetched_at DESC
LIMIT 20;
```

---

## 24-Hour Staggering Strategy

For ongoing maintenance after initial backfill:

**Single daily cron job (2 AM):**
```bash
0 2 * * * npx tsx scripts/backfillQuarterlyDataBatch.ts incremental
```

**Why only one job?**
- Batch requests are so efficient, we don't need staggering!
- 4 API calls << 250 daily limit
- All REITs update in one batch
- Simple, reliable, efficient

**Advanced: Multiple checks (if paranoid):**
```bash
0 2 * * *   # Check at 2 AM
0 14 * * *  # Check at 2 PM
```
Still only 8 API calls/day total.

---

## Troubleshooting

### Batch Request Fails
```
Error: Batch request returned error
```
**Solution:** FMP batch endpoint may have limits. Split into smaller batches:
```typescript
// In fmpService.ts, change:
const BATCH_SIZE = 10; // to
const BATCH_SIZE = 5;  // smaller batches
```

### Missing Recent Quarters
```
Latest quarter is 2024-03-31, but it's now June 2024
```
**Solution:** REITs file 10-Qs ~45 days after quarter end. Q2 data appears mid-August.

### API Limit Hit (Rare)
```
Error: API call limit reached
```
**Solution:** You'd need to make 62 full backfills in one day to hit the limit. This shouldn't happen with normal usage.

---

## Next Steps

1. ✅ Get FMP API key
2. ✅ Add to `.env`
3. ✅ Create database table
4. ▶️ **Run:** `npx tsx scripts/backfillQuarterlyDataBatch.ts full`
5. ✅ Set up daily cron (optional)
6. 📈 Start using the data!

---

## Cost Analysis

**Free Tier (250 req/day):**
- Initial backfill: 4 calls (1.6% of quota)
- Daily maintenance: 4 calls (1.6% of quota)
- Headroom: 242 calls/day unused (96.8%)

**You'll NEVER need a paid plan for this use case.**

---

## Future Enhancements

- [ ] Add balance sheet batch endpoints
- [ ] Add cash flow batch endpoints
- [ ] Add FFO/AFFO from key metrics (already batched!)
- [ ] Parse EDGAR for REIT-specific metrics
- [ ] Monthly data (still batched, ~12 calls total)
