import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearAndReseedReturns() {
  console.log('🌱 Clearing and reseeding historical returns...\n');

  // Delete existing returns
  await supabase.from('historical_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // More realistic annualized returns (%)
  const returns = [
    // AVB - AvalonBay (Residential REIT)
    { ticker: 'AVB', period: '1Y', total: -2.5, yield: 3.2, growth: 2.1, valuation: -7.8 },
    { ticker: 'AVB', period: '3Y', total: 8.2, yield: 3.3, growth: 4.5, valuation: 0.4 },
    { ticker: 'AVB', period: '5Y', total: 6.8, yield: 3.4, growth: 4.2, valuation: -0.8 },
    
    // EQR - Equity Residential
    { ticker: 'EQR', period: '1Y', total: -3.1, yield: 3.4, growth: 1.8, valuation: -8.3 },
    { ticker: 'EQR', period: '3Y', total: 7.5, yield: 3.5, growth: 4.2, valuation: -0.2 },
    { ticker: 'EQR', period: '5Y', total: 6.2, yield: 3.6, growth: 4.0, valuation: -1.4 },
    
    // PLD - Prologis (Industrial REIT - higher performing)
    { ticker: 'PLD', period: '1Y', total: 8.5, yield: 2.4, growth: 5.2, valuation: 0.9 },
    { ticker: 'PLD', period: '3Y', total: 15.2, yield: 2.3, growth: 6.8, valuation: 6.1 },
    { ticker: 'PLD', period: '5Y', total: 12.8, yield: 2.2, growth: 6.5, valuation: 4.1 }
  ];

  let successCount = 0;
  
  for (const ret of returns) {
    const { data: reit } = await supabase.from('reits').select('id').eq('ticker', ret.ticker).single();
    
    if (reit) {
      const { error } = await supabase.from('historical_returns').insert({
        reit_id: reit.id,
        as_of_date: new Date().toISOString().split('T')[0],
        period: ret.period,
        total_return: ret.total,
        dividend_yield_contribution: ret.yield,
        affo_growth_contribution: ret.growth,
        multiple_rerating_contribution: ret.valuation
      });
      
      if (!error) {
        console.log(`  ✅ ${ret.ticker} ${ret.period}: ${ret.total}% (Yield: ${ret.yield}% + Growth: ${ret.growth}% + Valuation: ${ret.valuation}%)`);
        successCount++;
      } else {
        console.error(`  ❌ Failed ${ret.ticker} ${ret.period}:`, error.message);
      }
    }
  }
  
  console.log(`\n✅ Reseeded ${successCount}/${returns.length} historical return records!`);
  console.log('\n📊 Returns are now more realistic annualized figures');
}

clearAndReseedReturns().catch((error) => {
  console.error('❌ Reseeding failed:', error);
  process.exit(1);
});
