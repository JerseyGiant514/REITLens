import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { REIT_SETUP_DATA } from '../services/reitRegistry';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * REIT Master Data Setup
 * Ensures all REITs are properly configured in the database.
 *
 * REIT list sourced from: services/reitRegistry.ts (single source of truth)
 */

async function setupREITs() {
  console.log('Setting up REIT master data...\n');

  let created = 0;
  let updated = 0;

  for (const reit of REIT_SETUP_DATA) {
    try {
      // Check if REIT exists
      const { data: existing } = await supabase
        .from('reits')
        .select('id, ticker')
        .eq('ticker', reit.ticker)
        .maybeSingle();

      if (existing) {
        // Update existing - only update CIK if missing
        const { error } = await supabase
          .from('reits')
          .update({
            cik: reit.cik
          })
          .eq('ticker', reit.ticker);

        if (error) {
          console.error(`[ERROR] ${reit.ticker}: Update failed -`, error.message);
        } else {
          console.log(`[OK] ${reit.ticker}: Updated CIK`);
          updated++;
        }
      } else {
        // Create new - use only basic fields
        const { error } = await supabase
          .from('reits')
          .insert({
            ticker: reit.ticker,
            name: reit.name,
            cik: reit.cik
          });

        if (error) {
          console.error(`[ERROR] ${reit.ticker}: Insert failed -`, error.message);
        } else {
          console.log(`[OK] ${reit.ticker}: Created`);
          created++;
        }
      }
    } catch (error: any) {
      console.error(`[ERROR] ${reit.ticker}: Failed -`, error.message);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Failed: ${REIT_SETUP_DATA.length - created - updated}`);
  console.log(`\nREIT setup complete!`);
}

// Run
setupREITs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
