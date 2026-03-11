import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  INSTITUTIONAL_PROFILES,
  DEFAULT_PROFILE,
  getAllTickers,
  InstitutionalProfile,
} from '../services/reitRegistry';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

/**
 * Seed Institutional Profiles to Database
 *
 * Reads profiles from reitRegistry.ts (single source of truth)
 * and upserts them into the reit_profiles table.
 *
 * Prerequisites:
 *   Run sql/001_institutional_profiles.sql first to create the table.
 *
 * Usage:
 *   npx tsx scripts/seedProfiles.ts           # Upsert all profiles
 *   npx tsx scripts/seedProfiles.ts verify     # Verify profiles in DB
 *   npx tsx scripts/seedProfiles.ts diff       # Show differences between code and DB
 */

async function seedProfiles() {
  console.log('Seeding institutional profiles to database...\n');

  const tickers = getAllTickers();
  let upserted = 0;
  let errors = 0;

  for (const ticker of tickers) {
    const profile = INSTITUTIONAL_PROFILES[ticker] || DEFAULT_PROFILE;

    try {
      const { error } = await supabase
        .from('reit_profiles')
        .upsert(
          {
            ticker,
            baseline_cap_rate: profile.baselineCapRate,
            target_ltv: profile.targetLTV,
            operating_margin: profile.operatingMargin,
            ga_expense_pct: profile.gaExpensePct,
            straight_line_rent_pct: profile.straightLineRentPct,
            dividend_yield: profile.dividendYield,
            growth_alpha: profile.growthAlpha,
            acq_volume_pct: profile.acqVolumePct,
            acq_spread_bps: profile.acqSpreadBps,
            dev_pipeline_pct: profile.devPipelinePct,
            ytc_spread_bps: profile.ytcSpreadBps,
            recurring_capex_intensity: profile.recurringCapexIntensity,
            source_notes: 'Seeded from reitRegistry.ts (institutional upgrade)',
            version: 1,
          },
          { onConflict: 'ticker' }
        );

      if (error) {
        console.error(`[ERROR] ${ticker}: ${error.message}`);
        errors++;
      } else {
        console.log(`[OK] ${ticker}: Upserted (capRate=${profile.baselineCapRate}, margin=${profile.operatingMargin}, yield=${profile.dividendYield})`);
        upserted++;
      }
    } catch (e: any) {
      console.error(`[ERROR] ${ticker}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Upserted: ${upserted}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total: ${tickers.length}`);
  console.log(`\nProfile seeding complete!`);
}

async function verifyProfiles() {
  console.log('Verifying institutional profiles in database...\n');

  const { data, error } = await supabase
    .from('reit_profiles')
    .select('ticker, baseline_cap_rate, operating_margin, dividend_yield, growth_alpha, version, updated_at')
    .order('ticker');

  if (error) {
    console.error('Failed to query reit_profiles:', error.message);
    console.log('\nHave you run sql/001_institutional_profiles.sql yet?');
    return;
  }

  if (!data || data.length === 0) {
    console.log('No profiles found in database.');
    console.log('Run: npx tsx scripts/seedProfiles.ts');
    return;
  }

  console.log('Profiles in database:\n');
  console.log('Ticker  CapRate  Margin  Yield   Alpha  Ver  Updated');
  console.log('------  -------  ------  ------  -----  ---  -------');
  for (const row of data) {
    const updated = row.updated_at ? new Date(row.updated_at).toISOString().split('T')[0] : 'N/A';
    console.log(
      `${row.ticker.padEnd(8)}${(row.baseline_cap_rate * 100).toFixed(1).padStart(5)}%  ` +
      `${(row.operating_margin * 100).toFixed(0).padStart(4)}%  ` +
      `${(row.dividend_yield * 100).toFixed(1).padStart(5)}%  ` +
      `${row.growth_alpha.toFixed(1).padStart(5)}  ` +
      `${String(row.version).padStart(3)}  ${updated}`
    );
  }

  const tickers = getAllTickers();
  const dbTickers = new Set(data.map((r: any) => r.ticker));
  const missing = tickers.filter(t => !dbTickers.has(t));
  if (missing.length > 0) {
    console.log(`\nMissing from DB: ${missing.join(', ')}`);
  }

  console.log(`\nTotal: ${data.length} profiles in DB, ${tickers.length} in registry`);
}

async function diffProfiles() {
  console.log('Comparing code profiles vs database profiles...\n');

  const { data, error } = await supabase
    .from('reit_profiles')
    .select('*')
    .order('ticker');

  if (error) {
    console.error('Failed to query reit_profiles:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No profiles in database. Run seedProfiles first.');
    return;
  }

  let diffs = 0;
  const fieldMap: Array<{ dbField: string; codeField: keyof InstitutionalProfile }> = [
    { dbField: 'baseline_cap_rate', codeField: 'baselineCapRate' },
    { dbField: 'target_ltv', codeField: 'targetLTV' },
    { dbField: 'operating_margin', codeField: 'operatingMargin' },
    { dbField: 'ga_expense_pct', codeField: 'gaExpensePct' },
    { dbField: 'straight_line_rent_pct', codeField: 'straightLineRentPct' },
    { dbField: 'dividend_yield', codeField: 'dividendYield' },
    { dbField: 'growth_alpha', codeField: 'growthAlpha' },
    { dbField: 'acq_volume_pct', codeField: 'acqVolumePct' },
    { dbField: 'acq_spread_bps', codeField: 'acqSpreadBps' },
    { dbField: 'dev_pipeline_pct', codeField: 'devPipelinePct' },
    { dbField: 'ytc_spread_bps', codeField: 'ytcSpreadBps' },
    { dbField: 'recurring_capex_intensity', codeField: 'recurringCapexIntensity' },
  ];

  for (const row of data) {
    const codeProfile = INSTITUTIONAL_PROFILES[row.ticker] || DEFAULT_PROFILE;
    const tickerDiffs: string[] = [];

    for (const { dbField, codeField } of fieldMap) {
      const dbVal = Number(row[dbField]);
      const codeVal = Number(codeProfile[codeField]);
      if (Math.abs(dbVal - codeVal) > 0.0001) {
        tickerDiffs.push(`  ${codeField}: DB=${dbVal} vs Code=${codeVal}`);
        diffs++;
      }
    }

    if (tickerDiffs.length > 0) {
      console.log(`${row.ticker}:`);
      tickerDiffs.forEach(d => console.log(d));
    }
  }

  if (diffs === 0) {
    console.log('All profiles match between code and database.');
  } else {
    console.log(`\n${diffs} differences found.`);
    console.log('To sync code -> DB: npx tsx scripts/seedProfiles.ts');
  }
}

async function main() {
  const mode = process.argv[2] || 'seed';

  switch (mode) {
    case 'seed':
      await seedProfiles();
      break;
    case 'verify':
      await verifyProfiles();
      break;
    case 'diff':
      await diffProfiles();
      break;
    default:
      console.log('Usage: npx tsx scripts/seedProfiles.ts [seed|verify|diff]');
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
