-- Backfill Progress Tracking Table
-- Tracks progress of progressive data backfilling to avoid duplicate API calls

CREATE TABLE IF NOT EXISTS backfill_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_name VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'quarterly_fundamentals', 'monthly_returns'
  last_processed_index INTEGER DEFAULT -1,
  last_processed_ticker VARCHAR(10),
  last_run_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize with quarterly_fundamentals task
INSERT INTO backfill_progress (task_name, last_processed_index, last_processed_ticker)
VALUES ('quarterly_fundamentals', -1, NULL)
ON CONFLICT (task_name) DO NOTHING;

COMMENT ON TABLE backfill_progress IS 'Tracks progress of progressive backfilling tasks to stay within API rate limits';
