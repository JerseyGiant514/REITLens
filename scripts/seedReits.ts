import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

const REITS_DATA = [
  { id: '1', ticker: 'PLD', cik: '0001045609', name: 'Prologis, Inc.', sector: 'Industrial', propertyType: 'Logistics', isActive: true },
  { id: '26', ticker: 'REXR', cik: '0001571283', name: 'Rexford Industrial Realty', sector: 'Industrial', propertyType: 'Logistics', isActive: true },
  { id: '2', ticker: 'EQR', cik: '0000906107', name: 'Equity Residential', sector: 'Residential', propertyType: 'Apartments', isActive: true },
  { id: '8', ticker: 'AVB', cik: '0000915913', name: 'AvalonBay Communities', sector: 'Residential', propertyType: 'Apartments', isActive: true },
  { id: '30', ticker: 'ESS', cik: '0000920522', name: 'Essex Property Trust', sector: 'Residential', propertyType: 'Apartments', isActive: true },
  { id: '32', ticker: 'MAA', cik: '0000912595', name: 'Mid-America Apartment', sector: 'Residential', propertyType: 'Apartments', isActive: true },
  { id: '3', ticker: 'O', cik: '0000884394', name: 'Realty Income Corp', sector: 'Retail', propertyType: 'Triple Net', isActive: true },
  { id: '12', ticker: 'SPG', cik: '0001063761', name: 'Simon Property Group', sector: 'Retail', propertyType: 'Malls', isActive: true },
  { id: '19', ticker: 'BXP', cik: '0001039684', name: 'Boston Properties', sector: 'Office', propertyType: 'Office', isActive: true },
  { id: '40', ticker: 'VNO', cik: '0000899689', name: 'Vornado Realty Trust', sector: 'Office', propertyType: 'Office', isActive: true },
  { id: '41', ticker: 'INVH', cik: '0001687229', name: 'Invitation Homes Inc.', sector: 'Single Family Rental', propertyType: 'Single Family Rental', isActive: true },
  { id: '42', ticker: 'AMH', cik: '0001562401', name: 'American Homes 4 Rent', sector: 'Single Family Rental', propertyType: 'Single Family Rental', isActive: true },
  { id: '43', ticker: 'PSA', cik: '0001393311', name: 'Public Storage', sector: 'Self-Storage', propertyType: 'Self-Storage', isActive: true },
  { id: '44', ticker: 'EXR', cik: '0001289490', name: 'Extra Space Storage', sector: 'Self-Storage', propertyType: 'Self-Storage', isActive: true },
  { id: '45', ticker: 'CUBE', cik: '0001394803', name: 'CubeSmart', sector: 'Self-Storage', propertyType: 'Self-Storage', isActive: true },
  { id: '46', ticker: 'HST', cik: '0001070750', name: 'Host Hotels & Resorts', sector: 'Lodging', propertyType: 'Hotels', isActive: true },
  { id: '47', ticker: 'RHP', cik: '0001122304', name: 'Ryman Hospitality Properties', sector: 'Lodging', propertyType: 'Hotels', isActive: true },
];

async function seedReits() {
  console.log('📊 Seeding REITs table with all 17 REITs...\n');

  for (const reit of REITS_DATA) {
    const { data, error } = await supabase
      .from('reits')
      .upsert({
        ticker: reit.ticker,
        cik: reit.cik,
        name: reit.name,
        sector: reit.sector,
        property_type: reit.propertyType,
        is_active: reit.isActive
      }, {
        onConflict: 'ticker'
      });

    if (error) {
      console.error(`❌ Failed to insert ${reit.ticker}:`, error.message);
    } else {
      console.log(`✅ ${reit.ticker} - ${reit.name}`);
    }
  }

  console.log('\n✅ All REITs seeded successfully!');
}

seedReits().catch(console.error);
