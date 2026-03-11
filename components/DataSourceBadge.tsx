/**
 * DataSourceBadge - Inline badge showing data provenance for institutional transparency.
 *
 * Designed to be placed next to any data point to indicate whether the underlying
 * data comes from a verified source (SEC EDGAR, Yahoo Finance), a computed
 * derivation, a mock/estimated fallback, or an AI-generated insight.
 *
 * Usage:
 *   <DataSourceBadge source="SEC" />
 *   <DataSourceBadge source="Computed" confidence="medium" />
 *   <DataSourceBadge source="Mock" confidence="low" />
 *
 * Placement recommendations (see ARCHITECTURE.md for full guide):
 *   - Dashboard KPI cards: next to each value label
 *   - Charts: in the chart header area, next to the subtitle
 *   - Valuation metrics: beside each metric value
 *   - Portfolio holdings: next to price/weight data
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DataSource = 'SEC' | 'Yahoo' | 'Computed' | 'Mock' | 'AI';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

interface DataSourceBadgeProps {
  /** The provenance of the data. */
  source: DataSource;
  /** Optional confidence indicator. Defaults based on source if omitted. */
  confidence?: ConfidenceLevel;
  /** Additional CSS classes for positioning. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface SourceConfig {
  label: string;
  dotColor: string;
  tooltip: string;
  defaultConfidence: ConfidenceLevel;
}

const SOURCE_CONFIG: Record<DataSource, SourceConfig> = {
  SEC: {
    label: 'Verified',
    dotColor: '#10b981', // emerald-500
    tooltip: 'SEC EDGAR -- GAAP-compliant data sourced directly from regulatory filings (10-K, 10-Q).',
    defaultConfidence: 'high',
  },
  Yahoo: {
    label: 'Verified',
    dotColor: '#10b981', // emerald-500
    tooltip: 'Yahoo Finance -- EOD adjusted close prices and dividend data via the v8 API.',
    defaultConfidence: 'high',
  },
  Computed: {
    label: 'Derived',
    dotColor: '#d4af37', // gold
    tooltip: 'Computed -- Value derived from verified inputs using institutional models (e.g. implied cap rate, justified P/AFFO).',
    defaultConfidence: 'medium',
  },
  Mock: {
    label: 'Estimated',
    dotColor: '#f43f5e', // rose-500
    tooltip: 'Estimated -- Synthetic data generated from sector-calibrated models. Not sourced from live feeds.',
    defaultConfidence: 'low',
  },
  AI: {
    label: 'AI-Generated',
    dotColor: '#48A3CC', // lightBlue
    tooltip: 'AI-Generated -- Content produced by a large language model. May contain inaccuracies; verify independently.',
    defaultConfidence: 'medium',
  },
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({
  source,
  confidence,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = SOURCE_CONFIG[source];
  const resolvedConfidence = confidence ?? config.defaultConfidence;

  return (
    <div
      className={`relative inline-flex items-center gap-1 cursor-default select-none ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="status"
      aria-label={`Data source: ${source}. ${config.label}. ${CONFIDENCE_LABELS[resolvedConfidence]}.`}
    >
      {/* Dot indicator */}
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{
          backgroundColor: config.dotColor,
          boxShadow: `0 0 6px ${config.dotColor}40`,
        }}
        aria-hidden="true"
      />

      {/* Label */}
      <span
        className="text-[8px] font-bold uppercase tracking-widest"
        style={{ color: config.dotColor }}
      >
        {config.label}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[120] pointer-events-none"
          >
            <div className="w-64 p-3 bg-obsidian/95 border border-rain/30 rounded shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: config.dotColor }}
                />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  {source}
                </span>
                <span
                  className="ml-auto text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border"
                  style={{
                    color: config.dotColor,
                    borderColor: `${config.dotColor}40`,
                    backgroundColor: `${config.dotColor}10`,
                  }}
                >
                  {CONFIDENCE_LABELS[resolvedConfidence]}
                </span>
              </div>
              <p className="text-[9px] font-medium text-slate-400 leading-relaxed">
                {config.tooltip}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DataSourceBadge;
