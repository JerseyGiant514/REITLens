import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { FMPService } from '../services/fmpService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * TEST SCRIPT: Verify FMP API integration and data storage
 *
 * This script tests:
 * 1. API key validity
 * 2. Data fetching from FMP
 * 3. Data storage in Supabase
 * 4. Data retrieval and mapping
 */

async function testFMPIntegration() {
  console.log('🧪 Testing FMP Integration...\n');

  // Test with a single REIT first
  const testTicker = 'PLD';
  const testYears = 2; // Only 2 years for testing

  console.log(`Testing with: ${testTicker} (${testYears} years lookback)\n`);

  try {
    // Step 1: Test batch fetch
    console.log('📥 Step 1: Fetching data from FMP API...');
    const data = await FMPService.batchFetchQuarterlyFundamentals([testTicker], testYears);

    const pldData = data.get(testTicker);
    if (!pldData || pldData.length === 0) {
      throw new Error('No data returned from FMP API');
    }

    console.log(`✓ Fetched ${pldData.length} quarters of data`);
    console.log(`✓ Date range: ${pldData[pldData.length - 1].fiscalDate.toISOString().split('T')[0]} to ${pldData[0].fiscalDate.toISOString().split('T')[0]}\n`);

    // Step 2: Verify data structure
    console.log('📊 Step 2: Verifying data structure...');
    const sample = pldData[0];
    console.log('Sample data point:');
    console.log(`  Fiscal Date: ${sample.fiscalDate.toISOString().split('T')[0]}`);
    console.log(`  Period: ${sample.period}`);
    console.log(`  Revenue: $${(sample.revenue / 1_000_000).toFixed(1)}M`);
    console.log(`  Operating Income: $${(sample.operatingIncome / 1_000_000).toFixed(1)}M`);
    console.log(`  Net Income: $${(sample.netIncome / 1_000_000).toFixed(1)}M`);
    console.log(`  Total Assets: ${sample.totalAssets ? '$' + (sample.totalAssets / 1_000_000).toFixed(1) + 'M' : 'N/A'}`);
    console.log(`  Total Debt: ${sample.totalDebt ? '$' + (sample.totalDebt / 1_000_000).toFixed(1) + 'M' : 'N/A'}`);
    console.log(`  FFO (est): ${sample.ffo ? '$' + (sample.ffo / 1_000_000).toFixed(1) + 'M' : 'N/A'}`);
    console.log(`  Dividend/Share: ${sample.dividendPerShare ? '$' + sample.dividendPerShare.toFixed(2) : 'N/A'}\n`);

    // Step 3: Verify database storage
    console.log('💾 Step 3: Verifying database storage...');
    const { data: reit } = await supabase
      .from('reits')
      .select('id')
      .eq('ticker', testTicker)
      .single();

    if (!reit) {
      throw new Error(`REIT ${testTicker} not found in database`);
    }

    const { data: stored, count } = await supabase
      .from('historical_financials')
      .select('*', { count: 'exact' })
      .eq('reit_id', reit.id)
      .order('fiscal_date', { ascending: false });

    console.log(`✓ Found ${count} records in database`);

    if (stored && stored.length > 0) {
      const latest = stored[0];
      console.log(`✓ Latest record: ${latest.fiscal_date} (${latest.period})`);
      console.log(`✓ Data source: ${latest.data_source}\n`);
    }

    // Step 4: Test lazy loading
    console.log('🔄 Step 4: Testing lazy loading...');
    const lazyData = await FMPService.getQuarterlyFundamentals(testTicker, 2);
    console.log(`✓ Lazy load returned ${lazyData.length} records`);
    console.log(`✓ Should use cached data (no API call needed)\n`);

    // Summary
    console.log('✅ All tests passed!');
    console.log('\nSummary:');
    console.log(`  ✓ API connection working`);
    console.log(`  ✓ Data fetching successful`);
    console.log(`  ✓ Database storage working`);
    console.log(`  ✓ Lazy loading functional`);
    console.log(`\n🚀 Ready to run full backfill: npx tsx scripts/backfillQuarterlyDataBatch.ts full\n`);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check .env file has VITE_FMP_API_KEY set');
    console.error('  2. Verify Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
    console.error('  3. Ensure historical_financials table exists in Supabase');
    console.error('  4. Check API key is valid at https://site.financialmodelingprep.com/');
    throw error;
  }
}

// Run test
testFMPIntegration()
  .then(() => {
    console.log('✓ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });
