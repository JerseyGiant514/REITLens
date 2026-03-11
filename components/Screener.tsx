/**
 * Screener.tsx
 * Multi-Factor REIT Screener — filter and rank REITs using customizable criteria.
 * Institutional terminal for screening across valuation, leverage, and growth factors.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp, ArrowUpDown, RotateCcw, Zap } from 'lucide-react';
import { REITS } from '../services/mockData';
import { getFinancials, getKPIs, getMarketDataSync } from '../services/dataService';
import { FinancialsQuarterly, Sector } from '../types';
import { getInstitutionalProfile } from '../services/reitRegistry';
import TickerLink from './TickerLink';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FilterCriterion {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
}

interface ActiveFilter {
  min: number;
  max: number;
}

interface SortFactor {
  id: string;
  dir: 'asc' | 'desc';
}

interface ScreenerRow {
  reitId: string;
  ticker: string;
  name: string;
  sector: Sector;
  marketCap: number;
  divYield: number;
  pAffo: number;
  evNoi: number;
  impliedCapRate: number;
  debtToAssets: number;
  netDebtEbitda: number;
  interestCoverage: number;
  ssNoiGrowth: number;
  affoPayout: number;
}

type MetricKey = keyof Omit<ScreenerRow, 'reitId' | 'ticker' | 'name' | 'sector'>;

interface PresetScreen {
  name: string;
  label: string;
  filters: Record<string, Partial<ActiveFilter>>;
}

// ─── Filter Criteria Definitions ────────────────────────────────────────────

const FILTER_CRITERIA: FilterCriterion[] = [
  { id: 'marketCap', label: 'Market Cap', unit: '$B', min: 0, max: 100, step: 0.5, decimals: 1 },
  { id: 'divYield', label: 'Dividend Yield', unit: '%', min: 0, max: 12, step: 0.1, decimals: 1 },
  { id: 'pAffo', label: 'P/AFFO', unit: 'x', min: 0, max: 50, step: 0.5, decimals: 1 },
  { id: 'evNoi', label: 'EV/NOI', unit: 'x', min: 0, max: 40, step: 0.5, decimals: 1 },
  { id: 'impliedCapRate', label: 'Implied Cap Rate', unit: '%', min: 2, max: 12, step: 0.1, decimals: 1 },
  { id: 'debtToAssets', label: 'Debt/Assets', unit: '%', min: 0, max: 70, step: 1, decimals: 0 },
  { id: 'netDebtEbitda', label: 'Net Debt/EBITDA', unit: 'x', min: 0, max: 15, step: 0.5, decimals: 1 },
  { id: 'interestCoverage', label: 'Interest Coverage', unit: 'x', min: 0, max: 20, step: 0.5, decimals: 1 },
  { id: 'ssNoiGrowth', label: 'SS-NOI Growth', unit: '%', min: -5, max: 15, step: 0.5, decimals: 1 },
  { id: 'affoPayout', label: 'AFFO Payout', unit: '%', min: 0, max: 150, step: 1, decimals: 0 },
];

const METRIC_KEY_MAP: Record<string, MetricKey> = {
  marketCap: 'marketCap',
  divYield: 'divYield',
  pAffo: 'pAffo',
  evNoi: 'evNoi',
  impliedCapRate: 'impliedCapRate',
  debtToAssets: 'debtToAssets',
  netDebtEbitda: 'netDebtEbitda',
  interestCoverage: 'interestCoverage',
  ssNoiGrowth: 'ssNoiGrowth',
  affoPayout: 'affoPayout',
};

// ─── Preset Screens ────────────────────────────────────────────────────────

const PRESET_SCREENS: PresetScreen[] = [
  {
    name: 'value',
    label: 'Value Play',
    filters: {
      pAffo: { max: 15 },
      divYield: { min: 4 },
      interestCoverage: { min: 1.2 },
    },
  },
  {
    name: 'growth',
    label: 'Growth',
    filters: {
      ssNoiGrowth: { min: 4 },
      affoPayout: { max: 75 },
    },
  },
  {
    name: 'income',
    label: 'Income',
    filters: {
      divYield: { min: 4.5 },
      affoPayout: { max: 90 },
      interestCoverage: { min: 1.1 },
    },
  },
  {
    name: 'quality',
    label: 'Quality',
    filters: {
      debtToAssets: { max: 35 },
      interestCoverage: { min: 3 },
      ssNoiGrowth: { min: 2 },
    },
  },
  {
    name: 'distressed',
    label: 'Distressed',
    filters: {
      pAffo: { max: 10 },
      divYield: { min: 6 },
      debtToAssets: { min: 40 },
    },
  },
];

// ─── Column definitions for the results table ──────────────────────────────

interface TableColDef {
  key: string;
  label: string;
  align: 'left' | 'right';
  format: (v: number) => string;
}

const TABLE_COLUMNS: TableColDef[] = [
  { key: 'rank', label: '#', align: 'right', format: (v) => String(v) },
  { key: 'ticker', label: 'Ticker', align: 'left', format: () => '' },
  { key: 'name', label: 'Name', align: 'left', format: () => '' },
  { key: 'sector', label: 'Sector', align: 'left', format: () => '' },
  { key: 'marketCap', label: 'Mkt Cap ($B)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'divYield', label: 'Div Yld (%)', align: 'right', format: (v) => v.toFixed(2) },
  { key: 'pAffo', label: 'P/AFFO (x)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'evNoi', label: 'EV/NOI (x)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'impliedCapRate', label: 'Imp Cap (%)', align: 'right', format: (v) => v.toFixed(2) },
  { key: 'debtToAssets', label: 'D/A (%)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'netDebtEbitda', label: 'ND/EBITDA (x)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'interestCoverage', label: 'Int Cov (x)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'ssNoiGrowth', label: 'SS-NOI (%)', align: 'right', format: (v) => v.toFixed(1) },
  { key: 'affoPayout', label: 'Payout (%)', align: 'right', format: (v) => v.toFixed(1) },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function sumTTM(quarters: FinancialsQuarterly[], field: keyof FinancialsQuarterly): number {
  const sorted = [...quarters].sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate));
  const last4 = sorted.slice(0, 4);
  return last4.reduce((sum, q) => sum + (q[field] as number), 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatRange(criterion: FilterCriterion, filter: ActiveFilter): string {
  const fMin = filter.min.toFixed(criterion.decimals);
  const fMax = filter.max.toFixed(criterion.decimals);
  return `${fMin}${criterion.unit} - ${fMax}${criterion.unit}`;
}

// ─── FilterChipPopover ─────────────────────────────────────────────────────

const FilterChipPopover: React.FC<{
  criterion: FilterCriterion;
  activeFilter: ActiveFilter | undefined;
  onApply: (min: number, max: number) => void;
  onRemove: () => void;
}> = ({ criterion, activeFilter, onApply, onRemove }) => {
  const [open, setOpen] = useState(false);
  const [localMin, setLocalMin] = useState(activeFilter?.min ?? criterion.min);
  const [localMax, setLocalMax] = useState(activeFilter?.max ?? criterion.max);
  const popRef = useRef<HTMLDivElement>(null);

  const isActive = activeFilter !== undefined;

  useEffect(() => {
    setLocalMin(activeFilter?.min ?? criterion.min);
    setLocalMax(activeFilter?.max ?? criterion.max);
  }, [activeFilter, criterion.min, criterion.max]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleApply = () => {
    const clampedMin = Math.max(criterion.min, Math.min(localMin, localMax));
    const clampedMax = Math.min(criterion.max, Math.max(localMin, localMax));
    onApply(clampedMin, clampedMax);
    setOpen(false);
  };

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium
          border transition-all duration-150 whitespace-nowrap
          ${isActive
            ? 'border-lightBlue bg-lightBlue/10 text-lightBlue'
            : 'border-rain/20 bg-darkBlue/40 text-rain hover:text-slate-300 hover:border-rain/40'
          }
        `}
      >
        <span>{criterion.label}</span>
        {isActive && (
          <>
            <span className="text-[8px] opacity-70">
              {formatRange(criterion, activeFilter!)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="ml-0.5 hover:text-red-400 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-obsidian border border-rain/20 rounded-lg p-3 shadow-xl min-w-[220px]">
          <div className="text-[9px] font-bold uppercase tracking-widest text-rain mb-2">
            {criterion.label} ({criterion.unit})
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1">
              <label className="text-[8px] text-rain/60 uppercase tracking-wider">Min</label>
              <input
                type="number"
                value={localMin}
                step={criterion.step}
                min={criterion.min}
                max={criterion.max}
                onChange={(e) => setLocalMin(Number(e.target.value))}
                className="w-full mt-0.5 px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px]
                           text-slate-200 font-mono focus:outline-none focus:border-lightBlue/40"
              />
            </div>
            <span className="text-rain/40 text-[10px] mt-3">to</span>
            <div className="flex-1">
              <label className="text-[8px] text-rain/60 uppercase tracking-wider">Max</label>
              <input
                type="number"
                value={localMax}
                step={criterion.step}
                min={criterion.min}
                max={criterion.max}
                onChange={(e) => setLocalMax(Number(e.target.value))}
                className="w-full mt-0.5 px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px]
                           text-slate-200 font-mono focus:outline-none focus:border-lightBlue/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 px-2 py-1 bg-lightBlue/20 border border-lightBlue/30 rounded text-[9px]
                         font-bold text-lightBlue hover:bg-lightBlue/30 transition-colors"
            >
              Apply
            </button>
            {isActive && (
              <button
                onClick={() => { onRemove(); setOpen(false); }}
                className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px]
                           text-rain hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────

const Screener: React.FC = () => {
  const [activeFilters, setActiveFilters] = useState<Record<string, ActiveFilter>>({});
  const [sectorFilter, setSectorFilter] = useState<Set<Sector>>(new Set());
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false);
  const [sortFactors, setSortFactors] = useState<SortFactor[]>([
    { id: 'marketCap', dir: 'desc' },
  ]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [showFailed, setShowFailed] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const sectorDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(e.target as Node)) {
        setSectorDropdownOpen(false);
      }
    };
    if (sectorDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sectorDropdownOpen]);

  const allSectors = useMemo<Sector[]>(() => {
    return [...new Set(REITS.map((r) => r.sector))].sort();
  }, []);

  // ── Build all REIT rows ─────────────────────────────────────────────────
  const allRows = useMemo<ScreenerRow[]>(() => {
    return REITS.map((reit) => {
      const financials = getFinancials(reit.id);
      const market = getMarketDataSync(reit.id);
      const kpis = getKPIs(reit.id);

      const latestMarket = market[0];
      const latestKpi = kpis[kpis.length - 1];

      const mktCap = latestMarket.marketCap;
      const divYield = latestMarket.dividendYield;

      const ttmAffo =
        sumTTM(financials, 'ffo') -
        sumTTM(financials, 'straightLineRent') -
        sumTTM(financials, 'maintenanceCapex');
      const ttmNoi = sumTTM(financials, 'noi');
      const ttmEbitdare = sumTTM(financials, 'ebitdare');
      const ttmInterest = sumTTM(financials, 'interestExpense');

      const latestFin = [...financials].sort((a, b) =>
        b.periodEndDate.localeCompare(a.periodEndDate)
      )[0];
      const totalDebt = latestFin.totalDebt;
      const totalAssets = latestFin.totalAssets;

      const ev = mktCap + totalDebt;
      const pAffo = ttmAffo > 0 ? mktCap / ttmAffo : 0;
      const evNoi = ttmNoi > 0 ? ev / ttmNoi : 0;
      const impliedCapRate = ev > 0 ? (ttmNoi / ev) * 100 : 0;
      const debtToAssets = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
      const netDebtEbitda = ttmEbitdare > 0 ? totalDebt / ttmEbitdare : 0;
      const interestCoverage = ttmInterest > 0 ? ttmEbitdare / ttmInterest : 0;

      return {
        reitId: reit.id,
        ticker: reit.ticker,
        name: reit.name,
        sector: reit.sector,
        marketCap: mktCap / 1000,
        divYield,
        pAffo,
        evNoi,
        impliedCapRate,
        debtToAssets,
        netDebtEbitda,
        interestCoverage,
        ssNoiGrowth: latestKpi.sameStoreNOIGrowth,
        affoPayout: latestKpi.payoutAffo,
      };
    });
  }, []);

  // ── Filter logic ────────────────────────────────────────────────────────
  const passesFilter = useCallback(
    (row: ScreenerRow): boolean => {
      // Sector filter
      if (sectorFilter.size > 0 && !sectorFilter.has(row.sector)) {
        return false;
      }

      // Metric filters
      for (const [filterId, filter] of Object.entries(activeFilters)) {
        const metricKey = METRIC_KEY_MAP[filterId];
        if (!metricKey) continue;
        const val = row[metricKey];
        if (val < filter.min || val > filter.max) return false;
      }

      return true;
    },
    [activeFilters, sectorFilter]
  );

  // ── Split passing / failing ─────────────────────────────────────────────
  const { passing, failing } = useMemo(() => {
    const pass: ScreenerRow[] = [];
    const fail: ScreenerRow[] = [];
    for (const row of allRows) {
      if (passesFilter(row)) {
        pass.push(row);
      } else {
        fail.push(row);
      }
    }
    return { passing: pass, failing: fail };
  }, [allRows, passesFilter]);

  // ── Sort passing rows ──────────────────────────────────────────────────
  const sortedPassing = useMemo(() => {
    const rows = [...passing];
    rows.sort((a, b) => {
      for (const factor of sortFactors) {
        const key = METRIC_KEY_MAP[factor.id];
        if (!key) continue;
        const aVal = a[key];
        const bVal = b[key];
        const diff = factor.dir === 'asc' ? aVal - bVal : bVal - aVal;
        if (Math.abs(diff) > 0.0001) return diff;
      }
      return 0;
    });
    return rows;
  }, [passing, sortFactors]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const pRows = sortedPassing;
    const aRows = allRows;
    return {
      count: pRows.length,
      total: aRows.length,
      medPAffo: median(pRows.map((r) => r.pAffo)),
      medYield: median(pRows.map((r) => r.divYield)),
      medDebtAssets: median(pRows.map((r) => r.debtToAssets)),
      univPAffo: median(aRows.map((r) => r.pAffo)),
      univYield: median(aRows.map((r) => r.divYield)),
      univDebtAssets: median(aRows.map((r) => r.debtToAssets)),
    };
  }, [sortedPassing, allRows]);

  // ── Active filter count ───────────────────────────────────────────────
  const activeFilterCount = Object.keys(activeFilters).length + (sectorFilter.size > 0 ? 1 : 0);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleApplyFilter = useCallback((id: string, min: number, max: number) => {
    setActiveFilters((prev) => ({ ...prev, [id]: { min, max } }));
    setActivePreset(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActivePreset(null);
  }, []);

  const handleClearAll = useCallback(() => {
    setActiveFilters({});
    setSectorFilter(new Set());
    setActivePreset(null);
  }, []);

  const handlePreset = useCallback(
    (preset: PresetScreen) => {
      const newFilters: Record<string, ActiveFilter> = {};
      for (const [filterId, partial] of Object.entries(preset.filters)) {
        const criterion = FILTER_CRITERIA.find((c) => c.id === filterId);
        if (!criterion) continue;
        newFilters[filterId] = {
          min: partial.min ?? criterion.min,
          max: partial.max ?? criterion.max,
        };
      }
      setActiveFilters(newFilters);
      setSectorFilter(new Set());
      setActivePreset(preset.name);
    },
    []
  );

  const handleToggleSector = useCallback((sector: Sector) => {
    setSectorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sector)) {
        next.delete(sector);
      } else {
        next.add(sector);
      }
      return next;
    });
    setActivePreset(null);
  }, []);

  const handleColumnSort = useCallback((colKey: string) => {
    if (!METRIC_KEY_MAP[colKey]) return;
    setSortFactors((prev) => {
      const existing = prev.findIndex((f) => f.id === colKey);
      if (existing === 0) {
        // Toggle direction
        const next = [...prev];
        next[0] = { ...next[0], dir: next[0].dir === 'asc' ? 'desc' : 'asc' };
        return next;
      }
      // Move to primary sort
      const filtered = prev.filter((f) => f.id !== colKey);
      return [{ id: colKey, dir: 'desc' }, ...filtered.slice(0, 2)];
    });
  }, []);

  const handleAddSortFactor = useCallback((id: string) => {
    setSortFactors((prev) => {
      if (prev.length >= 3) return prev;
      if (prev.some((f) => f.id === id)) return prev;
      return [...prev, { id, dir: 'desc' }];
    });
  }, []);

  const handleRemoveSortFactor = useCallback((id: string) => {
    setSortFactors((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleToggleSortDir = useCallback((id: string) => {
    setSortFactors((prev) =>
      prev.map((f) => (f.id === id ? { ...f, dir: f.dir === 'asc' ? 'desc' : 'asc' } : f))
    );
  }, []);

  // ── Check if a value is near filter boundary ─────────────────────────
  const isNearBoundary = useCallback(
    (row: ScreenerRow, colKey: string): boolean => {
      const filterId = colKey;
      const filter = activeFilters[filterId];
      if (!filter) return false;
      const metricKey = METRIC_KEY_MAP[filterId];
      if (!metricKey) return false;
      const val = row[metricKey];
      const range = filter.max - filter.min;
      if (range <= 0) return false;
      const threshold = range * 0.1;
      return val <= filter.min + threshold || val >= filter.max - threshold;
    },
    [activeFilters]
  );

  // ── Render cell ──────────────────────────────────────────────────────────
  const renderCell = (
    row: ScreenerRow,
    col: TableColDef,
    rank: number,
    isFailed: boolean
  ): React.ReactNode => {
    if (col.key === 'rank') {
      return (
        <span className={`font-mono text-rain/60 ${isFailed ? 'line-through' : ''}`}>
          {isFailed ? '-' : rank}
        </span>
      );
    }
    if (col.key === 'ticker') {
      if (isFailed) {
        return (
          <span className="font-bold tracking-wide text-rain line-through">
            {row.ticker}
          </span>
        );
      }
      return (
        <TickerLink
          ticker={row.ticker}
          className="font-bold tracking-wide text-lightBlue hover:text-white underline decoration-dotted cursor-pointer transition-colors"
        />
      );
    }
    if (col.key === 'name') {
      return (
        <span className={`truncate max-w-[140px] block ${isFailed ? 'text-rain line-through' : 'text-slate-400'}`}>
          {row.name}
        </span>
      );
    }
    if (col.key === 'sector') {
      return (
        <span className={`truncate max-w-[100px] block ${isFailed ? 'text-rain' : 'text-slate-400'}`}>
          {row.sector}
        </span>
      );
    }

    const metricKey = METRIC_KEY_MAP[col.key];
    if (!metricKey) return null;
    const val = row[metricKey];
    const formatted = col.format(val);
    const nearBound = !isFailed && isNearBoundary(row, col.key);

    return (
      <span
        className={`font-mono ${
          isFailed
            ? 'text-rain'
            : nearBound
              ? 'text-pumpkin font-semibold'
              : 'text-slate-300'
        }`}
      >
        {formatted}
      </span>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="header-noe text-lg text-white tracking-wide">
            Multi-Factor Screener
          </h2>
          <p className="text-[9px] text-rain uppercase tracking-[0.25em] mt-0.5">
            Filter and rank REITs across valuation, leverage, and growth criteria
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2.5 py-0.5">
            Passing: {summaryStats.count} of {summaryStats.total}
          </span>
          {activeFilterCount > 0 && (
            <span className="text-[10px] font-bold text-lightBlue bg-lightBlue/10 border border-lightBlue/20 rounded-full px-2.5 py-0.5">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-rain hover:text-slate-200 hover:bg-white/10 transition-all"
          >
            {filterPanelOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Preset Screens ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Zap className="w-3 h-3 text-pumpkin" />
        <span className="text-[8px] text-rain uppercase tracking-widest font-bold mr-1">Presets</span>
        {PRESET_SCREENS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset)}
            className={`
              px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider
              border transition-all duration-150
              ${activePreset === preset.name
                ? 'bg-pumpkin/15 border-pumpkin/40 text-pumpkin'
                : 'bg-darkBlue/30 border-rain/20 text-rain hover:border-pumpkin hover:text-slate-300'
              }
            `}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* ── Filter Panel (collapsible) ─────────────────────────────────────── */}
      {filterPanelOpen && (
        <div className="bg-darkBlue/20 border border-rain/10 rounded-lg p-3 space-y-3">
          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3 h-3 text-rain/60" />
            <span className="text-[8px] text-rain uppercase tracking-widest font-bold mr-1">
              Metric Filters
            </span>
            {FILTER_CRITERIA.map((criterion) => (
              <FilterChipPopover
                key={criterion.id}
                criterion={criterion}
                activeFilter={activeFilters[criterion.id]}
                onApply={(min, max) => handleApplyFilter(criterion.id, min, max)}
                onRemove={() => handleRemoveFilter(criterion.id)}
              />
            ))}
          </div>

          {/* Sector multi-select + Clear all */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={sectorDropdownRef}>
              <button
                onClick={() => setSectorDropdownOpen(!sectorDropdownOpen)}
                className={`
                  inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium
                  border transition-all duration-150
                  ${sectorFilter.size > 0
                    ? 'border-lightBlue bg-lightBlue/10 text-lightBlue'
                    : 'border-rain/20 bg-darkBlue/40 text-rain hover:text-slate-300 hover:border-rain/40'
                  }
                `}
              >
                <span>Sector</span>
                {sectorFilter.size > 0 && (
                  <span className="text-[8px] opacity-70">{sectorFilter.size} selected</span>
                )}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>

              {sectorDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-obsidian border border-rain/20 rounded-lg p-2 shadow-xl min-w-[180px]">
                  {allSectors.map((sector) => (
                    <label
                      key={sector}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sectorFilter.has(sector)}
                        onChange={() => handleToggleSector(sector)}
                        className="rounded border-rain/30 bg-white/5 text-lightBlue focus:ring-lightBlue/30 w-3 h-3"
                      />
                      <span className="text-[10px] text-slate-300">{sector}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-bold
                           text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Clear All Filters
              </button>
            )}
          </div>

          {/* Sort factors */}
          <div className="flex items-center gap-2 flex-wrap">
            <ArrowUpDown className="w-3 h-3 text-rain/60" />
            <span className="text-[8px] text-rain uppercase tracking-widest font-bold mr-1">
              Sort By
            </span>
            {sortFactors.map((factor, idx) => {
              const criterion = FILTER_CRITERIA.find((c) => c.id === factor.id);
              return (
                <div
                  key={factor.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px]
                             bg-gold/10 border border-gold/20 text-gold"
                >
                  <span className="text-[7px] text-gold/50 font-bold">{idx + 1}</span>
                  <span className="font-medium">{criterion?.label ?? factor.id}</span>
                  <button
                    onClick={() => handleToggleSortDir(factor.id)}
                    className="text-[7px] font-bold hover:text-white transition-colors"
                  >
                    {factor.dir === 'asc' ? '\u25B2' : '\u25BC'}
                  </button>
                  {sortFactors.length > 1 && (
                    <button
                      onClick={() => handleRemoveSortFactor(factor.id)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-2 h-2" />
                    </button>
                  )}
                </div>
              );
            })}
            {sortFactors.length < 3 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleAddSortFactor(e.target.value);
                }}
                className="bg-white/5 border border-white/10 rounded text-[9px] text-rain px-1.5 py-0.5
                           focus:outline-none focus:border-lightBlue/40"
              >
                <option value="">+ Add sort...</option>
                {FILTER_CRITERIA.filter((c) => !sortFactors.some((f) => f.id === c.id)).map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  )
                )}
              </select>
            )}
          </div>
        </div>
      )}

      {/* ── Results Table ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-rain/10">
        <table className="w-full border-collapse min-w-[1100px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-darkBlue/40">
              {TABLE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-rain
                    border-b border-rain/10 select-none
                    ${METRIC_KEY_MAP[col.key] ? 'cursor-pointer hover:text-slate-200 hover:bg-white/[0.03]' : ''}
                    transition-colors
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.key === 'ticker' ? 'sticky left-0 z-20 bg-darkBlue/40' : ''}
                  `}
                  onClick={() => handleColumnSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortFactors[0]?.id === col.key ? (
                      <span className="text-gold text-[8px]">
                        {sortFactors[0].dir === 'asc' ? '\u25B2' : '\u25BC'}
                      </span>
                    ) : METRIC_KEY_MAP[col.key] ? (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedPassing.map((row, idx) => (
              <tr
                key={row.ticker}
                className={`
                  group transition-colors hover:bg-lightBlue/5
                  ${idx % 2 === 0 ? 'bg-white/[0.01]' : ''}
                `}
              >
                {TABLE_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-3 py-2 text-[11px] font-medium border-b border-rain/5
                      ${col.align === 'right' ? 'text-right' : 'text-left'}
                      ${col.key === 'ticker'
                        ? 'sticky left-0 z-10 bg-obsidian group-hover:bg-lightBlue/5 transition-colors'
                        : ''
                      }
                    `}
                  >
                    {renderCell(row, col, idx + 1, false)}
                  </td>
                ))}
              </tr>
            ))}

            {sortedPassing.length === 0 && (
              <tr>
                <td
                  colSpan={TABLE_COLUMNS.length}
                  className="px-3 py-8 text-center text-[11px] text-rain/60"
                >
                  No REITs match the current filter criteria. Try adjusting your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Failed / Filtered-Out REITs ────────────────────────────────────── */}
      {failing.length > 0 && (
        <div>
          <button
            onClick={() => setShowFailed(!showFailed)}
            className="flex items-center gap-2 text-[9px] text-rain/60 hover:text-rain transition-colors uppercase tracking-widest font-bold"
          >
            {showFailed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Filtered Out ({failing.length})
          </button>

          {showFailed && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-rain/5">
              <table className="w-full border-collapse min-w-[1100px] opacity-30">
                <tbody>
                  {failing.map((row, idx) => (
                    <tr key={row.ticker} className={idx % 2 === 0 ? 'bg-white/[0.005]' : ''}>
                      {TABLE_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`
                            px-3 py-1.5 text-[11px] font-medium border-b border-rain/5
                            ${col.align === 'right' ? 'text-right' : 'text-left'}
                          `}
                        >
                          {renderCell(row, col, 0, true)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Summary Stats (bottom bar) ─────────────────────────────────────── */}
      <div className="bg-darkBlue/20 border border-rain/10 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-6">
        <div className="text-[8px] text-rain uppercase tracking-widest font-bold">
          Screen Summary
        </div>
        <div className="flex items-center gap-4">
          <SummaryStat
            label="Count"
            value={`${summaryStats.count} / ${summaryStats.total}`}
            valueClass="text-emerald-400"
          />
          <SummaryStat
            label="Median P/AFFO"
            value={summaryStats.medPAffo.toFixed(1) + 'x'}
            comparison={summaryStats.univPAffo.toFixed(1) + 'x'}
          />
          <SummaryStat
            label="Median Yield"
            value={summaryStats.medYield.toFixed(2) + '%'}
            comparison={summaryStats.univYield.toFixed(2) + '%'}
          />
          <SummaryStat
            label="Median D/A"
            value={summaryStats.medDebtAssets.toFixed(1) + '%'}
            comparison={summaryStats.univDebtAssets.toFixed(1) + '%'}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[7px] text-rain/40 uppercase tracking-widest px-1">
        <span>
          Metrics: TTM AFFO = FFO - SLR - Maint. Capex | EV = Market Cap + Total Debt
        </span>
        <span>REITLens V1.0 Institutional</span>
      </div>
    </div>
  );
};

// ─── Summary Stat sub-component ─────────────────────────────────────────────

const SummaryStat: React.FC<{
  label: string;
  value: string;
  comparison?: string;
  valueClass?: string;
}> = ({ label, value, comparison, valueClass }) => (
  <div className="flex flex-col">
    <span className="text-[7px] text-rain/60 uppercase tracking-wider">{label}</span>
    <div className="flex items-baseline gap-1.5">
      <span className={`text-[12px] font-mono font-bold ${valueClass ?? 'text-slate-200'}`}>
        {value}
      </span>
      {comparison && (
        <span className="text-[8px] text-rain/40 font-mono">vs {comparison}</span>
      )}
    </div>
  </div>
);

export default Screener;
