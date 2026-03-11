import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { FMPService } from '../services/fmpService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * Progressive backfill strategy:
 * - Run daily/weekly to gradually build up historical database
 * - Processes N REITs per run to stay within API limits
 * - Tracks progress to avoid duplicate work
 */

const REITS_TO_BACKFILL = [
  'PLD', 'REXR',           // Industrial
  'EQR', 'AVB', 'ESS', 'MAA',  // Residential
  'O', 'SPG',              // Retail
  'BXP', 'VNO',            // Office
  'INVH', 'AMH',           // SFR
  'PSA', 'EXR', 'CUBE',    // Self-Storage
  'HST', 'RHP'             // Lodging
];

const REITS_PER_RUN = 3; // Process 3 REITs per run to stay within free tier (250 req/day)
const LOOKBACK_YEARS = 10; // Fetch up to 10 years of quarterly data

async function backfillQuarterlyData() {
  console.log('📊 Starting progressive quarterly data backfill...\n');
  console.log(`Processing ${REITS_PER_RUN} REITs with ${LOOKBACK_YEARS}Y lookback\n`);

  // Get backfill progress from database (or start fresh)
  const progress = await getBackfillProgress();
  const startIndex = progress.lastProcessedIndex + 1;

  let processed = 0;
  for (let i = startIndex; i < REITS_TO_BACKFILL.length && processed < REITS_PER_RUN; i++) {
    const ticker = REITS_TO_BACKFILL[i];

    console.log(`\n[${i + 1}/${REITS_TO_BACKFILL.length}] Processing ${ticker}...`);

    try {
      // This will check DB first, only fetch missing quarters
      const fundamentals = await FMPService.getQuarterlyFundamentals(ticker, LOOKBACK_YEARS);

      console.log(`✓ ${ticker}: ${fundamentals.length} quarters available in database`);

      // Update progress
      await updateBackfillProgress(i, ticker);

      processed++;

      // Rate limiting between REITs
      if (processed < REITS_PER_RUN) {
        console.log('Waiting 5 seconds before next REIT...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error: any) {
      console.error(`❌ Failed to process ${ticker}:`, error.message);
      // Continue with next REIT even if one fails
    }
  }

  // Check if we've completed the full cycle
  if (startIndex + processed >= REITS_TO_BACKFILL.length) {
    console.log('\n🎉 Completed full backfill cycle! Resetting for next run...');
    await resetBackfillProgress();
  }

  console.log(`\n✅ Backfill complete. Processed ${processed} REITs this run.`);
  console.log(`Progress: ${Math.min(startIndex + processed, REITS_TO_BACKFILL.length)}/${REITS_TO_BACKFILL.length} REITs`);
}

/**
 * Track backfill progress in a simple metadata table
 */
async function getBackfillProgress() {
  const { data } = await supabase
    .from('backfill_progress')
    .select('*')
    .eq('task_name', 'quarterly_fundamentals')
    .maybeSingle();

  if (!data) {
    // Initialize if first run
    await supabase.from('backfill_progress').insert({
      task_name: 'quarterly_fundamentals',
      last_processed_index: -1,
      last_processed_ticker: null,
      last_run_at: new Date().toISOString()
    });

    return { lastProcessedIndex: -1, lastProcessedTicker: null };
  }

  return {
    lastProcessedIndex: data.last_processed_index,
    lastProcessedTicker: data.last_processed_ticker
  };
}

async function updateBackfillProgress(index: number, ticker: string) {
  await supabase
    .from('backfill_progress')
    .update({
      last_processed_index: index,
      last_processed_ticker: ticker,
      last_run_at: new Date().toISOString()
    })
    .eq('task_name', 'quarterly_fundamentals');
}

async function resetBackfillProgress() {
  await supabase
    .from('backfill_progress')
    .update({
      last_processed_index: -1,
      last_processed_ticker: null,
      last_run_at: new Date().toISOString()
    })
    .eq('task_name', 'quarterly_fundamentals');
}

// Run if called directly
if (require.main === module) {
  backfillQuarterlyData()
    .then(() => {
      console.log('\n✓ Backfill script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Backfill script failed:', error);
      process.exit(1);
    });
}

export { backfillQuarterlyData };
