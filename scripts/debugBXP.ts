import * as dotenv from 'dotenv';
dotenv.config();

async function debugBXP() {
  // BXP Inc parent entity (not the LP)
  const url = 'https://data.sec.gov/api/xbrl/companyfacts/CIK0001037540.json';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'REITLens Analytics admin@reitlens.com' }
  });
  const data = await res.json();
  const gaap = data.facts['us-gaap'];

  console.log('Entity:', data.entityName);
  console.log('\nRevenue-related fields with recent 10-Q data:\n');

  Object.keys(gaap).forEach(k => {
    const usd = gaap[k]?.units?.USD;
    if (usd) {
      const recent = usd.filter((f: any) => f.form === '10-Q' && f.end > '2023-01-01');
      if (recent.length >= 3 && (
        k.toLowerCase().includes('revenue') ||
        k.toLowerCase().includes('rent') ||
        k.toLowerCase().includes('income') && !k.includes('Tax') && !k.includes('Comprehensive')
      )) {
        console.log(`${k}: ${recent.length} recent quarters`);
        const last = recent[recent.length - 1];
        console.log(`  Latest: ${last.end} = $${(last.val / 1e6).toFixed(1)}M\n`);
      }
    }
  });

  process.exit(0);
}

debugBXP();
