-- Quarterly Fundamentals Table
-- Stores quarterly financial data fetched from Financial Modeling Prep API
-- Progressive backfilling strategy: fetch on-demand and persist

CREATE TABLE IF NOT EXISTS quarterly_fundamentals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reit_id UUID REFERENCES reits(id) ON DELETE CASCADE,

  -- Period Information
  fiscal_date DATE NOT NULL,  -- Quarter end date (e.g., 2024-03-31)
  period VARCHAR(10) NOT NULL,  -- e.g., "Q1", "Q2", "Q3", "Q4"
  fiscal_year INTEGER NOT NULL,
  calendar_year INTEGER NOT NULL,
  calendar_quarter INTEGER NOT NULL,  -- 1, 2, 3, or 4

  -- Core Financials
  revenue DECIMAL(15, 2),
  operating_income DECIMAL(15, 2),
  net_income DECIMAL(15, 2),

  -- REIT-Specific Metrics
  ffo DECIMAL(15, 2),  -- Funds From Operations
  affo DECIMAL(15, 2),  -- Adjusted Funds From Operations
  noi DECIMAL(15, 2),  -- Net Operating Income
  same_store_noi_growth DECIMAL(8, 4),  -- % growth

  -- Property Metrics
  properties_owned INTEGER,
  square_feet DECIMAL(15, 2),
  occupancy_rate DECIMAL(5, 4),  -- as decimal (0.95 = 95%)

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
  data_source VARCHAR(50) DEFAULT 'FMP',  -- 'FMP', 'EDGAR', 'Manual', etc.
  fetched_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(reit_id, fiscal_date, period),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quarterly_fundamentals_reit_date
  ON quarterly_fundamentals(reit_id, fiscal_date DESC);

CREATE INDEX IF NOT EXISTS idx_quarterly_fundamentals_calendar
  ON quarterly_fundamentals(calendar_year, calendar_quarter);

-- Comments
COMMENT ON TABLE quarterly_fundamentals IS 'Quarterly financial fundamentals for REITs, progressively backfilled from FMP API';
COMMENT ON COLUMN quarterly_fundamentals.same_store_noi_growth IS 'Year-over-year same-store NOI growth rate';
COMMENT ON COLUMN quarterly_fundamentals.occupancy_rate IS 'Portfolio-wide occupancy rate as decimal (0.95 = 95%)';
