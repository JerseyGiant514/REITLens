import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getFinancials, loadRealFinancials, getMarketDataSync } from '../services/dataService';
import { FinancialsQuarterly, MarketDaily } from '../types';
import { getInstitutionalProfile } from '../services/reitRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ForwardAFFOProps {
  ticker: string;
}

interface Assumptions {
  revGrowth: number;
  noiMargin: number;
  gaExpensePct: number;
  interestRate: number;
  maintCapexPct: number;
  slrPct: number;
}

interface QuarterRow {
  label: string;
  isActual: boolean;
  revenue: number;
  noi: number;
  gaExpense: number;
  ebitdare: number;
  interest: number;
  ffo: number;
  slr: number;
  maintenanceCapex: number;
  affo: number;
  affoPerShare: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (v: number): string => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
};

const fmtShare = (v: number): string => `$${v.toFixed(2)}`;

const pct = (v: number): string => `${v.toFixed(1)}%`;

const QUARTER_LABELS_FWD = [
  'Q1 2025E', 'Q2 2025E', 'Q3 2025E', 'Q4 2025E',
  'Q1 2026E', 'Q2 2026E', 'Q3 2026E', 'Q4 2026E',
];

// ---------------------------------------------------------------------------
// Slider component
// ---------------------------------------------------------------------------

interface SliderCardProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

