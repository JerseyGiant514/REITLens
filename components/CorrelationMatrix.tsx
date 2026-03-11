/**
 * CorrelationMatrix.tsx
 * Interactive heatmap visualization of pairwise REIT correlations
 * with factor exposure table and portfolio statistics
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, TrendingUp, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';
import { Portfolio } from '../types';
import { REITS } from '../services/mockData';
import { InfoTooltip } from './InfoTooltip';
import ExportButton from './ExportButton';
import TickerLink from './TickerLink';
import {
  CorrelationAnalysis,
  FactorExposure,
  PortfolioStats,
  runCorrelationAnalysis,
  getCorrelationColor,
  getCorrelationTextColor,
  FACTOR_DEFS,
} from '../services/correlationService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CorrelationMatrixProps {
  portfolio: Portfolio | null;
  ticker?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const HeatmapCell: React.FC<{
  value: number;
  ticker1: string;
  ticker2: string;
  isDiagonal: boolean;
  isHovered: boolean;
  onHover: (ticker1: string, ticker2: string) => void;
  onLeave: () => void;
}> = ({ value, ticker1, ticker2, isDiagonal, isHovered, onHover, onLeave }) => {
  return (
    <div
      className={`relative flex items-center justify-center transition-all duration-150 cursor-crosshair ${
        isDiagonal ? 'rounded' : 'rounded-sm'
      } ${isHovered ? 'ring-1 ring-white/40 z-10 scale-110' : ''}`}
      style={{
        backgroundColor: isDiagonal ? 'rgba(255, 157, 60, 0.15)' : getCorrelationColor(value),
        color: isDiagonal ? '#FF9D3C' : getCorrelationTextColor(value),
        minHeight: '44px',
      }}
      onMouseEnter={() => onHover(ticker1, ticker2)}
      onMouseLeave={onLeave}
    >
      <span className={`font-black mono ${isDiagonal ? 'text-[10px]' : 'text-[11px]'}`}>
        {isDiagonal ? '1.00' : value.toFixed(2)}
      </span>

      {/* Hover tooltip */}
      {isHovered && !isDiagonal && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-12 left-1/2 -translate-x-1/2 bg-obsidian border border-white/20 rounded-lg px-3 py-1.5 shadow-xl z-50 whitespace-nowrap"
        >
          <span className="text-[9px] text-white font-bold">
            {ticker1} / {ticker2}:{' '}
            <span className={value > 0.5 ? 'text-lightBlue' : value < -0.2 ? 'text-rose-400' : 'text-rain'}>
              {value.toFixed(4)}
            </span>
          </span>
          <div className="text-[7px] text-rain mt-0.5">
            {value > 0.7 ? 'Highly correlated' :
             value > 0.4 ? 'Moderately correlated' :
             value > 0 ? 'Weakly correlated' :
             value > -0.3 ? 'Uncorrelated' :
             'Negatively correlated'}
          </div>
        </motion.div>
      )}
    </div>
  );
};

const FactorExposureRow: React.FC<{
  ticker: string;
  exposures: FactorExposure[];
}> = ({ ticker, exposures }) => {
  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="py-2 px-3 text-[10px] font-black uppercase tracking-wider">
        <TickerLink
          ticker={ticker}
          className="text-[10px] font-black text-white hover:text-lightBlue underline decoration-dotted cursor-pointer transition-colors uppercase tracking-wider"
        />
      </td>
      {exposures.map((exp) => (
        <React.Fragment key={exp.factorTicker}>
          <td className="py-2 px-2 text-center">
            <span className={`text-[10px] font-black mono ${
              Math.abs(exp.beta) > 1.2 ? 'text-pumpkin' :
              Math.abs(exp.beta) < 0.5 ? 'text-rain' : 'text-white'
            }`}>
              {exp.beta.toFixed(2)}
            </span>
          </td>
          <td className="py-2 px-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, exp.rSquared * 100)}%`,
                    backgroundColor: exp.rSquared > 0.5 ? '#38bdf8' : exp.rSquared > 0.2 ? '#FF9D3C' : '#64748b',
                  }}
                />
              </div>
              <span className="text-[8px] text-rain mono">{(exp.rSquared * 100).toFixed(0)}%</span>
            </div>
          </td>
        </React.Fragment>
      ))}
    </tr>
  );
};

