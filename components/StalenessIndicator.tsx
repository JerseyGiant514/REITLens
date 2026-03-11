/**
 * StalenessIndicator Component
 *
 * Displays a small inline badge showing data freshness for institutional transparency.
 * Color-coded by staleness:
 *   - Green:  Data updated within maxAgeDays (fresh)
 *   - Yellow: Data is 1-2x maxAgeDays old (aging)
 *   - Red:    Data is >2x maxAgeDays old, or lastUpdated is null (stale / unknown)
 *
 * Shows a tooltip on hover with exact timestamp and data source.
 *
 * Props:
 *   lastUpdated: Date | null   -- The timestamp of the most recent data observation
 *   source: 'SEC' | 'Yahoo' | 'FRED' | 'Mock' | 'DB' | 'EDGAR' | 'Estimated'
 *   maxAgeDays?: number        -- Threshold for "fresh" (default: 90 for SEC, 1 for market data)
 */

import React, { useState, useRef, useEffect } from 'react';

export type DataSource = 'SEC' | 'Yahoo' | 'FRED' | 'Mock' | 'DB' | 'EDGAR' | 'Estimated';

export interface StalenessIndicatorProps {
  lastUpdated: Date | null;
  source: DataSource;
  maxAgeDays?: number;
  compact?: boolean; // If true, show only the dot with no text
}

// Default maxAge by source type
const DEFAULT_MAX_AGE_DAYS: Record<DataSource, number> = {
  SEC: 90,
  EDGAR: 90,
  DB: 90,
  Yahoo: 1,
  FRED: 1,
  Mock: 0,
  Estimated: 0,
};

// Source labels for display
const SOURCE_LABELS: Record<DataSource, string> = {
  SEC: 'SEC EDGAR',
  EDGAR: 'SEC EDGAR',
  DB: 'Database',
  Yahoo: 'Yahoo Finance',
  FRED: 'FRED API',
  Mock: 'Synthetic',
  Estimated: 'Estimated',
};

type FreshnessLevel = 'fresh' | 'aging' | 'stale';

function computeFreshness(
  lastUpdated: Date | null,
  maxAgeDays: number
): { level: FreshnessLevel; ageDays: number | null; label: string } {
  if (lastUpdated === null || maxAgeDays === 0) {
    return { level: 'stale', ageDays: null, label: 'No timestamp' };
  }

  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (ageDays <= maxAgeDays) {
    return {
      level: 'fresh',
      ageDays,
      label: ageDays === 0 ? 'Today' : ageDays === 1 ? '1 day ago' : `${ageDays}d ago`,
    };
  } else if (ageDays <= maxAgeDays * 2) {
    return {
      level: 'aging',
      ageDays,
      label: `${ageDays}d ago`,
    };
  } else {
    return {
      level: 'stale',
      ageDays,
      label: `${ageDays}d ago`,
    };
  }
}

const FRESHNESS_STYLES: Record<FreshnessLevel, { dot: string; text: string; border: string; bg: string }> = {
  fresh: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-400/80',
    border: 'border-emerald-400/20',
    bg: 'bg-emerald-400/5',
  },
  aging: {
    dot: 'bg-amber-400',
    text: 'text-amber-400/80',
    border: 'border-amber-400/20',
    bg: 'bg-amber-400/5',
  },
  stale: {
    dot: 'bg-rose-400',
    text: 'text-rose-400/80',
    border: 'border-rose-400/20',
    bg: 'bg-rose-400/5',
  },
};

export const StalenessIndicator: React.FC<StalenessIndicatorProps> = ({
  lastUpdated,
  source,
  maxAgeDays,
  compact = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveMaxAge = maxAgeDays ?? DEFAULT_MAX_AGE_DAYS[source] ?? 90;
  const { level, ageDays, label } = computeFreshness(lastUpdated, effectiveMaxAge);
  const styles = FRESHNESS_STYLES[level];
  const sourceLabel = SOURCE_LABELS[source] || source;

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTooltip]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <div
        className={`inline-flex items-center gap-1 ${
          compact ? '' : `px-1.5 py-0.5 rounded ${styles.bg} ${styles.border} border`
        } cursor-default`}
      >
        {/* Animated dot */}
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${styles.dot} ${
          level === 'fresh' ? 'animate-pulse' : ''
        }`} />

        {!compact && (
          <span className={`text-[7px] font-bold uppercase tracking-widest ${styles.text}`}>
            {source === 'Mock' || source === 'Estimated' ? source : label}
          </span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
        >
          <div className="bg-obsidian/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
            <div className="text-[8px] font-black text-white uppercase tracking-widest mb-1.5">
              Data Freshness
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[7px] text-slate-500 uppercase tracking-wider">Source</span>
                <span className={`text-[8px] font-bold ${styles.text}`}>{sourceLabel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[7px] text-slate-500 uppercase tracking-wider">Updated</span>
                <span className="text-[8px] font-bold text-slate-300">
                  {lastUpdated
                    ? lastUpdated.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[7px] text-slate-500 uppercase tracking-wider">Age</span>
                <span className={`text-[8px] font-bold ${styles.text}`}>
                  {ageDays !== null ? `${ageDays} days` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[7px] text-slate-500 uppercase tracking-wider">Status</span>
                <span className={`text-[8px] font-bold uppercase ${styles.text}`}>{level}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[7px] text-slate-500 uppercase tracking-wider">Max Age</span>
                <span className="text-[8px] font-bold text-slate-400">{effectiveMaxAge}d</span>
              </div>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-obsidian/95 border-r border-b border-white/10 transform rotate-45 -mt-1" />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compact data source badge for use in table cells and small spaces.
 */
export const DataSourceBadge: React.FC<{
  source: DataSource;
  lastUpdated?: Date | null;
}> = ({ source, lastUpdated }) => {
  return (
    <StalenessIndicator
      lastUpdated={lastUpdated ?? null}
      source={source}
      compact={true}
    />
  );
};

export default StalenessIndicator;
