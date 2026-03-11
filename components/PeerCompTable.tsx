/**
 * PeerCompTable.tsx
 * Institutional-grade REIT peer comparison table with sortable columns,
 * z-score rankings, sector filters, and export capability.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import { REITS } from '../services/mockData';
import { getFinancials, getKPIs, getMarketDataSync } from '../services/dataService';
import { REIT, FinancialsQuarterly, MarketDaily, REITKPIs } from '../types';
import { getInstitutionalProfile, INSTITUTIONAL_PROFILES } from '../services/reitRegistry';
import ExportButton from './ExportButton';
import TickerLink from './TickerLink';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PeerRow {
  reit: REIT;
  ticker: string;
  name: string;
  sector: string;
  marketCap: number;
  price: number;
  divYield: number;
  pAffo: number;
  evNoi: number;
  impliedCapRate: number;
  debtToAssets: number;
  netDebtEbitda: number;
  interestCoverage: number;
  ssNoiGrowth: number;
  affoPayout: number;
  gaToGav: number;
  compositeZ: number;
}

type SortKey = keyof Omit<PeerRow, 'reit'>;
type SortDir = 'asc' | 'desc';

// ─── Column definitions ─────────────────────────────────────────────────────

interface ColDef {
  key: SortKey;
  label: string;
  shortLabel?: string;
  align: 'left' | 'right';
  format: (v: number) => string;
  /** For color coding: 'lower' means lower is better, 'higher' means higher is better */
  goodDir: 'lower' | 'higher' | 'neutral';
  /** Percentile thresholds for color coding [greenBelow, redAbove] or [greenAbove, redBelow] */
}

const COLUMNS: ColDef[] = [
  { key: 'ticker', label: 'Ticker', align: 'left', format: () => '', goodDir: 'neutral' },
  { key: 'name', label: 'Name', align: 'left', format: () => '', goodDir: 'neutral' },
  { key: 'sector', label: 'Sector', align: 'left', format: () => '', goodDir: 'neutral' },
  { key: 'marketCap', label: 'Mkt Cap ($B)', shortLabel: 'Mkt Cap', align: 'right', format: (v) => v.toFixed(1), goodDir: 'neutral' },
  { key: 'price', label: 'Price ($)', shortLabel: 'Price', align: 'right', format: (v) => v.toFixed(2), goodDir: 'neutral' },
  { key: 'divYield', label: 'Div Yld (%)', shortLabel: 'Div Yld', align: 'right', format: (v) => v.toFixed(2), goodDir: 'higher' },
  { key: 'pAffo', label: 'P/AFFO (x)', shortLabel: 'P/AFFO', align: 'right', format: (v) => v.toFixed(1), goodDir: 'lower' },
  { key: 'evNoi', label: 'EV/NOI (x)', shortLabel: 'EV/NOI', align: 'right', format: (v) => v.toFixed(1), goodDir: 'lower' },
  { key: 'impliedCapRate', label: 'Imp Cap (%)', shortLabel: 'Cap Rate', align: 'right', format: (v) => v.toFixed(2), goodDir: 'higher' },
  { key: 'debtToAssets', label: 'Debt/Assets (%)', shortLabel: 'D/A', align: 'right', format: (v) => v.toFixed(1), goodDir: 'lower' },
  { key: 'netDebtEbitda', label: 'ND/EBITDA (x)', shortLabel: 'ND/EBI', align: 'right', format: (v) => v.toFixed(1), goodDir: 'lower' },
  { key: 'interestCoverage', label: 'Int Cov (x)', shortLabel: 'Int Cov', align: 'right', format: (v) => v.toFixed(1), goodDir: 'higher' },
  { key: 'ssNoiGrowth', label: 'SS-NOI Gr (%)', shortLabel: 'SS-NOI', align: 'right', format: (v) => v.toFixed(1), goodDir: 'higher' },
  { key: 'affoPayout', label: 'AFFO Pay (%)', shortLabel: 'Payout', align: 'right', format: (v) => v.toFixed(1), goodDir: 'lower' },
  { key: 'gaToGav', label: 'G&A/GAV (%)', shortLabel: 'G&A', align: 'right', format: (v) => v.toFixed(2), goodDir: 'lower' },
  { key: 'compositeZ', label: 'Z-Score', shortLabel: 'Z', align: 'right', format: (v) => v.toFixed(2), goodDir: 'higher' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function sumTTM(quarters: FinancialsQuarterly[], field: keyof FinancialsQuarterly): number {
  const sorted = [...quarters].sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate));
  const last4 = sorted.slice(0, 4);
  return last4.reduce((sum, q) => sum + (q[field] as number), 0);
}

