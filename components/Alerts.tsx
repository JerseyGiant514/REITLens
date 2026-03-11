/**
 * Alerts.tsx
 * Custom Alerts / Watchlist Alerts — set price and valuation triggers
 * that highlight when conditions are met against current REIT data.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Bell, Trash2, Plus, ChevronDown, ChevronUp, Zap, ShieldAlert, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { REITS } from '../services/mockData';
import { getFinancials, getMarketDataSync } from '../services/dataService';
import { getInstitutionalProfile } from '../services/reitRegistry';
import { FinancialsQuarterly } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

type AlertMetric = 'price' | 'pAffo' | 'divYield' | 'navDiscount' | 'debtToAssets' | 'interestCoverage';
type AlertDirection = 'above' | 'below';

interface AlertRule {
  id: string;
  ticker: string; // ticker or 'ALL'
  metric: AlertMetric;
  direction: AlertDirection;
  threshold: number;
  createdAt: string; // ISO string for JSON serialization
}

interface AlertCheckResult {
  alert: AlertRule;
  triggered: boolean;
  currentValue: number;
  reitTicker: string;
  reitName: string;
  deviation: number; // how far beyond threshold (absolute)
  deviationPct: number; // how far beyond threshold (%)
}

interface REITMetrics {
  ticker: string;
  name: string;
  reitId: string;
  price: number;
  pAffo: number;
  divYield: number;
  navDiscount: number;
  debtToAssets: number;
  interestCoverage: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'reitlens-alerts';

const METRIC_OPTIONS: { value: AlertMetric; label: string; unit: string; placeholder: string }[] = [
  { value: 'price', label: 'Price', unit: '$', placeholder: 'e.g. 120.00' },
  { value: 'pAffo', label: 'P/AFFO', unit: 'x', placeholder: 'e.g. 20.0' },
  { value: 'divYield', label: 'Dividend Yield', unit: '%', placeholder: 'e.g. 5.0' },
  { value: 'navDiscount', label: 'NAV Discount', unit: '%', placeholder: 'e.g. 15.0' },
  { value: 'debtToAssets', label: 'Debt / Assets', unit: '%', placeholder: 'e.g. 45.0' },
  { value: 'interestCoverage', label: 'Interest Coverage', unit: 'x', placeholder: 'e.g. 2.0' },
];

const DEFAULT_ALERTS: AlertRule[] = [
  {
    id: 'default-1',
    ticker: 'PLD',
    metric: 'pAffo',
    direction: 'below',
    threshold: 25,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'default-2',
    ticker: 'ALL',
    metric: 'divYield',
    direction: 'above',
    threshold: 5,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'default-3',
    ticker: 'BXP',
    metric: 'debtToAssets',
    direction: 'above',
    threshold: 45,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function sumTTM(quarters: FinancialsQuarterly[], field: keyof FinancialsQuarterly): number {
  const sorted = [...quarters].sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate));
  return sorted.slice(0, 4).reduce((sum, q) => sum + (q[field] as number), 0);
}

function metricLabel(metric: AlertMetric): string {
  return METRIC_OPTIONS.find(m => m.value === metric)?.label ?? metric;
}

function metricUnit(metric: AlertMetric): string {
  return METRIC_OPTIONS.find(m => m.value === metric)?.unit ?? '';
}

function formatMetricValue(metric: AlertMetric, value: number): string {
  const unit = metricUnit(metric);
  if (metric === 'price') return `$${value.toFixed(2)}`;
  return `${value.toFixed(2)}${unit}`;
}

function loadAlerts(): AlertRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AlertRule[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore corrupt data
  }
  return DEFAULT_ALERTS;
}

function saveAlerts(alerts: AlertRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

// ─── Component ──────────────────────────────────────────────────────────────

const Alerts: React.FC = () => {
  // ── State ──────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<AlertRule[]>(() => loadAlerts());
  const [historyOpen, setHistoryOpen] = useState(false);

  // Create-alert form state
  const [newTicker, setNewTicker] = useState<string>('ALL');
  const [newMetric, setNewMetric] = useState<AlertMetric>('pAffo');
  const [newDirection, setNewDirection] = useState<AlertDirection>('below');
  const [newThreshold, setNewThreshold] = useState<string>('');

  // Persist to localStorage on change
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  // ── Compute all REIT metrics once ──────────────────────────────
  const reitMetrics: REITMetrics[] = useMemo(() => {
    return REITS.map(reit => {
      const financials = getFinancials(reit.id);
      const marketData = getMarketDataSync(reit.id);
      const profile = getInstitutionalProfile(reit.ticker);
      const mkt = marketData[0];

      const ttmNoi = sumTTM(financials, 'noi');
      const ttmAffo = sumTTM(financials, 'noi') - sumTTM(financials, 'straightLineRent') - sumTTM(financials, 'maintenanceCapex');
      const ttmEbitdare = sumTTM(financials, 'ebitdare');
      const ttmInterest = sumTTM(financials, 'interestExpense');

      const latestFin = [...financials].sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate))[0];
      const totalDebt = latestFin.totalDebt;
      const totalAssets = latestFin.totalAssets;
      const shares = latestFin.dilutedShares;

      const price = mkt.closePrice;
      const marketCap = mkt.marketCap;
      const affoPerShare = ttmAffo / shares;
      const pAffo = affoPerShare > 0 ? price / affoPerShare : 0;
      const divYield = mkt.dividendYield;

      // NAV: TTM NOI / cap rate - total debt, then per share
      const navTotal = (ttmNoi / profile.baselineCapRate) - totalDebt;
      const navPerShare = navTotal / shares;
      const navDiscount = navPerShare > 0 ? ((price / navPerShare) - 1) * 100 : 0;

      const debtToAssets = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
      const interestCoverage = ttmInterest > 0 ? ttmEbitdare / ttmInterest : 0;

      return {
        ticker: reit.ticker,
        name: reit.name,
        reitId: reit.id,
        price,
        pAffo,
        divYield,
        navDiscount,
        debtToAssets,
        interestCoverage,
      };
    });
  }, []);

  // ── Check all alerts ───────────────────────────────────────────
  const alertResults: AlertCheckResult[] = useMemo(() => {
    const results: AlertCheckResult[] = [];

    for (const alert of alerts) {
      const targets = alert.ticker === 'ALL'
        ? reitMetrics
        : reitMetrics.filter(r => r.ticker === alert.ticker);

      for (const reit of targets) {
        const currentValue = reit[alert.metric];
        const triggered = alert.direction === 'above'
          ? currentValue > alert.threshold
          : currentValue < alert.threshold;

        const deviation = Math.abs(currentValue - alert.threshold);
        const deviationPct = alert.threshold !== 0
          ? (deviation / Math.abs(alert.threshold)) * 100
          : 0;

        results.push({
          alert,
          triggered,
          currentValue,
          reitTicker: reit.ticker,
          reitName: reit.name,
          deviation,
          deviationPct,
        });
      }
    }

    return results;
  }, [alerts, reitMetrics]);

  const triggeredResults = useMemo(
    () => alertResults
      .filter(r => r.triggered)
      .sort((a, b) => b.deviationPct - a.deviationPct),
    [alertResults]
  );

  const triggeredCount = triggeredResults.length;
  const watchingCount = alertResults.length - triggeredCount;

  // ── Table rows: one row per alert rule, show aggregate status ──
  const tableRows = useMemo(() => {
    return alerts.map(alert => {
      const related = alertResults.filter(r => r.alert.id === alert.id);
      const anyTriggered = related.some(r => r.triggered);
      const triggeredTickers = related.filter(r => r.triggered).map(r => r.reitTicker);
      // Pick the "worst" current value for display
      const worstResult = anyTriggered
        ? related.filter(r => r.triggered).sort((a, b) => b.deviationPct - a.deviationPct)[0]
        : related[0];
      return {
        alert,
        anyTriggered,
        triggeredTickers,
        worstResult,
        totalChecked: related.length,
        triggeredCount: triggeredTickers.length,
      };
    }).sort((a, b) => {
      if (a.anyTriggered && !b.anyTriggered) return -1;
      if (!a.anyTriggered && b.anyTriggered) return 1;
      return 0;
    });
  }, [alerts, alertResults]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleAddAlert = useCallback(() => {
    const threshold = parseFloat(newThreshold);
    if (isNaN(threshold)) return;

    const rule: AlertRule = {
      id: generateId(),
      ticker: newTicker,
      metric: newMetric,
      direction: newDirection,
      threshold,
      createdAt: new Date().toISOString(),
    };
    setAlerts(prev => [...prev, rule]);
    setNewThreshold('');
  }, [newTicker, newMetric, newDirection, newThreshold]);

  const handleDeleteAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleAddTemplate = useCallback((template: { metric: AlertMetric; direction: AlertDirection; threshold: number; ticker?: string }) => {
    const rule: AlertRule = {
      id: generateId(),
      ticker: template.ticker ?? 'ALL',
      metric: template.metric,
      direction: template.direction,
      threshold: template.threshold,
      createdAt: new Date().toISOString(),
    };
    setAlerts(prev => [...prev, rule]);
  }, []);

  const selectedMetricOption = METRIC_OPTIONS.find(m => m.value === newMetric);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-lightBlue" />
          <h1 className="text-2xl header-noe text-slate-100">Alerts &amp; Triggers</h1>
          {triggeredCount > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-pumpkin/20 text-pumpkin border border-pumpkin/40 uppercase tracking-wider">
              {triggeredCount} Triggered
            </span>
          )}
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold bg-emerald/15 text-emerald border border-emerald/30 uppercase tracking-wider">
            {watchingCount} Watching
          </span>
        </div>
        <p className="text-xs text-slate-500 font-secondary">
          Checked against latest data on page load
        </p>
      </div>

      {/* ── Main grid: Create + Table | Templates sidebar ────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* ── Create Alert Panel ─────────────────────────────── */}
          <div className="bg-darkBlue/40 border border-rain/20 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-300 font-primary mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-lightBlue" />
              Create Alert
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              {/* Ticker */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-secondary">Ticker</label>
                <select
                  value={newTicker}
                  onChange={e => setNewTicker(e.target.value)}
                  className="bg-obsidian border border-rain/30 rounded px-3 py-1.5 text-sm text-slate-200 font-primary focus:border-lightBlue focus:outline-none w-28"
                >
                  <option value="ALL">All REITs</option>
                  {REITS.map(r => (
                    <option key={r.id} value={r.ticker}>{r.ticker}</option>
                  ))}
                </select>
              </div>

              {/* Metric */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-secondary">Metric</label>
                <select
                  value={newMetric}
                  onChange={e => setNewMetric(e.target.value as AlertMetric)}
                  className="bg-obsidian border border-rain/30 rounded px-3 py-1.5 text-sm text-slate-200 font-primary focus:border-lightBlue focus:outline-none w-40"
                >
                  {METRIC_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Direction */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-secondary">Direction</label>
                <select
                  value={newDirection}
                  onChange={e => setNewDirection(e.target.value as AlertDirection)}
                  className="bg-obsidian border border-rain/30 rounded px-3 py-1.5 text-sm text-slate-200 font-primary focus:border-lightBlue focus:outline-none w-24"
                >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
                </select>
              </div>

              {/* Threshold */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider font-secondary">
                  Threshold ({selectedMetricOption?.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={newThreshold}
                  onChange={e => setNewThreshold(e.target.value)}
                  placeholder={selectedMetricOption?.placeholder ?? ''}
                  className="bg-obsidian border border-rain/30 rounded px-3 py-1.5 text-sm text-slate-200 font-primary focus:border-lightBlue focus:outline-none w-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddAlert(); }}
                />
              </div>

              {/* Add button */}
              <button
                onClick={handleAddAlert}
                disabled={!newThreshold || isNaN(parseFloat(newThreshold))}
                className="px-4 py-1.5 bg-lightBlue/20 text-lightBlue border border-lightBlue/30 rounded text-sm font-semibold font-primary hover:bg-lightBlue/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Add Alert
              </button>
            </div>
          </div>

          {/* ── Active Alerts Table ────────────────────────────── */}
          <div className="bg-darkBlue/20 border border-rain/10 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-rain/10">
              <h2 className="text-sm font-semibold text-slate-300 font-primary">
                Active Alerts ({alerts.length})
              </h2>
            </div>
            {alerts.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-500 text-sm font-secondary">
                No alerts configured. Create one above or use a template.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rain/10">
                      {['Ticker', 'Metric', 'Condition', 'Threshold', 'Current', 'Status', ''].map(col => (
                        <th key={col} className="px-4 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500 font-secondary font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map(row => (
                      <tr
                        key={row.alert.id}
                        className={`border-b border-rain/5 transition-colors ${
                          row.anyTriggered
                            ? 'bg-pumpkin/5 border-l-4 border-l-pumpkin'
                            : 'hover:bg-darkBlue/30'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-slate-200 font-semibold font-primary">
                          {row.alert.ticker === 'ALL' ? (
                            <span className="text-lightBlue">All REITs</span>
                          ) : row.alert.ticker}
                          {row.alert.ticker === 'ALL' && row.anyTriggered && (
                            <span className="text-[9px] text-pumpkin/80 ml-1">
                              ({row.triggeredCount}/{row.totalChecked})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-secondary">
                          {metricLabel(row.alert.metric)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 font-secondary">
                          {row.alert.direction === 'above' ? (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" /> Above
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> Below
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-200 font-primary tabular-nums">
                          {formatMetricValue(row.alert.metric, row.alert.threshold)}
                        </td>
                        <td className="px-4 py-2.5 font-primary tabular-nums">
                          {row.worstResult ? (
                            <span className={row.anyTriggered ? 'text-pumpkin font-semibold' : 'text-slate-300'}>
                              {formatMetricValue(row.alert.metric, row.worstResult.currentValue)}
                              {row.alert.ticker === 'ALL' && row.anyTriggered && (
                                <span className="text-[9px] text-slate-500 ml-1">
                                  ({row.worstResult.reitTicker})
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          {row.anyTriggered ? (
                            <span className="flex items-center gap-1.5 text-pumpkin text-xs font-semibold font-primary">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pumpkin opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-pumpkin" />
                              </span>
                              TRIGGERED
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-emerald/60 text-xs font-secondary">
                              <span className="inline-flex rounded-full h-2 w-2 bg-emerald/40" />
                              WATCHING
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => handleDeleteAlert(row.alert.id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                            title="Delete alert"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Triggered Alerts Summary Cards ─────────────────── */}
          {triggeredResults.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 font-primary flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-pumpkin" />
                Triggered Alerts ({triggeredResults.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {triggeredResults.slice(0, 12).map((result, i) => (
                  <div
                    key={`${result.alert.id}-${result.reitTicker}-${i}`}
                    className="bg-pumpkin/5 border border-pumpkin/30 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pumpkin opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-pumpkin" />
                        </span>
                        <span className="text-sm font-semibold text-slate-100 font-primary">{result.reitTicker}</span>
                        <span className="text-xs text-slate-400 font-secondary truncate max-w-[180px]">{result.reitName}</span>
                      </div>
                      <span className="text-[9px] text-pumpkin/70 font-secondary">
                        +{result.deviationPct.toFixed(1)}% beyond
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-secondary">
                      <span className="text-slate-100 font-primary font-medium">{result.reitTicker}</span>{' '}
                      {metricLabel(result.alert.metric)} at{' '}
                      <span className="text-pumpkin font-semibold">{formatMetricValue(result.alert.metric, result.currentValue)}</span>
                      {' '}&mdash;{' '}
                      {result.alert.direction === 'above' ? 'above' : 'below'} your{' '}
                      <span className="text-slate-200">{formatMetricValue(result.alert.metric, result.alert.threshold)}</span> threshold
                    </p>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-secondary">
                      <span>Current: <span className="text-pumpkin">{formatMetricValue(result.alert.metric, result.currentValue)}</span></span>
                      <span>Threshold: {formatMetricValue(result.alert.metric, result.alert.threshold)}</span>
                      <span>Deviation: {result.deviation.toFixed(2)} ({result.deviationPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Alert History (collapsible) ────────────────────── */}
          <div className="bg-darkBlue/20 border border-rain/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setHistoryOpen(prev => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-slate-400 font-primary hover:text-slate-300 transition-colors"
            >
              <span>Alert History</span>
              {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {historyOpen && (
              <div className="px-4 pb-4 space-y-2">
                {triggeredResults.length === 0 ? (
                  <p className="text-xs text-slate-500 font-secondary py-4 text-center">
                    No triggered alerts to display.
                  </p>
                ) : (
                  triggeredResults.map((result, i) => (
                    <div
                      key={`hist-${result.alert.id}-${result.reitTicker}-${i}`}
                      className="flex items-center justify-between py-2 border-b border-rain/5 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex rounded-full h-1.5 w-1.5 bg-pumpkin/60" />
                        <span className="text-xs text-slate-300 font-primary">
                          <span className="font-semibold">{result.reitTicker}</span>{' '}
                          {metricLabel(result.alert.metric)}{' '}
                          {result.alert.direction === 'above' ? '>' : '<'}{' '}
                          {formatMetricValue(result.alert.metric, result.alert.threshold)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-secondary">
                        First triggered: {new Date(result.alert.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar: Templates ─────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300 font-primary flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold" />
            Quick Templates
          </h2>
          <p className="text-[10px] text-slate-500 font-secondary leading-relaxed">
            One-click institutional alert presets. Each creates an alert for all REITs matching the criteria.
          </p>

          {/* Value Entry */}
          <button
            onClick={() => handleAddTemplate({ metric: 'pAffo', direction: 'below', threshold: 15 })}
            className="w-full text-left bg-darkBlue/30 border border-rain/20 hover:border-lightBlue rounded-lg p-3 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-lightBlue group-hover:text-lightBlue" />
              <span className="text-xs font-semibold text-slate-200 font-primary">Value Entry</span>
            </div>
            <p className="text-[10px] text-slate-500 font-secondary">
              P/AFFO &lt; 15x for all REITs — flag cheap valuations
            </p>
          </button>

          {/* Yield Threshold */}
          <button
            onClick={() => handleAddTemplate({ metric: 'divYield', direction: 'above', threshold: 5 })}
            className="w-full text-left bg-darkBlue/30 border border-rain/20 hover:border-lightBlue rounded-lg p-3 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald group-hover:text-emerald" />
              <span className="text-xs font-semibold text-slate-200 font-primary">Yield Threshold</span>
            </div>
            <p className="text-[10px] text-slate-500 font-secondary">
              Dividend Yield &gt; 5% — income-focused entry signals
            </p>
          </button>

          {/* Leverage Warning */}
          <button
            onClick={() => handleAddTemplate({ metric: 'debtToAssets', direction: 'above', threshold: 50 })}
            className="w-full text-left bg-darkBlue/30 border border-rain/20 hover:border-lightBlue rounded-lg p-3 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 text-pumpkin group-hover:text-pumpkin" />
              <span className="text-xs font-semibold text-slate-200 font-primary">Leverage Warning</span>
            </div>
            <p className="text-[10px] text-slate-500 font-secondary">
              Debt/Assets &gt; 50% — elevated leverage risk
            </p>
          </button>

          {/* Coverage Floor */}
          <button
            onClick={() => handleAddTemplate({ metric: 'interestCoverage', direction: 'below', threshold: 2.0 })}
            className="w-full text-left bg-darkBlue/30 border border-rain/20 hover:border-lightBlue rounded-lg p-3 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-gold group-hover:text-gold" />
              <span className="text-xs font-semibold text-slate-200 font-primary">Coverage Floor</span>
            </div>
            <p className="text-[10px] text-slate-500 font-secondary">
              Interest Coverage &lt; 2.0x — debt service stress signal
            </p>
          </button>

          {/* NAV Discount */}
          <button
            onClick={() => handleAddTemplate({ metric: 'navDiscount', direction: 'below', threshold: -15 })}
            className="w-full text-left bg-darkBlue/30 border border-rain/20 hover:border-lightBlue rounded-lg p-3 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-rain group-hover:text-lightBlue" />
              <span className="text-xs font-semibold text-slate-200 font-primary">NAV Discount</span>
            </div>
            <p className="text-[10px] text-slate-500 font-secondary">
              Trading &gt; 15% below NAV — deep discount opportunity
            </p>
          </button>

          {/* Stats summary */}
          <div className="mt-4 pt-3 border-t border-rain/10">
            <div className="space-y-2 text-[10px] text-slate-500 font-secondary">
              <div className="flex justify-between">
                <span>Total alerts</span>
                <span className="text-slate-300 font-primary">{alerts.length}</span>
              </div>
              <div className="flex justify-between">
                <span>REITs monitored</span>
                <span className="text-slate-300 font-primary">{REITS.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Conditions checked</span>
                <span className="text-slate-300 font-primary">{alertResults.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Trigger rate</span>
                <span className="text-pumpkin font-primary">
                  {alertResults.length > 0
                    ? ((triggeredCount / alertResults.length) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
