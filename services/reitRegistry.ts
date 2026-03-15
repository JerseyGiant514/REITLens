/**
 * REIT Registry - Single Source of Truth
 *
 * This file is the CANONICAL registry for all REIT metadata.
 * Every file in the project that needs REIT data (mockData.ts, scripts, services)
 * MUST import from here. Do NOT define REIT lists anywhere else.
 *
 * CIK values verified against SEC EDGAR (March 2026).
 * Shares outstanding in millions; nominal price in USD.
 *
 * To add a new REIT:
 *   1. Add an entry to REIT_REGISTRY below with verified CIK from SEC EDGAR
 *   2. Add its institutional profile to INSTITUTIONAL_PROFILES
 *   3. Run `npx tsx scripts/setupREITs.ts` to sync to database
 *   4. Run `npx tsx scripts/backfillEDGARData.ts full` to backfill financials
 */

import { REIT, Sector } from '../types';

// ============================================================================
// CANONICAL REIT REGISTRY
// ============================================================================

export interface REITRegistryEntry {
  id: string;
  ticker: string;
  cik: string;            // SEC Central Index Key (unpadded)
  cikPadded: string;      // 10-digit zero-padded CIK for SEC EDGAR URLs
  name: string;
  sector: Sector;
  propertyType: string;
  isActive: boolean;
  sharesOutstanding: number;  // in millions
  nominalPrice: number;       // approximate price in USD
  description: string;
}