const SliderCard: React.FC<SliderCardProps> = ({ label, value, min, max, step, unit, onChange }) => (
  <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-3 flex flex-col gap-1.5 min-w-[140px] flex-1">
    <span className="text-[9px] font-black text-rain uppercase tracking-widest leading-none">
      {label}
    </span>
    <span className="text-sm font-bold text-lightBlue font-secondary">
      {value.toFixed(1)}{unit}
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 appearance-none rounded-full bg-rain/20 accent-lightBlue cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-lightBlue
        [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(56,189,248,0.4)]"
    />
    <div className="flex justify-between text-[8px] text-slate-500 font-secondary">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ForwardAFFO: React.FC<ForwardAFFOProps> = ({ ticker }) => {
  const reit = useMemo(() => REITS.find((r) => r.ticker === ticker), [ticker]);
  const profile = useMemo(() => getInstitutionalProfile(ticker), [ticker]);

  // Load real financials from DB in background on mount / ticker change
  useEffect(() => {
    if (reit) loadRealFinancials(reit.id);
  }, [reit]);

  // Historical data
  const financials: FinancialsQuarterly[] = useMemo(
    () => (reit ? getFinancials(reit.id) : []),
    [reit],
  );

  const marketData: MarketDaily[] = useMemo(
    () => (reit ? getMarketDataSync(reit.id) : []),
    [reit],
  );

  const currentPrice = useMemo(
    () => (marketData.length > 0 ? marketData[0].closePrice : reit?.nominalPrice ?? 100),
    [marketData, reit],
  );

  // Default assumptions derived from institutional profile
  const defaults = useMemo<Assumptions>(
    () => ({
      revGrowth: profile.growthAlpha + 2.5,
      noiMargin: profile.operatingMargin * 100,
      gaExpensePct: profile.gaExpensePct * 100,
      interestRate: 4.5,
      maintCapexPct: profile.recurringCapexIntensity * 100,
      slrPct: profile.straightLineRentPct * 100,
    }),
    [profile],
  );

  const [assumptions, setAssumptions] = useState<Assumptions>(defaults);

  const resetDefaults = useCallback(() => setAssumptions(defaults), [defaults]);

  const updateAssumption = useCallback(
    <K extends keyof Assumptions>(key: K, value: Assumptions[K]) =>
      setAssumptions((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // Build historical rows (last 4 quarters)
  const historicalRows = useMemo<QuarterRow[]>(() => {
    const last4 = financials.slice(-4);
    return last4.map((f) => {
      const qLabel = (() => {
        const d = new Date(f.periodEndDate);
        const m = d.getMonth();
        const y = d.getFullYear();
        const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
        return `${q} ${y}`;
      })();
      const affo = f.ffo - f.straightLineRent - f.maintenanceCapex;
      return {
        label: qLabel,
        isActual: true,
        revenue: f.revenue,
        noi: f.noi,
        gaExpense: f.gaExpense,
        ebitdare: f.ebitdare,
        interest: f.interestExpense,
        ffo: f.ffo,
        slr: f.straightLineRent,
        maintenanceCapex: f.maintenanceCapex,
        affo,
        affoPerShare: affo / f.dilutedShares,
      };
    });
  }, [financials]);

  // Build projected rows (8 forward quarters)
  const projectedRows = useMemo<QuarterRow[]>(() => {
    if (financials.length === 0) return [];
    const lastFin = financials[financials.length - 1];
    const shares = lastFin.dilutedShares;
    const totalDebt = lastFin.totalDebt;
    let prevRevenue = lastFin.revenue;

    return QUARTER_LABELS_FWD.map((label) => {
      const revenue = prevRevenue * (1 + assumptions.revGrowth / 100 / 4);
      const noi = revenue * (assumptions.noiMargin / 100);
      const gaExpense = revenue * (assumptions.gaExpensePct / 100);
      const ebitdare = noi - gaExpense;
      const interest = (totalDebt * assumptions.interestRate) / 100 / 4;
      const ffo = noi - interest - gaExpense;
      const slr = revenue * (assumptions.slrPct / 100);
      const maintenanceCapex = noi * (assumptions.maintCapexPct / 100);
      const affo = ffo - slr - maintenanceCapex;
      const affoPerShare = affo / shares;

      prevRevenue = revenue;

      return {
        label,
        isActual: false,
        revenue,
        noi,
        gaExpense,
        ebitdare,
        interest,
        ffo,
        slr,
        maintenanceCapex,
        affo,
        affoPerShare,
      };
    });
  }, [financials, assumptions]);

  const allRows = useMemo(() => [...historicalRows, ...projectedRows], [historicalRows, projectedRows]);

  // Trailing 4Q AFFO/share
  const trailingAFFOPerShare = useMemo(
    () => historicalRows.reduce((sum, r) => sum + r.affoPerShare, 0),
    [historicalRows],
  );

  // Forward 4Q AFFO/share (next 4 projected quarters)
  const forwardAFFOPerShare = useMemo(
    () => projectedRows.slice(0, 4).reduce((sum, r) => sum + r.affoPerShare, 0),
    [projectedRows],
  );

  // Valuation metrics
  const trailingPAFFO = useMemo(
    () => (trailingAFFOPerShare > 0 ? currentPrice / trailingAFFOPerShare : 0),
    [currentPrice, trailingAFFOPerShare],
  );

  const forwardPAFFO = useMemo(
    () => (forwardAFFOPerShare > 0 ? currentPrice / forwardAFFOPerShare : 0),
    [currentPrice, forwardAFFOPerShare],
  );

  const forwardAFFOYield = useMemo(
    () => (currentPrice > 0 ? (forwardAFFOPerShare / currentPrice) * 100 : 0),
    [forwardAFFOPerShare, currentPrice],
  );

  const annualDividend = useMemo(
    () => (reit ? reit.nominalPrice * profile.dividendYield : 0),
    [reit, profile],
  );

  const forwardDivCoverage = useMemo(
    () => (annualDividend > 0 ? forwardAFFOPerShare / annualDividend : 0),
    [forwardAFFOPerShare, annualDividend],
  );

  // Market-implied AFFO/share line (price / trailing P/AFFO as a consensus proxy)
  const impliedAFFOLine = useMemo(
    () => (trailingPAFFO > 0 ? currentPrice / trailingPAFFO / 4 : 0),
    [currentPrice, trailingPAFFO],
  );

  // Chart data
  const chartData = useMemo(
    () =>
      allRows.map((r) => ({
        quarter: r.label,
        affoPerShare: parseFloat(r.affoPerShare.toFixed(2)),
        isActual: r.isActual,
        implied: parseFloat(impliedAFFOLine.toFixed(2)),
      })),
    [allRows, impliedAFFOLine],
  );

  const isForwardCheaper = forwardPAFFO < trailingPAFFO;

  if (!reit) {
    return (
      <div className="p-6 text-slate-400 text-sm font-secondary">
        REIT not found for ticker: {ticker}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* ── A) Header ──────────────────────────────────────────────── */}
      <div>
        <h2 className="header-noe text-2xl text-slate-100 tracking-tight">
          Forward AFFO Model — {ticker}
        </h2>
        <p className="text-xs text-rain font-secondary mt-1">
          Trailing AFFO/sh{' '}
          <span className="text-emerald-400 font-bold">{fmtShare(trailingAFFOPerShare)}</span>
          {' | '}Forward AFFO/sh{' '}
          <span className="text-emerald-400 font-bold">{fmtShare(forwardAFFOPerShare)}</span>
          {' | '}Price{' '}
          <span className="text-lightBlue font-bold">${currentPrice.toFixed(2)}</span>
        </p>
      </div>

      {/* ── B) Assumptions Panel ───────────────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-rain uppercase tracking-widest">
            Model Assumptions
          </span>
          <button
            onClick={resetDefaults}
            className="text-[9px] font-bold text-lightBlue hover:text-white transition-colors
              border border-lightBlue/30 rounded px-2 py-0.5 hover:border-lightBlue/60"
          >
            Reset to Defaults
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SliderCard
            label="Revenue Growth"
            value={assumptions.revGrowth}
            min={-5}
            max={15}
            step={0.1}
            unit="%"
            onChange={(v) => updateAssumption('revGrowth', v)}
          />
          <SliderCard
            label="NOI Margin"
            value={assumptions.noiMargin}
            min={40}
            max={95}
            step={0.5}
            unit="%"
            onChange={(v) => updateAssumption('noiMargin', v)}
          />
          <SliderCard
            label="G&A % of Rev"
            value={assumptions.gaExpensePct}
            min={1}
            max={10}
            step={0.1}
            unit="%"
            onChange={(v) => updateAssumption('gaExpensePct', v)}
          />
          <SliderCard
            label="Interest Rate"
            value={assumptions.interestRate}
            min={2}
            max={8}
            step={0.1}
            unit="%"
            onChange={(v) => updateAssumption('interestRate', v)}
          />
          <SliderCard
            label="Maint CapEx % NOI"
            value={assumptions.maintCapexPct}
            min={2}
            max={30}
            step={0.5}
            unit="%"
            onChange={(v) => updateAssumption('maintCapexPct', v)}
          />
          <SliderCard
            label="SL Rent % Rev"
            value={assumptions.slrPct}
            min={0}
            max={5}
            step={0.1}
            unit="%"
            onChange={(v) => updateAssumption('slrPct', v)}
          />
        </div>
      </div>

      {/* ── C) Quarterly Projection Table ──────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-secondary">
            <thead>
              <tr className="bg-white/[0.03] border-b border-rain/10 sticky top-0 z-10">
                {[
                  'Quarter',
                  'Revenue',
                  'NOI',
                  'G&A',
                  'EBITDAre',
                  'Interest',
                  'FFO',
                  'SLR',
                  'Maint CapEx',
                  'AFFO',
                  'AFFO/Sh',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[9px] font-black text-rain uppercase tracking-widest whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, i) => {
                const isLastActual = row.isActual && (i === historicalRows.length - 1);
                return (
                  <tr
                    key={row.label}
                    className={`border-b transition-colors hover:bg-white/[0.04] ${
                      row.isActual
                        ? 'bg-white/[0.02] border-rain/5'
                        : 'bg-lightBlue/[0.02] border-rain/5'
                    } ${isLastActual ? 'border-b-2 border-b-rain/30' : ''}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-slate-200 font-bold">{row.label}</span>
                      <span
                        className={`ml-1.5 text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded ${
                          row.isActual
                            ? 'text-emerald-400 bg-emerald-400/10'
                            : 'text-lightBlue bg-lightBlue/10'
                        }`}
                      >
                        {row.isActual ? 'ACT' : 'EST'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{fmt(row.revenue)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmt(row.noi)}</td>
                    <td className="px-3 py-2 text-slate-400">{fmt(row.gaExpense)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmt(row.ebitdare)}</td>
                    <td className="px-3 py-2 text-slate-400">{fmt(row.interest)}</td>
                    <td className="px-3 py-2 text-slate-300">{fmt(row.ffo)}</td>
                    <td className="px-3 py-2 text-slate-500">{fmt(row.slr)}</td>
                    <td className="px-3 py-2 text-slate-500">{fmt(row.maintenanceCapex)}</td>
                    <td className="px-3 py-2 text-emerald-400 font-bold">{fmt(row.affo)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-400">{fmtShare(row.affoPerShare)}</td>
                  </tr>
                );
              })}

              {/* Summary row */}
              <tr className="bg-white/[0.05] border-t-2 border-rain/30">
                <td className="px-3 py-3 text-slate-100 font-bold" colSpan={10}>
                  Forward 4Q AFFO/Share
                </td>
                <td className="px-3 py-3 font-bold text-lg text-emerald-400">
                  {fmtShare(forwardAFFOPerShare)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── D) AFFO/Share Trend Chart ──────────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
        <span className="text-[10px] font-black text-rain uppercase tracking-widest block mb-3">
          AFFO per Share — Quarterly Trend
        </span>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f1d32',
                  border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e2e8f0',
                }}
                formatter={(value: number | undefined) =>
                  value !== undefined ? [`$${value.toFixed(2)}`, ''] : ['—', '']
                }
                labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 700 }}
              />
              <Bar
                dataKey="affoPerShare"
                name="AFFO/Share"
                radius={[3, 3, 0, 0]}
                fill="#38bdf8"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={index >= historicalRows.length ? 'rgba(56,189,248,0.35)' : 'rgba(56,189,248,0.7)'}
                    stroke={index >= historicalRows.length ? 'rgba(56,189,248,0.5)' : 'rgba(56,189,248,0.9)'}
                    strokeWidth={0.5}
                  />
                ))}
              </Bar>
              <Line
                dataKey="implied"
                name="Market Implied"
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                dot={false}
              />
              <ReferenceLine
                x={historicalRows[historicalRows.length - 1]?.label}
                stroke="rgba(148,163,184,0.3)"
                strokeDasharray="4 4"
                label={{
                  value: 'ESTIMATES',
                  position: 'top',
                  fill: '#64748b',
                  fontSize: 8,
                  fontWeight: 700,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-2 text-[9px] text-slate-500 font-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-lightBlue/70" /> Historical
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-lightBlue/35" /> Projected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0 border-t border-dashed border-amber-400" />{' '}
            Market Implied
          </span>
        </div>
      </div>

      {/* ── E) Forward Valuation Implied ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Forward P/AFFO */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-[9px] font-black text-rain uppercase tracking-widest">
            Forward P/AFFO
          </span>
          <span
            className={`text-xl font-bold font-secondary ${
              isForwardCheaper ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {forwardPAFFO.toFixed(1)}x
          </span>
          <span className="text-[9px] text-slate-500 font-secondary">
            vs trailing {trailingPAFFO.toFixed(1)}x{' '}
            <span
              className={`font-bold ${
                isForwardCheaper ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isForwardCheaper ? '(cheaper on growth)' : '(more expensive)'}
            </span>
          </span>
        </div>

        {/* Trailing P/AFFO */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-[9px] font-black text-rain uppercase tracking-widest">
            Trailing P/AFFO
          </span>
          <span className="text-xl font-bold text-slate-200 font-secondary">
            {trailingPAFFO.toFixed(1)}x
          </span>
          <span className="text-[9px] text-slate-500 font-secondary">
            LTM AFFO/sh {fmtShare(trailingAFFOPerShare)}
          </span>
        </div>

        {/* Forward Dividend Coverage */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-[9px] font-black text-rain uppercase tracking-widest">
            Fwd Div Coverage
          </span>
          <span
            className={`text-xl font-bold font-secondary ${
              forwardDivCoverage >= 1.0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {forwardDivCoverage.toFixed(2)}x
          </span>
          <span className="text-[9px] text-slate-500 font-secondary">
            Fwd AFFO / Est Dividend
          </span>
        </div>

        {/* Forward AFFO Yield */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 flex flex-col gap-1">
          <span className="text-[9px] font-black text-rain uppercase tracking-widest">
            Fwd AFFO Yield
          </span>
          <span className="text-xl font-bold text-gold font-secondary">
            {pct(forwardAFFOYield)}
          </span>
          <span className="text-[9px] text-slate-500 font-secondary">
            Fwd AFFO/sh / Price
          </span>
        </div>
      </div>
    </div>
  );
};

export default ForwardAFFO;