function zScore(values: number[], value: number): number {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (value - mean) / std;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getValueColor(value: number, allValues: number[], goodDir: 'lower' | 'higher' | 'neutral'): string {
  if (goodDir === 'neutral') return 'text-slate-300';
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.indexOf(value);
  const percentile = rank / (sorted.length - 1 || 1);

  if (goodDir === 'lower') {
    if (percentile <= 0.25) return 'text-emerald-400';
    if (percentile >= 0.75) return 'text-red-400';
    return 'text-slate-300';
  }
  // higher is better
  if (percentile >= 0.75) return 'text-emerald-400';
  if (percentile <= 0.25) return 'text-red-400';
  return 'text-slate-300';
}

// ─── Component ──────────────────────────────────────────────────────────────

const PeerCompTable: React.FC = () => {
  const [sortKey, setSortKey] = useState<SortKey>('compositeZ');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Build all row data ──────────────────────────────────────────────────
  const allRows = useMemo<PeerRow[]>(() => {
    return REITS.map((reit) => {
      const financials = getFinancials(reit.id);
      const market = getMarketDataSync(reit.id);
      const kpis = getKPIs(reit.id);

      const latestMarket = market[0];
      const latestKpi = kpis[kpis.length - 1];

      const mktCap = latestMarket.marketCap;
      const price = latestMarket.closePrice;
      const divYield = latestMarket.dividendYield;

      // TTM computations
      const ttmAffo = sumTTM(financials, 'ffo') - sumTTM(financials, 'straightLineRent') - sumTTM(financials, 'maintenanceCapex');
      const ttmNoi = sumTTM(financials, 'noi');
      const ttmEbitdare = sumTTM(financials, 'ebitdare');
      const ttmInterest = sumTTM(financials, 'interestExpense');

      const latestFin = [...financials].sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate))[0];
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
        reit,
        ticker: reit.ticker,
        name: reit.name,
        sector: reit.sector,
        marketCap: mktCap / 1000, // convert to $B
        price,
        divYield,
        pAffo,
        evNoi,
        impliedCapRate,
        debtToAssets,
        netDebtEbitda,
        interestCoverage,
        ssNoiGrowth: latestKpi.sameStoreNOIGrowth,
        affoPayout: latestKpi.payoutAffo,
        gaToGav: latestKpi.gaToGav,
        compositeZ: 0, // computed below
      };
    });
  }, []);

  // ── Compute composite z-scores ──────────────────────────────────────────
  const rowsWithZ = useMemo<PeerRow[]>(() => {
    const pAffoVals = allRows.map((r) => r.pAffo);
    const evNoiVals = allRows.map((r) => r.evNoi);
    const capRateVals = allRows.map((r) => r.impliedCapRate);
    const debtVals = allRows.map((r) => r.debtToAssets);
    const leverageVals = allRows.map((r) => r.netDebtEbitda);
    const coverageVals = allRows.map((r) => r.interestCoverage);

    return allRows.map((row) => {
      // Lower valuation = better (negate z for P/AFFO and EV/NOI)
      const zPAffo = -zScore(pAffoVals, row.pAffo);
      const zEvNoi = -zScore(evNoiVals, row.evNoi);
      const zCapRate = zScore(capRateVals, row.impliedCapRate); // higher = cheaper
      // Lower leverage = better (negate)
      const zDebt = -zScore(debtVals, row.debtToAssets);
      const zLev = -zScore(leverageVals, row.netDebtEbitda);
      // Higher coverage = better
      const zCov = zScore(coverageVals, row.interestCoverage);

      // Composite: 50% valuation, 50% balance sheet
      const compositeZ =
        0.20 * zPAffo +
        0.15 * zEvNoi +
        0.15 * zCapRate +
        0.15 * zDebt +
        0.15 * zLev +
        0.20 * zCov;

      return { ...row, compositeZ };
    });
  }, [allRows]);

  // ── Sectors for filter chips ────────────────────────────────────────────
  const sectors = useMemo(() => {
    const unique = [...new Set(REITS.map((r) => r.sector))];
    return ['All', ...unique.sort()];
  }, []);

  // ── Filter + sort ──────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = rowsWithZ;

    if (sectorFilter !== 'All') {
      rows = rows.filter((r) => r.sector === sectorFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.ticker.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      );
    }

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir * aVal.localeCompare(bVal);
      }
      return dir * ((aVal as number) - (bVal as number));
    });

    return rows;
  }, [rowsWithZ, sectorFilter, searchQuery, sortKey, sortDir]);

  // ── Median row ─────────────────────────────────────────────────────────
  const medianRow = useMemo<Omit<PeerRow, 'reit'>>(() => {
    const numericKeys: (keyof PeerRow)[] = [
      'marketCap', 'price', 'divYield', 'pAffo', 'evNoi', 'impliedCapRate',
      'debtToAssets', 'netDebtEbitda', 'interestCoverage', 'ssNoiGrowth',
      'affoPayout', 'gaToGav', 'compositeZ',
    ];

    const result: Record<string, string | number> = {
      ticker: 'MEDIAN',
      name: '',
      sector: '',
    };

    for (const key of numericKeys) {
      const vals = filteredRows.map((r) => r[key] as number);
      result[key] = median(vals);
    }

    return result as unknown as Omit<PeerRow, 'reit'>;
  }, [filteredRows]);

  // ── Column value arrays for color coding ───────────────────────────────
  const colValueMaps = useMemo(() => {
    const maps: Partial<Record<SortKey, number[]>> = {};
    for (const col of COLUMNS) {
      if (col.goodDir !== 'neutral' && col.key !== 'compositeZ') {
        maps[col.key] = filteredRows.map((r) => r[col.key] as number);
      }
    }
    return maps;
  }, [filteredRows]);

  // ── Export data ────────────────────────────────────────────────────────
  const exportData = useMemo(() => {
    return filteredRows.map((r) => ({
      Ticker: r.ticker,
      Name: r.name,
      Sector: r.sector,
      'Mkt Cap ($B)': r.marketCap,
      'Price ($)': r.price,
      'Div Yield (%)': r.divYield,
      'P/AFFO (x)': r.pAffo,
      'EV/NOI (x)': r.evNoi,
      'Implied Cap Rate (%)': r.impliedCapRate,
      'Debt/Assets (%)': r.debtToAssets,
      'Net Debt/EBITDA (x)': r.netDebtEbitda,
      'Interest Coverage (x)': r.interestCoverage,
      'SS-NOI Growth (%)': r.ssNoiGrowth,
      'AFFO Payout (%)': r.affoPayout,
      'G&A/GAV (%)': r.gaToGav,
      'Z-Score': r.compositeZ,
    }));
  }, [filteredRows]);

  // ── Sort handler ───────────────────────────────────────────────────────
  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  // ── Z-score bar ────────────────────────────────────────────────────────
  const renderZBar = (z: number) => {
    const clamped = Math.max(-2.5, Math.min(2.5, z));
    const pct = ((clamped + 2.5) / 5) * 100;
    const color =
      z >= 0.5
        ? 'bg-emerald-500'
        : z <= -0.5
          ? 'bg-red-500'
          : 'bg-gold';

    return (
      <div className="flex items-center gap-1.5">
        <div className="w-16 h-2 rounded-full bg-white/5 relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 h-full w-[1px] bg-white/20"
          />
          <div
            className={`absolute top-0 h-full rounded-full ${color}`}
            style={{
              left: z >= 0 ? '50%' : `${pct}%`,
              width: z >= 0 ? `${pct - 50}%` : `${50 - pct}%`,
            }}
          />
        </div>
        <span
          className={`text-[10px] font-mono font-bold ${
            z >= 0.5
              ? 'text-emerald-400'
              : z <= -0.5
                ? 'text-red-400'
                : 'text-gold'
          }`}
        >
          {z >= 0 ? '+' : ''}{z.toFixed(2)}
        </span>
      </div>
    );
  };

  // ── Render cell ────────────────────────────────────────────────────────
  const renderCell = (row: PeerRow | Omit<PeerRow, 'reit'>, col: ColDef, isMedian: boolean) => {
    const value = row[col.key];

    if (col.key === 'ticker') {
      if (isMedian) {
        return (
          <span className="font-bold tracking-wide text-pumpkin">
            {value as string}
          </span>
        );
      }
      return (
        <TickerLink
          ticker={value as string}
          className="font-bold tracking-wide text-lightBlue hover:text-white underline decoration-dotted cursor-pointer transition-colors"
        />
      );
    }

    if (col.key === 'name' || col.key === 'sector') {
      return <span className="text-slate-400 truncate max-w-[120px] block">{value as string}</span>;
    }

    if (col.key === 'compositeZ') {
      return renderZBar(value as number);
    }

    const numVal = value as number;
    const formatted = col.format(numVal);

    let colorClass = 'text-slate-300';
    if (!isMedian && col.goodDir !== 'neutral') {
      const vals = colValueMaps[col.key];
      if (vals) {
        colorClass = getValueColor(numVal, vals, col.goodDir);
      }
    }
    if (isMedian) colorClass = 'text-pumpkin font-semibold';

    return <span className={`font-mono ${colorClass}`}>{formatted}</span>;
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="header-noe text-lg text-white tracking-wide">
            Peer Comparison
          </h2>
          <p className="text-[9px] text-rain uppercase tracking-[0.25em] mt-0.5">
            {filteredRows.length} of {REITS.length} REITs
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-rain" />
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-48 bg-white/5 border border-white/10 rounded-lg
                         text-[10px] text-slate-200 placeholder-rain/50
                         focus:outline-none focus:border-lightBlue/40 focus:bg-white/[0.07]
                         transition-all"
            />
          </div>

          {/* Export */}
          <ExportButton
            data={exportData}
            filename="reit-peer-comp"
            title="REIT Peer Comparison"
            sheetName="Peer Comp"
            compact
          />
        </div>
      </div>

      {/* ── Sector filter chips ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {sectors.map((sector) => (
          <button
            key={sector}
            onClick={() => setSectorFilter(sector)}
            className={`
              px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest
              border transition-all duration-150
              ${sectorFilter === sector
                ? 'bg-lightBlue/15 border-lightBlue/40 text-lightBlue'
                : 'bg-white/[0.03] border-white/10 text-rain hover:bg-white/[0.06] hover:text-slate-300'
              }
            `}
          >
            {sector}
          </button>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-rain/10">
        <table className="w-full border-collapse min-w-[1200px]">
          {/* Header */}
          <thead className="sticky top-0 z-10">
            <tr className="bg-darkBlue/40">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-rain
                    border-b border-rain/10 cursor-pointer select-none
                    hover:text-slate-200 hover:bg-white/[0.03] transition-colors
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.key === 'ticker' ? 'sticky left-0 z-20 bg-darkBlue/40' : ''}
                  `}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.shortLabel || col.label}
                    {sortKey === col.key ? (
                      <span className="text-lightBlue text-[8px]">
                        {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                      </span>
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr
                key={row.ticker}
                className={`
                  group transition-colors
                  hover:bg-lightBlue/5
                  ${idx % 2 === 0 ? 'bg-white/[0.01]' : ''}
                `}
              >
                {COLUMNS.map((col) => (
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
                    {renderCell(row, col, false)}
                  </td>
                ))}
              </tr>
            ))}

            {/* Median row */}
            {filteredRows.length > 0 && (
              <tr className="border-t-2 border-pumpkin bg-pumpkin/5">
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-3 py-2 text-[11px] font-medium
                      ${col.align === 'right' ? 'text-right' : 'text-left'}
                      ${col.key === 'ticker' ? 'sticky left-0 z-10 bg-pumpkin/5' : ''}
                    `}
                  >
                    {renderCell(medianRow, col, true)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[7px] text-rain/40 uppercase tracking-widest px-1">
        <span>
          Z-Score = 50% valuation (P/AFFO, EV/NOI, Cap Rate) + 50% balance sheet (D/A, ND/EBITDA, Int Cov)
        </span>
        <span>REITLens V1.0 Institutional</span>
      </div>
    </div>
  );
};

export default PeerCompTable;