const REIT_REGISTRY: REITRegistryEntry[] = [
  // ── Industrial ──────────────────────────────────────────────
  {
    id: '1', ticker: 'PLD', cik: '1045609', cikPadded: '0001045609',
    name: 'Prologis, Inc.', sector: Sector.INDUSTRIAL, propertyType: 'Logistics',
    isActive: true, sharesOutstanding: 925, nominalPrice: 132,
    description: 'Global leader in logistics real estate'
  },
  {
    id: '26', ticker: 'REXR', cik: '1571283', cikPadded: '0001571283',
    name: 'Rexford Industrial Realty', sector: Sector.INDUSTRIAL, propertyType: 'Logistics',
    isActive: true, sharesOutstanding: 215, nominalPrice: 42,
    description: 'Southern California industrial REIT'
  },

  // ── Residential ─────────────────────────────────────────────
  {
    id: '2', ticker: 'EQR', cik: '906107', cikPadded: '0000906107',
    name: 'Equity Residential', sector: Sector.RESIDENTIAL, propertyType: 'Apartments',
    isActive: true, sharesOutstanding: 378, nominalPrice: 63,
    description: 'Multifamily apartment REIT'
  },
  {
    id: '8', ticker: 'AVB', cik: '915912', cikPadded: '0000915912',
    name: 'AvalonBay Communities', sector: Sector.RESIDENTIAL, propertyType: 'Apartments',
    isActive: true, sharesOutstanding: 142, nominalPrice: 178,
    description: 'High-quality multifamily communities'
  },
  {
    id: '30', ticker: 'ESS', cik: '920522', cikPadded: '0000920522',
    name: 'Essex Property Trust', sector: Sector.RESIDENTIAL, propertyType: 'Apartments',
    isActive: true, sharesOutstanding: 64, nominalPrice: 255,
    description: 'West Coast multifamily REIT'
  },
  {
    id: '32', ticker: 'MAA', cik: '912595', cikPadded: '0000912595',
    name: 'Mid-America Apartment Communities', sector: Sector.RESIDENTIAL, propertyType: 'Apartments',
    isActive: true, sharesOutstanding: 117, nominalPrice: 132,
    description: 'Sunbelt multifamily apartments'
  },

  // ── Retail ──────────────────────────────────────────────────
  {
    id: '3', ticker: 'O', cik: '726728', cikPadded: '0000726728',
    name: 'Realty Income Corp', sector: Sector.RETAIL, propertyType: 'Triple Net',
    isActive: true, sharesOutstanding: 870, nominalPrice: 67,
    description: 'The Monthly Dividend Company'
  },
  {
    id: '12', ticker: 'SPG', cik: '1063761', cikPadded: '0001063761',
    name: 'Simon Property Group', sector: Sector.RETAIL, propertyType: 'Malls',
    isActive: true, sharesOutstanding: 326, nominalPrice: 203,
    description: 'Premier shopping mall REIT'
  },

  // ── Office ──────────────────────────────────────────────────
  {
    id: '19', ticker: 'BXP', cik: '1037540', cikPadded: '0001037540',
    name: 'BXP Inc.', sector: Sector.OFFICE, propertyType: 'Office',
    isActive: true, sharesOutstanding: 157, nominalPrice: 53,
    description: 'Premier office REIT (formerly Boston Properties)'
  },
  {
    id: '40', ticker: 'VNO', cik: '899689', cikPadded: '0000899689',
    name: 'Vornado Realty Trust', sector: Sector.OFFICE, propertyType: 'Office',
    isActive: true, sharesOutstanding: 191, nominalPrice: 40,
    description: 'NYC office and retail REIT'
  },

  // ── Single Family Rental ────────────────────────────────────
  {
    id: '41', ticker: 'INVH', cik: '1687229', cikPadded: '0001687229',
    name: 'Invitation Homes Inc.', sector: Sector.SFR, propertyType: 'Single Family Rental',
    isActive: true, sharesOutstanding: 612, nominalPrice: 27,
    description: 'Single-family rental homes'
  },
  {
    id: '42', ticker: 'AMH', cik: '1562401', cikPadded: '0001562401',
    name: 'American Homes 4 Rent', sector: Sector.SFR, propertyType: 'Single Family Rental',
    isActive: true, sharesOutstanding: 365, nominalPrice: 31,
    description: 'Single-family rental homes'
  },

  // ── Self-Storage ────────────────────────────────────────────
  {
    id: '43', ticker: 'PSA', cik: '1393311', cikPadded: '0001393311',
    name: 'Public Storage', sector: Sector.SELF_STORAGE, propertyType: 'Self-Storage',
    isActive: true, sharesOutstanding: 176, nominalPrice: 300,
    description: 'Largest self-storage REIT'
  },
  {
    id: '44', ticker: 'EXR', cik: '1289490', cikPadded: '0001289490',
    name: 'Extra Space Storage', sector: Sector.SELF_STORAGE, propertyType: 'Self-Storage',
    isActive: true, sharesOutstanding: 134, nominalPrice: 151,
    description: 'Self-storage facilities'
  },
  {
    id: '45', ticker: 'CUBE', cik: '1298675', cikPadded: '0001298675',
    name: 'CubeSmart', sector: Sector.SELF_STORAGE, propertyType: 'Self-Storage',
    isActive: true, sharesOutstanding: 222, nominalPrice: 41,
    description: 'Self-storage operator'
  },

  // ── Lodging ─────────────────────────────────────────────────
  {
    id: '46', ticker: 'HST', cik: '1070750', cikPadded: '0001070750',
    name: 'Host Hotels & Resorts', sector: Sector.LODGING, propertyType: 'Hotels',
    isActive: true, sharesOutstanding: 708, nominalPrice: 20,
    description: 'Luxury hotels and resorts'
  },
  {
    id: '47', ticker: 'RHP', cik: '1364479', cikPadded: '0001364479',
    name: 'Ryman Hospitality Properties', sector: Sector.LODGING, propertyType: 'Hotels',
    isActive: true, sharesOutstanding: 55, nominalPrice: 103,
    description: 'Convention hotels and entertainment'
  },
];

// ============================================================================
// INSTITUTIONAL PROFILES
// These are calibrated analytical assumptions per ticker.
// They are NOT mock data - they are analytical parameters for return decomposition.
// ============================================================================

