
export enum Sector {
  RESIDENTIAL = 'Residential',
  INDUSTRIAL = 'Industrial',
  RETAIL = 'Retail',
  OFFICE = 'Office',
  DATA_CENTERS = 'Data Centers',
  HEALTHCARE = 'Healthcare',
  TOWERS = 'Towers',
  SFR = 'Single Family Rental',
  SELF_STORAGE = 'Self-Storage',
  LODGING = 'Lodging'
}

export interface REIT {
  id: string;
  ticker: string;
  cik: string;
  name: string;
  sector: Sector;
  propertyType: string;
  isActive: boolean;
  sharesOutstanding: number;
  nominalPrice: number;
}

export interface PortfolioHolding {
  ticker: string;
  weight: number;
}

export interface Portfolio {
  id: string;
  name: string;
  holdings: PortfolioHolding[];
}

export interface MarketDaily {
  date: string;
  reitId: string;
  closePrice: number;
  marketCap: number;
  dividendYield: number;
}

export interface FinancialsQuarterly {
  periodEndDate: string;
  reitId: string;
  revenue: number;
  netIncome: number;
  operatingCashFlow: number;
  totalAssets: number;
  totalDebt: number;
  equity: number;
  dilutedShares: number;
  dividendsPaid: number;
  noi: number; // GAAP NOI
  ffo: number; // Funds From Operations
  straightLineRent: number;
  maintenanceCapex: number;
  growthCapex: number;
  gaExpense: number;
  ebitdare: number;
  interestExpense: number;
}

export interface GrowthDecomposition {
  ssNoi: number;
  acquisitionAccretion: number;
  devAlpha: number;
  structuralLeakage: number; // Recurring Capex / G&A drag
  capImpact: number; // Accretion/Dilution from share count/debt refi
  netAffoGrowth: number;
}

export interface REITKPIs {
  periodEndDate: string;
  reitId: string;
  sameStoreNOIGrowth: number;
  occupancy: number;
  leasingSpread: number;
  walt: number;
  growthDecomp?: GrowthDecomposition;
  cashNoiGrowth: number;
  gaToGav: number;
  interestCoverage: number;
  payoutAffo: number;
}

export interface DebtMaturity {
  year: number;
  reitId: string;
  amount: number;
}

export interface MacroDaily {
  date: string;
  seriesId: string;
  value: number;
  seriesName: string;
}

export interface HistoricalLookback {
  period: '1Y' | '3Y' | '5Y' | '10Y';
  median: number;
  low: number;
  high: number;
  p25: number;
  p75: number;
}

export interface ExpectationsData {
  impliedG: number;
  historicalG: HistoricalLookback[];
  impliedCapRate: number;
  historicalCapRate: HistoricalLookback[];
  multiple: number;
  historicalMultiple: HistoricalLookback[];
}

export type Page = 'dashboard' | 'valuation' | 'operations' | 'balance-sheet' | 'sector-lens' | 'macro' | 'watchlist' | 'data-guide' | 'return-decomposition' | 'portfolio-manager' | 'justified-paffo' | 'relative-value' | 'nav-sensitivity' | 'analyst-memo' | 'analyst-perspectives' | 'expert-knowledge' | 'correlation-matrix' | 'peer-comp' | 'nav-model' | 'dividend-safety' | 'earnings-calendar' | 'forward-affo' | 'debt-stress' | 'mgmt-scorecard' | 'screener' | 'pnav-history' | 'volatility' | 'tenant-lease' | 'geo-exposure' | 'consensus' | 'alerts';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
