import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { EDGARService } from '../services/edgarService';
import { REIT_CIK_MAP } from '../services/reitRegistry';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * SEC EDGAR BACKFILL STRATEGY
 *
 * FREE and COMPREHENSIVE:
 * - 100% free, no API limits
 * - Official SEC data (10-Q filings)
 * - Comprehensive XBRL facts
 * - Historical data back to ~2009 (when XBRL became mandatory)
 *
 * Data Fetched:
 * - Income statements (revenue, operating income, net income)
 * - Balance sheets (assets, debt, equity, PP&E)
 * - Cash flows (operating CF, capex, dividends)
 * - Depreciation & Amortization (for real FFO computation)
 * - Gain/Loss on property sales (for real FFO computation)
 * - Interest expense (actual, not estimated)
 * - All from official 10-Q/10-K filings
 *
 * Rate Limiting:
 * - SEC recommends max 10 requests/second
 * - We use 200ms delay (5 requests/second) to be conservative
 * - Total time: ~17 REITs x 0.2s = ~3.4 seconds
 *
 * REIT list sourced from: services/reitRegistry.ts (single source of truth)
 */

const LOOKBACK_YEARS = 10;

/**
 * FULL BACKFILL: Fetch all REITs from SEC EDGAR
 */
async function fullBackfill() {
  console.log('Starting SEC EDGAR backfill for all REITs...\n');
  console.log(`Fetching: ${REIT_CIK_MAP.length} REITs, ${LOOKBACK_YEARS}Y lookback\n`);
  console.log('100% FREE - No API costs or limits!\n');

  const startTime = Date.now();

  try {
    await EDGARService.batchFetchQuarterlyFundamentals(REIT_CIK_MAP, LOOKBACK_YEARS);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nFull backfill complete in ${elapsed}s`);
    console.log(`Data source: SEC EDGAR (official 10-Q/10-K filings)`);
    console.log(`Data stored for ${REIT_CIK_MAP.length} REITs x ~${LOOKBACK_YEARS * 4} quarters`);
    console.log(`Cost: $0.00 (completely free!)`);
  } catch (error: any) {
    console.error('Backfill failed:', error.message);
    throw error;
  }
}

/**
 * INCREMENTAL UPDATE: Check for new quarters
 */
async function incrementalUpdate() {
  console.log('Checking for new quarterly filings...\n');

  const latestQuarter = getLatestQuarterEnd();
  console.log(`Latest complete quarter: ${latestQuarter.toISOString().split('T')[0]}\n`);

  const reitsNeedingUpdate: Array<{ ticker: string; cik: string }> = [];

  for (const reit of REIT_CIK_MAP) {
    const { data: reitData } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', reit.ticker)
      .single();

    if (!reitData) continue;

    const { data: latestData } = await supabase
      .from('historical_financials')
      .select('fiscal_date')
      .eq('reit_id', reitData.id)
      .order('fiscal_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestInDB = latestData ? new Date(latestData.fiscal_date) : null;

    if (!latestInDB || latestInDB < latestQuarter) {
      reitsNeedingUpdate.push(reit);
    }
  }

  if (reitsNeedingUpdate.length === 0) {
    console.log('All REITs are up to date!');
    return;
  }

  console.log(`Found ${reitsNeedingUpdate.length} REITs needing updates: ${reitsNeedingUpdate.map(r => r.ticker).join(', ')}\n`);

  await EDGARService.batchFetchQuarterlyFundamentals(reitsNeedingUpdate, 1);

  console.log(`\nIncremental update complete`);
}

/**
 * Get the most recent completed quarter end date
 */
function getLatestQuarterEnd(): Date {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // SEC filings appear ~45 days after quarter end
  // So if we're early in Q1, latest complete quarter is Q4 of last year
  if (month < 3) {
    return new Date(year - 1, 11, 31); // Dec 31 last year
  } else if (month < 6) {
    return new Date(year, 2, 31); // Mar 31
  } else if (month < 9) {
    return new Date(year, 5, 30); // Jun 30
  } else {
    return new Date(year, 8, 30); // Sep 30
  }
}

/**
 * MAIN: Determine mode and execute
 */
async function main() {
  const mode = process.argv[2] || 'full';

  console.log(`Mode: ${mode}\n`);

  if (mode === 'full') {
    await fullBackfill();
  } else if (mode === 'incremental') {
    await incrementalUpdate();
  } else if (mode === 'test') {
    // Test with just one REIT
    console.log('Testing with PLD...\n');
    const testReit = REIT_CIK_MAP.find(r => r.ticker === 'PLD')!;
    await EDGARService.fetchAndStoreQuarterlyData(testReit.ticker, testReit.cik, 2);
    console.log('\nTest complete!');
  } else if (mode === 'info') {
    console.log('SEC EDGAR Data Integration\n');
    console.log('Available REITs:');
    REIT_CIK_MAP.forEach(r => {
      console.log(`  ${r.ticker.padEnd(6)} - ${r.name} (CIK: ${r.cik})`);
    });
    console.log(`\nTotal: ${REIT_CIK_MAP.length} REITs`);
    console.log('\nCommands:');
    console.log('  npx tsx scripts/backfillEDGARData.ts full        # Full backfill');
    console.log('  npx tsx scripts/backfillEDGARData.ts incremental # Update new quarters');
    console.log('  npx tsx scripts/backfillEDGARData.ts test        # Test with PLD only');
  } else {
    console.error('Unknown mode. Use: full | incremental | test | info');
    process.exit(1);
  }
}

// Run
main()
  .then(() => {
    console.log('\nTask completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nTask failed:', error);
    process.exit(1);
  });