export interface InstitutionalProfile {
  baselineCapRate: number;        // Estimated cap rate
  targetLTV: number;              // Target loan-to-value ratio
  operatingMargin: number;        // NOI / Revenue
  growthAlpha: number;            // Organic growth premium over baseline
  acqVolumePct: number;           // Acquisitions as % of GAV
  acqSpreadBps: number;           // Acquisition spread over WACC (bps)
  devPipelinePct: number;         // Development pipeline as % of GAV
  ytcSpreadBps: number;           // Yield-on-cost spread over cap rate (bps)
  recurringCapexIntensity: number; // Recurring capex as % of NOI
  straightLineRentPct: number;    // Straight-line rent as % of revenue
  gaExpensePct: number;           // G&A expense as % of revenue
  dividendYield: number;          // Estimated dividend yield
}

export const INSTITUTIONAL_PROFILES: Record<string, InstitutionalProfile> = {
  'PLD': {
    baselineCapRate: 0.046, targetLTV: 0.26, operatingMargin: 0.74, growthAlpha: 1.3,
    acqVolumePct: 0.04, acqSpreadBps: 120, devPipelinePct: 0.08, ytcSpreadBps: 180,
    recurringCapexIntensity: 0.08, straightLineRentPct: 0.02, gaExpensePct: 0.03, dividendYield: 0.029
  },
  'REXR': {
    baselineCapRate: 0.043, targetLTV: 0.22, operatingMargin: 0.75, growthAlpha: 1.6,
    acqVolumePct: 0.06, acqSpreadBps: 140, devPipelinePct: 0.04, ytcSpreadBps: 150,
    recurringCapexIntensity: 0.07, straightLineRentPct: 0.015, gaExpensePct: 0.04, dividendYield: 0.027
  },
  'EQR': {
    baselineCapRate: 0.050, targetLTV: 0.30, operatingMargin: 0.70, growthAlpha: 0.8,
    acqVolumePct: 0.02, acqSpreadBps: 80, devPipelinePct: 0.03, ytcSpreadBps: 120,
    recurringCapexIntensity: 0.12, straightLineRentPct: 0.01, gaExpensePct: 0.05, dividendYield: 0.038
  },
  'AVB': {
    baselineCapRate: 0.048, targetLTV: 0.28, operatingMargin: 0.70, growthAlpha: 1.0,
    acqVolumePct: 0.03, acqSpreadBps: 90, devPipelinePct: 0.04, ytcSpreadBps: 130,
    recurringCapexIntensity: 0.11, straightLineRentPct: 0.01, gaExpensePct: 0.05, dividendYield: 0.035
  },
  'ESS': {
    baselineCapRate: 0.0485, targetLTV: 0.30, operatingMargin: 0.69, growthAlpha: 1.1,
    acqVolumePct: 0.02, acqSpreadBps: 80, devPipelinePct: 0.03, ytcSpreadBps: 120,
    recurringCapexIntensity: 0.12, straightLineRentPct: 0.005, gaExpensePct: 0.05, dividendYield: 0.032
  },
  'MAA': {
    baselineCapRate: 0.052, targetLTV: 0.30, operatingMargin: 0.70, growthAlpha: 0.9,
    acqVolumePct: 0.03, acqSpreadBps: 90, devPipelinePct: 0.03, ytcSpreadBps: 130,
    recurringCapexIntensity: 0.10, straightLineRentPct: 0.01, gaExpensePct: 0.05, dividendYield: 0.038
  },
  'O': {
    baselineCapRate: 0.067, targetLTV: 0.37, operatingMargin: 0.93, growthAlpha: 0.4,
    acqVolumePct: 0.08, acqSpreadBps: 110, devPipelinePct: 0.005, ytcSpreadBps: 100,
    recurringCapexIntensity: 0.02, straightLineRentPct: 0.002, gaExpensePct: 0.02, dividendYield: 0.054
  },
  'SPG': {
    baselineCapRate: 0.075, targetLTV: 0.44, operatingMargin: 0.65, growthAlpha: 0.5,
    acqVolumePct: 0.01, acqSpreadBps: 50, devPipelinePct: 0.02, ytcSpreadBps: 250,
    recurringCapexIntensity: 0.18, straightLineRentPct: 0.01, gaExpensePct: 0.04, dividendYield: 0.062
  },
  'BXP': {
    baselineCapRate: 0.089, targetLTV: 0.49, operatingMargin: 0.61, growthAlpha: -0.4,
    acqVolumePct: 0.01, acqSpreadBps: 20, devPipelinePct: 0.05, ytcSpreadBps: 150,
    recurringCapexIntensity: 0.22, straightLineRentPct: 0.03, gaExpensePct: 0.07, dividendYield: 0.071
  },
  'VNO': {
    baselineCapRate: 0.082, targetLTV: 0.45, operatingMargin: 0.60, growthAlpha: -0.3,
    acqVolumePct: 0.01, acqSpreadBps: 30, devPipelinePct: 0.02, ytcSpreadBps: 120,
    recurringCapexIntensity: 0.20, straightLineRentPct: 0.02, gaExpensePct: 0.07, dividendYield: 0.065
  },
  'INVH': {
    baselineCapRate: 0.052, targetLTV: 0.35, operatingMargin: 0.65, growthAlpha: 1.2,
    acqVolumePct: 0.05, acqSpreadBps: 100, devPipelinePct: 0.02, ytcSpreadBps: 150,
    recurringCapexIntensity: 0.10, straightLineRentPct: 0.005, gaExpensePct: 0.05, dividendYield: 0.031
  },
  'AMH': {
    baselineCapRate: 0.053, targetLTV: 0.32, operatingMargin: 0.64, growthAlpha: 1.4,
    acqVolumePct: 0.04, acqSpreadBps: 110, devPipelinePct: 0.05, ytcSpreadBps: 180,
    recurringCapexIntensity: 0.09, straightLineRentPct: 0.005, gaExpensePct: 0.05, dividendYield: 0.033
  },
  'PSA': {
    baselineCapRate: 0.045, targetLTV: 0.28, operatingMargin: 0.72, growthAlpha: 0.8,
    acqVolumePct: 0.02, acqSpreadBps: 90, devPipelinePct: 0.01, ytcSpreadBps: 140,
    recurringCapexIntensity: 0.05, straightLineRentPct: 0.001, gaExpensePct: 0.03, dividendYield: 0.042
  },
  'EXR': {
    baselineCapRate: 0.047, targetLTV: 0.32, operatingMargin: 0.70, growthAlpha: 1.0,
    acqVolumePct: 0.03, acqSpreadBps: 100, devPipelinePct: 0.02, ytcSpreadBps: 150,
    recurringCapexIntensity: 0.06, straightLineRentPct: 0.001, gaExpensePct: 0.04, dividendYield: 0.039
  },
  'CUBE': {
    baselineCapRate: 0.049, targetLTV: 0.35, operatingMargin: 0.68, growthAlpha: 1.1,
    acqVolumePct: 0.04, acqSpreadBps: 110, devPipelinePct: 0.03, ytcSpreadBps: 160,
    recurringCapexIntensity: 0.07, straightLineRentPct: 0.002, gaExpensePct: 0.04, dividendYield: 0.045
  },
  'HST': {
    baselineCapRate: 0.078, targetLTV: 0.42, operatingMargin: 0.58, growthAlpha: 0.3,
    acqVolumePct: 0.02, acqSpreadBps: 60, devPipelinePct: 0.01, ytcSpreadBps: 180,
    recurringCapexIntensity: 0.20, straightLineRentPct: 0.0, gaExpensePct: 0.06, dividendYield: 0.055
  },
  'RHP': {
    baselineCapRate: 0.072, targetLTV: 0.38, operatingMargin: 0.60, growthAlpha: 0.6,
    acqVolumePct: 0.01, acqSpreadBps: 70, devPipelinePct: 0.02, ytcSpreadBps: 200,
    recurringCapexIntensity: 0.18, straightLineRentPct: 0.0, gaExpensePct: 0.05, dividendYield: 0.048
  },
};