const PortfolioStatsPanel: React.FC<{
  stats: PortfolioStats;
}> = ({ stats }) => {
  const statItems = [
    {
      label: 'Portfolio Vol',
      value: `${(stats.portfolioVol * 100).toFixed(1)}%`,
      sublabel: 'Annualized',
      color: 'text-lightBlue',
    },
    {
      label: 'Sharpe Ratio',
      value: stats.sharpeRatio.toFixed(2),
      sublabel: 'Rf = 4.0%',
      color: stats.sharpeRatio > 0.5 ? 'text-emerald-400' : 'text-pumpkin',
    },
    {
      label: 'Diversification',
      value: `${stats.diversificationRatio.toFixed(2)}x`,
      sublabel: 'Wtd Vol / Port Vol',
      color: stats.diversificationRatio > 1.1 ? 'text-emerald-400' : 'text-rain',
    },
    {
      label: 'Max Drawdown',
      value: `${(stats.maxDrawdown * 100).toFixed(1)}%`,
      sublabel: 'Period',
      color: 'text-rose-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <div key={item.label} className="aegis-card p-4 text-center">
          <span className="text-[8px] text-rain uppercase font-bold tracking-widest block">{item.label}</span>
          <span className={`text-lg font-black mono ${item.color} block mt-1`}>{item.value}</span>
          <span className="text-[7px] text-rain/60 block mt-0.5">{item.sublabel}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ portfolio, ticker }) => {
  const [analysis, setAnalysis] = useState<CorrelationAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ t1: string; t2: string } | null>(null);
  const [lookbackDays, setLookbackDays] = useState<number>(365);

  // Determine tickers and weights
  const { tickers, weights } = useMemo(() => {
    if (portfolio && portfolio.holdings.length >= 2) {
      return {
        tickers: portfolio.holdings.map(h => h.ticker),
        weights: portfolio.holdings.map(h => h.weight / 100),
      };
    }

    // If no portfolio, use sector peers
    const selectedReit = REITS.find(r => r.ticker === (ticker || 'PLD'));
    if (selectedReit) {
      const sectorPeers = REITS.filter(r => r.sector === selectedReit.sector).slice(0, 6);
      const equalWeight = 1 / sectorPeers.length;
      return {
        tickers: sectorPeers.map(r => r.ticker),
        weights: sectorPeers.map(() => equalWeight),
      };
    }

    return { tickers: [], weights: [] };
  }, [portfolio, ticker]);

  // Fetch correlation data
  const fetchAnalysis = useCallback(async () => {
    if (tickers.length < 2) {
      setError('Need at least 2 holdings for correlation analysis');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await runCorrelationAnalysis(tickers, weights, lookbackDays);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch correlation data');
    } finally {
      setIsLoading(false);
    }
  }, [tickers, weights, lookbackDays]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Export data preparation
  const exportData = useMemo(() => {
    if (!analysis) return [];

    const { correlationMatrix: cm } = analysis;
    const rows: Record<string, any>[] = [];

    for (let i = 0; i < cm.tickers.length; i++) {
      const row: Record<string, any> = { Ticker: cm.tickers[i] };
      for (let j = 0; j < cm.tickers.length; j++) {
        row[cm.tickers[j]] = cm.matrix[i][j].toFixed(4);
      }
      rows.push(row);
    }

    return rows;
  }, [analysis]);

  // Lookback options
  const lookbackOptions = [
    { label: '90D', days: 90 },
    { label: '180D', days: 180 },
    { label: '1Y', days: 365 },
    { label: '2Y', days: 730 },
    { label: '3Y', days: 1095 },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────

  if (tickers.length < 2) {
    return (
      <div className="aegis-card p-10 text-center">
        <AlertTriangle className="w-8 h-8 text-pumpkin mx-auto mb-4" />
        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">
          Portfolio Required
        </h3>
        <p className="text-[10px] text-rain uppercase tracking-widest">
          Build a portfolio with 2+ holdings in Portfolio Manager to view correlation analytics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700" id="correlation-analysis">
      {/* Header */}
      <header className="aegis-card gold-braiding p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="header-institutional text-xl font-black text-white tracking-institutional uppercase">
            Correlation & Factor Analysis
          </h2>
          <p className="text-[10px] text-rain uppercase tracking-[0.3em] mt-1.5">
            {portfolio ? portfolio.name : 'Sector Peers'} |{' '}
            {tickers.length} Holdings | Pearson Pairwise Correlation
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Lookback Period Selector */}
          <div className="flex gap-1">
            {lookbackOptions.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setLookbackDays(opt.days)}
                className={`px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider rounded transition-all ${
                  lookbackDays === opt.days
                    ? 'bg-lightBlue/20 text-lightBlue border border-lightBlue/40'
                    : 'text-rain hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchAnalysis}
            disabled={isLoading}
            className="p-2 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 text-rain hover:text-white transition-all disabled:opacity-50"
            title="Refresh analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Export */}
          <ExportButton
            data={exportData}
            filename={`correlation_matrix_${portfolio?.name || ticker || 'analysis'}`}
            title="Correlation Matrix"
            pdfElementId="correlation-analysis"
            compact
          />
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="aegis-card p-12 text-center">
          <div className="w-10 h-10 border-4 border-lightBlue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] text-rain uppercase tracking-widest animate-pulse">
            Fetching {tickers.length} price series & computing correlations...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="aegis-card p-6 border-rose-500/30 bg-rose-500/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">{error}</span>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !isLoading && (
        <>
          {/* Portfolio Stats */}
          {analysis.portfolioStats && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-lightBlue" />
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                  Portfolio Risk Statistics
                </h3>
                <InfoTooltip content="Annualized risk statistics computed from daily returns over the selected lookback period." />
              </div>
              <PortfolioStatsPanel stats={analysis.portfolioStats} />
            </div>
          )}

          {/* Correlation Heatmap */}
          <div className="aegis-card p-8">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-4 h-4 text-gold" />
              <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                Pairwise Correlation Heatmap
              </h3>
              <InfoTooltip content="Pearson correlation coefficient between daily returns of each pair. Values range from -1 (perfect inverse) to +1 (perfect co-movement)." />
            </div>

            {/* Color Legend */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-[8px] text-rose-400 font-bold uppercase">-1.0 Inverse</span>
              <div className="flex gap-0.5">
                {[-1, -0.7, -0.4, -0.1, 0.1, 0.4, 0.7, 1].map(v => (
                  <div
                    key={v}
                    className="w-6 h-3 rounded-sm"
                    style={{ backgroundColor: getCorrelationColor(v) }}
                  />
                ))}
              </div>
              <span className="text-[8px] text-lightBlue font-bold uppercase">+1.0 Correlated</span>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
              <div
                className="grid gap-1 mx-auto"
                style={{
                  gridTemplateColumns: `60px repeat(${analysis.correlationMatrix.tickers.length}, 1fr)`,
                  maxWidth: `${60 + analysis.correlationMatrix.tickers.length * 70}px`,
                }}
              >
                {/* Empty top-left corner */}
                <div />

                {/* Column headers */}
                {analysis.correlationMatrix.tickers.map((t) => (
                  <div key={`col-${t}`} className="text-center py-2">
                    <TickerLink
                      ticker={t}
                      className={`text-[9px] font-black uppercase tracking-wider underline decoration-dotted cursor-pointer transition-colors ${
                        hoveredCell?.t1 === t || hoveredCell?.t2 === t ? 'text-white' : 'text-rain hover:text-white'
                      }`}
                    />
                  </div>
                ))}

                {/* Rows */}
                {analysis.correlationMatrix.tickers.map((rowTicker, i) => (
                  <React.Fragment key={`row-${rowTicker}`}>
                    {/* Row header */}
                    <div className="flex items-center justify-end pr-2">
                      <TickerLink
                        ticker={rowTicker}
                        className={`text-[9px] font-black uppercase tracking-wider underline decoration-dotted cursor-pointer transition-colors ${
                          hoveredCell?.t1 === rowTicker || hoveredCell?.t2 === rowTicker ? 'text-white' : 'text-rain hover:text-white'
                        }`}
                      />
                    </div>

                    {/* Data cells */}
                    {analysis.correlationMatrix.tickers.map((colTicker, j) => (
                      <HeatmapCell
                        key={`${rowTicker}-${colTicker}`}
                        value={analysis.correlationMatrix.matrix[i][j]}
                        ticker1={rowTicker}
                        ticker2={colTicker}
                        isDiagonal={i === j}
                        isHovered={
                          (hoveredCell?.t1 === rowTicker && hoveredCell?.t2 === colTicker) ||
                          (hoveredCell?.t1 === colTicker && hoveredCell?.t2 === rowTicker)
                        }
                        onHover={(t1, t2) => setHoveredCell({ t1, t2 })}
                        onLeave={() => setHoveredCell(null)}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Notable Pairs */}
            {analysis.correlationMatrix.pairwise.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                {/* Highest Correlation */}
                {(() => {
                  const sorted = [...analysis.correlationMatrix.pairwise].sort((a, b) => b.correlation - a.correlation);
                  const highest = sorted[0];
                  const lowest = sorted[sorted.length - 1];
                  const median = sorted[Math.floor(sorted.length / 2)];
                  return (
                    <>
                      <div className="p-4 bg-lightBlue/5 border border-lightBlue/20 rounded">
                        <span className="text-[8px] text-lightBlue uppercase font-black tracking-widest block">Most Correlated</span>
                        <span className="text-[12px] text-white font-black mono block mt-1">
                          {highest.ticker1}/{highest.ticker2}: {highest.correlation.toFixed(3)}
                        </span>
                      </div>
                      <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded">
                        <span className="text-[8px] text-rose-400 uppercase font-black tracking-widest block">Least Correlated</span>
                        <span className="text-[12px] text-white font-black mono block mt-1">
                          {lowest.ticker1}/{lowest.ticker2}: {lowest.correlation.toFixed(3)}
                        </span>
                      </div>
                      <div className="p-4 bg-pumpkin/5 border border-pumpkin/20 rounded">
                        <span className="text-[8px] text-pumpkin uppercase font-black tracking-widest block">Median Correlation</span>
                        <span className="text-[12px] text-white font-black mono block mt-1">
                          {median.ticker1}/{median.ticker2}: {median.correlation.toFixed(3)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Factor Exposure Table */}
          {analysis.factorExposures.size > 0 && (
            <div className="aegis-card p-8">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-pumpkin" />
                <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">
                  Factor Exposure Analysis
                </h3>
                <InfoTooltip content="OLS regression betas showing each holding's sensitivity to broad market factors. Beta > 1 means amplified sensitivity, < 1 means dampened." />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gold/20">
                      <th className="py-2 px-3 text-left text-[8px] font-black text-gold uppercase tracking-widest">
                        Holding
                      </th>
                      {FACTOR_DEFS.map((factor) => (
                        <React.Fragment key={factor.ticker}>
                          <th className="py-2 px-2 text-center text-[8px] font-black text-rain uppercase tracking-widest" colSpan={1}>
                            {factor.name.split(' (')[0]} Beta
                          </th>
                          <th className="py-2 px-2 text-center text-[8px] font-black text-rain uppercase tracking-widest" colSpan={1}>
                            R^2
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(analysis.factorExposures.entries()).map(([holdingTicker, exposures]) => (
                      <FactorExposureRow
                        key={holdingTicker}
                        ticker={holdingTicker}
                        exposures={exposures}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Factor Legend */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/5">
                {FACTOR_DEFS.map((factor) => (
                  <div key={factor.ticker} className="flex items-start gap-2">
                    <div className="w-1 h-8 bg-lightBlue/30 rounded flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[9px] font-bold text-white block">{factor.name}</span>
                      <span className="text-[7px] text-rain block">{factor.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Methodology Note */}
          <div className="aegis-card p-6 bg-darkBlue/20 border-rain/10">
            <h4 className="text-[9px] font-black text-rain uppercase tracking-[0.3em] mb-3">Methodology</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[8px] text-slate-500">
              <div>
                <span className="text-slate-400 font-bold block mb-1">Correlation</span>
                <p>Pearson correlation coefficient computed on daily log-returns (adjusted close). Window: {lookbackDays} calendar days. Minimum 20 overlapping observations required.</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold block mb-1">Factor Model</span>
                <p>Single-factor OLS regression against each benchmark. Beta measures return sensitivity, R-squared measures explanatory power. Residual vol captures idiosyncratic risk.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CorrelationMatrix;
