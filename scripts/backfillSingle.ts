import * as dotenv from 'dotenv';
dotenv.config();
import { EDGARService } from '../services/edgarService';

const ticker = process.argv[2] || 'BXP';
const cik = process.argv[3] || '1037540';
const years = parseInt(process.argv[4] || '10');

console.log(`Backfilling ${ticker} (CIK: ${cik}, ${years}Y)...\n`);

EDGARService.fetchAndStoreQuarterlyData(ticker, cik, years)
  .then(quarters => {
    console.log(`\nDone! ${quarters.length} quarters stored.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