export const DEFAULT_PROFILE: InstitutionalProfile = {
  baselineCapRate: 0.060, targetLTV: 0.35, operatingMargin: 0.65, growthAlpha: 1.0,
  acqVolumePct: 0.03, acqSpreadBps: 100, devPipelinePct: 0.03, ytcSpreadBps: 150,
  recurringCapexIntensity: 0.10, straightLineRentPct: 0.01, gaExpensePct: 0.05, dividendYield: 0.042
};

// ============================================================================
// DERIVED EXPORTS (consumed by other modules)
// ============================================================================

/**
 * REITS array conforming to the REIT interface from types.ts.
 * This is the single source that mockData.ts re-exports.
 */
export const REITS: REIT[] = REIT_REGISTRY.map(entry => ({
  id: entry.id,
  ticker: entry.ticker,
  cik: entry.cikPadded,
  name: entry.name,
  sector: entry.sector,
  propertyType: entry.propertyType,
  isActive: entry.isActive,
  sharesOutstanding: entry.sharesOutstanding,
  nominalPrice: entry.nominalPrice,
}));

/**
 * CIK map for SEC EDGAR scripts. Uses unpadded CIK values.
 */
export const REIT_CIK_MAP: Array<{ ticker: string; cik: string; name: string }> =
  REIT_REGISTRY.map(entry => ({
    ticker: entry.ticker,
    cik: entry.cik,
    name: entry.name,
  }));

