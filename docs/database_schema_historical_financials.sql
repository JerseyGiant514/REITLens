-- Historical Financials Table
-- Stores financial data fetched from SEC EDGAR (and optionally FMP)
-- Comprehensive quarterly data with room for monthly expansion

CREATE TABLE IF NOT EXISTS historical_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reit_id UUID REFERENCES reits(id) ON DELETE CASCADE,

  -- Period Information
  fiscal_date DATE NOT NULL,
  period VARCHAR(10) NOT NULL,       -- "Q1", "Q2", "Q3", "Q4", "FY"
  fiscal_year INTEGER NOT NULL,
  calendar_year INTEGER NOT NULL,
  calendar_quarter INTEGER NOT NULL,  -- 1, 2, 3, or 4

  -- Core Financials (from Income Statement)
  revenue DECIMAL(15, 2),
  operating_income DECIMAL(15, 2),
  net_income DECIMAL(15, 2),

  -- REIT-Specific Metrics
  ffo DECIMAL(15, 2),
  affo DECIMAL(15, 2),
  noi DECIMAL(15, 2),
  same_store_noi_growth DECIMAL(8, 4),

  -- Property Metrics
  properties_owned INTEGER,
  square_feet DECIMAL(15, 2),
  occupancy_rate DECIMAL(5, 4),

  -- Capital Allocation
  acquisitions_volume DECIMAL(15, 2),
  dispositions_volume DECIMAL(15, 2),
  development_spending DECIMAL(15, 2),
  capex DECIMAL(15, 2),

  -- Balance Sheet
  total_assets DECIMAL(15, 2),
  total_debt DECIMAL(15, 2),
  total_equity DECIMAL(15, 2),

  -- Per Share Metrics
  ffo_per_share DECIMAL(10, 4),
  affo_per_share DECIMAL(10, 4),
  dividend_per_share DECIMAL(10, 4),

  -- Data Source Metadata
  data_source VARCHAR(50) DEFAULT 'EDGAR',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(reit_id, fiscal_date, period),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_historical_financials_reit_date
  ON historical_financials(reit_id, fiscal_date DESC);

CREATE INDEX IF NOT EXISTS idx_historical_financials_calendar
  ON historical_financials(calendar_year, calendar_quarter);

-- Enable RLS
ALTER TABLE historical_financials ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access" ON historical_financials
  FOR SELECT USING (true);

-- Allow insert/update for authenticated users
CREATE POLICY "Allow insert access" ON historical_financials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access" ON historical_financials
  FOR UPDATE USING (true);

COMMENT ON TABLE historical_financials IS 'Historical financial data for REITs, backfilled from SEC EDGAR';
