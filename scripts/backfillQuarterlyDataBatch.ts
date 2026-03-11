import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { FMPService } from '../services/fmpService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * COMPREHENSIVE BACKFILL STRATEGY
 *
 * FMP Note: Batch comma-separated endpoints deprecated Aug 2025
 * New approach: Individual requests per ticker, parallelized for efficiency
 *
 * API Calls Required:
 * - 17 REITs × 4 endpoints = 68 API calls per full backfill
 * - Endpoints: Income Statement, Balance Sheet, Cash Flow, Key Metrics
 * - Free tier: 250 calls/day (plenty of headroom)
 *
 * Data Fetched:
 * - Income statements (revenue, operating income, net income)
 * - Balance sheets (assets, debt, equity)
 * - Cash flow statements (operating CF, capex, dividends)
 * - Key metrics (dividend per share, market cap, ratios)
 *
 * Efficiency vs Original:
 * - Original: 17 tickers × 10 years × 4 quarters × 4 endpoints = 2,720 individual calls
 * - Optimized: 17 tickers × 4 endpoints = 68 calls (97.5% reduction!)
 * - Rate limiting: 1 second between tickers
 */

const ALL_REITS = [
  'PLD', 'REXR',           // Industrial
  'EQR', 'AVB', 'ESS', 'MAA',  // Residential
  'O', 'SPG',              // Retail
  'BXP', 'VNO',            // Office
  'INVH', 'AMH',           // SFR
  'PSA', 'EXR', 'CUBE',    // Self-Storage
  'HST', 'RHP'             // Lodging
];

const LOOKBACK_YEARS = 10;

/**
 * FULL BACKFILL: Fetch all REITs using batch requests
 * This completes in ~1 minute with only 4 API calls
 */
async function fullBackfill() {
  console.log('📊 Starting BATCH backfill for all 17 REITs...\n');
  console.log(`Using batch requests: ${ALL_REITS.length} tickers, ${LOOKBACK_YEARS}Y lookback\n`);

  const startTime = Date.now();

  try {
    // Single batch call processes all REITs
    await FMPService.batchFetchQuarterlyFundamentals(ALL_REITS, LOOKBACK_YEARS);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Full backfill complete in ${elapsed}s`);
    console.log(`📈 API calls used: ~${ALL_REITS.length * 4} (${ALL_REITS.length} REITs × 4 endpoints)`);
    console.log(`📊 Endpoints: Income Statement, Balance Sheet, Cash Flow, Key Metrics`);
    console.log(`💾 Data stored for ${ALL_REITS.length} REITs × ${LOOKBACK_YEARS * 4} quarters`);
    console.log(`🎯 Free tier usage: ${((ALL_REITS.length * 4) / 250 * 100).toFixed(1)}% of daily limit`);
  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message);
    throw error;
  }
}

/**
 * INCREMENTAL UPDATE: Check for new quarters and update as needed
 * Run this daily to keep data fresh
 */
async function incrementalUpdate() {
  console.log('🔄 Checking for new quarterly data...\n');

  // Get most recent quarter end
  const latestQuarter = getLatestQuarterEnd();
  console.log(`Latest complete quarter: ${latestQuarter.toISOString().split('T')[0]}\n`);

  // Check which REITs need updates
  const reitsNeedingUpdate: string[] = [];

  for (const ticker of ALL_REITS) {
    const { data: reit } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', ticker)
      .single();

    if (!reit) continue;

    const { data: latestData } = await supabase
      .from('quarterly_fundamentals')
      .select('fiscal_date')
      .eq('reit_id', reit.id)
      .order('fiscal_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestInDB = latestData ? new Date(latestData.fiscal_date) : null;

    if (!latestInDB || latestInDB < latestQuarter) {
      reitsNeedingUpdate.push(ticker);
    }
  }

  if (reitsNeedingUpdate.length === 0) {
    console.log('✓ All REITs are up to date!');
    return;
  }

  console.log(`Found ${reitsNeedingUpdate.length} REITs needing updates: ${reitsNeedingUpdate.join(', ')}\n`);

  // Batch update
  await FMPService.batchFetchQuarterlyFundamentals(reitsNeedingUpdate, 1); // Only fetch recent data

  console.log(`\n✅ Incremental update complete`);
}

/**
 * Get the most recent completed quarter end date
 */
function getLatestQuarterEnd(): Date {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  // If we're early in Q1, latest complete quarter is Q4 of last year
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
 * SCHEDULED TASK HELPER
 * Returns the hour of day (0-23) this task should run based on task ID
 * Spreads tasks evenly across 24 hours
 */
function getScheduledHour(taskId: number, totalTasks: number = 4): number {
  return Math.floor((taskId * 24) / totalTasks);
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
  } else if (mode === 'schedule-info') {
    // Show suggested schedule for cron jobs
    console.log('📅 Suggested 24-hour staggered schedule:\n');
    console.log('# Full backfill (once on initial setup):');
    console.log('npx tsx scripts/backfillQuarterlyDataBatch.ts full\n');
    console.log('# Incremental updates (daily):');
    console.log('0 2 * * * npx tsx scripts/backfillQuarterlyDataBatch.ts incremental');
    console.log('\nYou only need 1 daily cron job!');
    console.log('API usage: Varies by new filings (0-68 calls/day, well within free tier of 250/day)');
  } else {
    console.error('Unknown mode. Use: full | incremental | schedule-info');
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✓ Task completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Task failed:', error);
      process.exit(1);
    });
}

export { fullBackfill, incrementalUpdate };