/**
 * Setup data for the setupREITs script (database seeding).
 */
export const REIT_SETUP_DATA: Array<{
  ticker: string; name: string; sector: string; cik: string; description: string;
}> = REIT_REGISTRY.map(entry => ({
  ticker: entry.ticker,
  name: entry.name,
  sector: entry.sector as string,
  cik: entry.cik,
  description: entry.description,
}));

/**
 * Full registry entries with all metadata.
 */
export const FULL_REGISTRY: readonly REITRegistryEntry[] = REIT_REGISTRY;

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

/** Get a REIT by ticker */
export function getREITByTicker(ticker: string): REIT | undefined {
  return REITS.find(r => r.ticker === ticker);
}

/** Get a registry entry by ticker (includes description, unpadded CIK) */
export function getRegistryEntry(ticker: string): REITRegistryEntry | undefined {
  return REIT_REGISTRY.find(r => r.ticker === ticker);
}

/** Get institutional profile for a ticker, with default fallback */
export function getInstitutionalProfile(ticker: string): InstitutionalProfile {
  return INSTITUTIONAL_PROFILES[ticker] || DEFAULT_PROFILE;
}

/** Get all unique sectors represented in the registry */
export function getRegistrySectors(): Sector[] {
  return [...new Set(REIT_REGISTRY.map(r => r.sector))];
}

/** Get all tickers */
export function getAllTickers(): string[] {
  return REIT_REGISTRY.map(r => r.ticker);
}

/**
 * Update the nominal price for a ticker in the registry.
 * Mutates both REIT_REGISTRY and the derived REITS array so all
 * downstream consumers (mock data, market cap calculations, etc.)
 * pick up the live price immediately.
 */
export function updateNominalPrice(ticker: string, price: number): void {
  const entry = REIT_REGISTRY.find(r => r.ticker === ticker);
  if (entry) {
    entry.nominalPrice = price;
  }
  const reit = REITS.find(r => r.ticker === ticker);
  if (reit) {
    reit.nominalPrice = price;
  }
}
