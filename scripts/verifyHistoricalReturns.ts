import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function verifyHistoricalReturns() {
  console.log('🔍 Verifying historical returns data in Supabase...\n');

  // Check if historical_returns table exists and has data
  const { data: allReturns, error: allError, count } = await supabase
    .from('historical_returns')
    .select('*', { count: 'exact' })
    .limit(100);

  if (allError) {
    console.error('❌ Error querying historical_returns:', allError.message);
    return;
  }

  console.log(`📊 Total records in historical_returns table: ${count || 0}\n`);

  if (!allReturns || allReturns.length === 0) {
    console.log('⚠️  No historical returns data found in database!');
    console.log('💡 Run: npx tsx scripts/calculateRealReturns.ts to populate the data\n');
    return;
  }

  // Group by ticker
  const { data: reits } = await supabase.from('reits').select('id, ticker, name');

  if (!reits) {
    console.error('❌ Could not fetch REITs from database');
    return;
  }

  console.log('📈 Historical Returns by REIT:\n');
  console.log('=' .repeat(80));

  for (const reit of reits) {
    const { data: returns, error } = await supabase
      .from('historical_returns')
      .select('*')
      .eq('reit_id', reit.id)
      .order('period');

    if (error) {
      console.error(`❌ Error for ${reit.ticker}:`, error.message);
      continue;
    }

    if (!returns || returns.length === 0) {
      console.log(`${reit.ticker.padEnd(6)} (${reit.name}): ⚠️  NO DATA`);
      continue;
    }

    console.log(`\n${reit.ticker.padEnd(6)} (${reit.name}):`);
    for (const ret of returns) {
      const total = parseFloat(ret.total_return);
      const yld = parseFloat(ret.dividend_yield_contribution);
      const growth = parseFloat(ret.affo_growth_contribution);
      const valuation = parseFloat(ret.multiple_rerating_contribution);

      console.log(`  ${ret.period}: Total ${total.toFixed(1)}% = Yield ${yld.toFixed(1)}% + Growth ${growth.toFixed(1)}% + Valuation ${valuation.toFixed(1)}%`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Verification complete!');
  console.log(`📊 Found data for ${reits.length} REITs\n`);

  // Show most recent update
  const { data: recent } = await supabase
    .from('historical_returns')
    .select('as_of_date')
    .order('as_of_date', { ascending: false })
    .limit(1)
    .single();

  if (recent) {
    console.log(`📅 Most recent data as of: ${recent.as_of_date}\n`);
  }
}

verifyHistoricalReturns().catch(console.error);
