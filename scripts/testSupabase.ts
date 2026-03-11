import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  console.log('URL:', process.env.VITE_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');

  const sb = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  try {
    const { data, error } = await sb.from('reits').select('ticker, id').limit(3);
    if (error) {
      console.error('Supabase error:', JSON.stringify(error));
    } else {
      console.log('Success! REITs found:', JSON.stringify(data));
    }
  } catch (e: any) {
    console.error('Caught error:', e.message);
  }

  // Test historical_financials table exists
  try {
    const { data, error } = await sb.from('historical_financials').select('id').limit(1);
    if (error) {
      console.error('historical_financials table error:', error.message);
    } else {
      console.log('historical_financials table exists, rows:', data?.length || 0);
    }
  } catch (e: any) {
    console.error('historical_financials error:', e.message);
  }

  process.exit(0);
}

test();
