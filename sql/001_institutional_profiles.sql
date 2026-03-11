-- ============================================================================
-- Migration 001: Institutional Profiles Table + Historical Financials FFO Fields
--
-- Part of REITLens V1.0 Institutional Upgrade
-- Items 9 (FFO/AFFO) and 11 (Profiles to DB)
--
-- Run this migration in the Supabase SQL Editor before running:
--   npx tsx scripts/seedProfiles.ts
--   npx tsx scripts/backfillEDGARData.ts full
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REIT PROFILES TABLE (Item 11)
--    Stores institutional analytical parameters per ticker.
--    These are calibrated assumptions used for return decomposition,
--    NOT mock data.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reit_profiles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker          TEXT NOT NULL UNIQUE,

  -- Cap Rate & Leverage
  baseline_cap_rate       NUMERIC(6,4) NOT NULL DEFAULT 0.060,   -- e.g., 0.046
  target_ltv              NUMERIC(6,4) NOT NULL DEFAULT 0.35,    -- e.g., 0.26

  -- Operating Metrics
  operating_margin        NUMERIC(6,4) NOT NULL DEFAULT 0.65,    -- NOI / Revenue
  ga_expense_pct          NUMERIC(6,4) NOT NULL DEFAULT 0.05,    -- G&A / Revenue
  straight_line_rent_pct  NUMERIC(6,4) NOT NULL DEFAULT 0.01,    -- SLR / Revenue
  dividend_yield          NUMERIC(6,4) NOT NULL DEFAULT 0.042,   -- Expected div yield

  -- Growth Assumptions
  growth_alpha            NUMERIC(6,2) NOT NULL DEFAULT 1.0,     -- Organic growth premium
  acq_volume_pct          NUMERIC(6,4) NOT NULL DEFAULT 0.03,    -- Acquisitions as % of GAV
  acq_spread_bps          NUMERIC(8,2) NOT NULL DEFAULT 100,     -- Acq spread over WACC (bps)
  dev_pipeline_pct        NUMERIC(6,4) NOT NULL DEFAULT 0.03,    -- Dev pipeline as % of GAV
  ytc_spread_bps          NUMERIC(8,2) NOT NULL DEFAULT 150,     -- Yield-on-cost spread (bps)

  -- Capital Intensity
  recurring_capex_intensity NUMERIC(6,4) NOT NULL DEFAULT 0.10,  -- Recurring capex as % of NOI

  -- Metadata
  source_notes    TEXT,                                           -- Attribution for values
  version         INTEGER NOT NULL DEFAULT 1,                    -- Profile version number
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reit_profiles_ticker ON reit_profiles(ticker);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_reit_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reit_profiles_updated_at ON reit_profiles;
CREATE TRIGGER trg_reit_profiles_updated_at
  BEFORE UPDATE ON reit_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_reit_profiles_updated_at();

-- Enable RLS (Row Level Security) but allow authenticated reads
ALTER TABLE reit_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow public read access to reit_profiles"
  ON reit_profiles FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated insert to reit_profiles"
  ON reit_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated update to reit_profiles"
  ON reit_profiles FOR UPDATE
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ADD FFO-RELATED COLUMNS TO historical_financials (Item 9)
--    These new columns store data extracted from SEC EDGAR XBRL.
-- ─────────────────────────────────────────────────────────────────────────────

-- Depreciation & Amortization (for real FFO: Net Income + D&A - Gains)
ALTER TABLE historical_financials
  ADD COLUMN IF NOT EXISTS depreciation_amortization NUMERIC;

-- Gain/Loss on Property Sales (excluded from FFO per NAREIT definition)
ALTER TABLE historical_financials
  ADD COLUMN IF NOT EXISTS gain_loss_on_sales NUMERIC;

-- Actual Interest Expense from XBRL (replaces hardcoded 4.5% estimate)
ALTER TABLE historical_financials
  ADD COLUMN IF NOT EXISTS interest_expense NUMERIC;

-- Dividends per share declared (for real dividend yield computation)
ALTER TABLE historical_financials
  ADD COLUMN IF NOT EXISTS dividends_per_share NUMERIC;

-- Pre-computed FFO = Net Income + D&A - Gains on Sales
ALTER TABLE historical_financials
  ADD COLUMN IF NOT EXISTS ffo NUMERIC;

-- Pre-computed AFFO = FFO - Maintenance CapEx
ALTER TABLE historical_financials
  ADD COLUMN IF NOT EXISTS affo NUMERIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PROFILE AUDIT LOG (optional - for tracking profile changes)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reit_profile_audit (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker      TEXT NOT NULL,
  field_name  TEXT NOT NULL,
  old_value   NUMERIC,
  new_value   NUMERIC,
  changed_by  TEXT DEFAULT 'system',
  changed_at  TIMESTAMPTZ DEFAULT NOW(),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_reit_profile_audit_ticker
  ON reit_profile_audit(ticker, changed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────────
-- After running this migration, verify with:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'reit_profiles' ORDER BY ordinal_position;
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'historical_financials' AND column_name IN
--   ('depreciation_amortization','gain_loss_on_sales','interest_expense',
--    'dividends_per_share','ffo','affo');
