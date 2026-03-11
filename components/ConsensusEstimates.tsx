import React, { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ErrorBar,
  Scatter,
  ReferenceLine,
  Cell,
  BarChart,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getFinancials, getMarketDataSync } from '../services/dataService';
import { getInstitutionalProfile } from '../services/reitRegistry';
import { useStrategicModelStore } from '../stores/useStrategicModelStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsensusEstimatesProps {
  ticker: string;
}

interface EstimateRow {
  metric: string;
  metricKey: string;
  low: number;
  consensus: number;
  high: number;
  model: number;
  delta: number;
  deltaPct: number;
  analysts: number;
  unit: 'dollar' | 'dollarM' | 'perShare';
}

interface RevisionPoint {
  quarter: string;
  ffoLow: number;
  ffoConsensus: number;
  ffoHigh: number;
  affoLow: number;
  affoConsensus: number;
  affoHigh: number;
  ffoError: [number, number];
  affoError: [number, number];
}

interface AnalystCoverage {
  bank: string;
  rating: 'Buy' | 'Hold' | 'Sell';
  targetPrice: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random seeded by ticker string */
function seededRandom(ticker: string, salt: number): number {
  let hash = 0;
  const str = ticker + String(salt);
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  // Normalize to 0-1
  return ((hash & 0x7fffffff) % 10000) / 10000;
}

/** Seeded normal-ish distribution via Box-Muller approximation */
function seededNormal(ticker: string, salt: number, mean: number, stddev: number): number {
  const u1 = seededRandom(ticker, salt) || 0.5;
  const u2 = seededRandom(ticker, salt + 999) || 0.5;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

const fmtDollar = (v: number): string => `$${v.toFixed(2)}`;
const fmtDollarM = (v: number): string => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
};
const fmtPct = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const BANKS: string[] = [
  'Morgan Stanley', 'JP Morgan', 'Goldman Sachs', 'BMO Capital',
  'Wells Fargo', 'Citi', 'BofA Securities', 'RBC Capital', 'Mizuho',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ConsensusEstimates: React.FC<ConsensusEstimatesProps> = ({ ticker }) => {
  const waccRf = useStrategicModelStore((s) => s.wacc.rf);
  const waccErp = useStrategicModelStore((s) => s.wacc.erp);
  const waccBeta = useStrategicModelStore((s) => s.wacc.beta);
  const growthSs = useStrategicModelStore((s) => s.growth.ss);
  const growthAcqVol = useStrategicModelStore((s) => s.growth.acqVol);
  const growthAcqSpread = useStrategicModelStore((s) => s.growth.acqSpread);
  const growthDevVol = useStrategicModelStore((s) => s.growth.devVol);
  const growthDevSpread = useStrategicModelStore((s) => s.growth.devSpread);
  const growthLeakage = useStrategicModelStore((s) => s.growth.leakage);
  const growthCap = useStrategicModelStore((s) => s.growth.cap);

  const reit = useMemo(() => REITS.find((r) => r.ticker === ticker), [ticker]);
  const profile = useMemo(() => getInstitutionalProfile(ticker), [ticker]);
  const financials = useMemo(() => {
    if (!reit) return [];
    return getFinancials(reit.id);
  }, [reit]);
  const marketData = useMemo(() => {
    if (!reit) return [];
    return getMarketDataSync(reit.id);
  }, [reit]);

  // ── Model values ──────────────────────────────────────────────────────

  const modelValues = useMemo(() => {
    if (!reit || financials.length === 0) {
      return { ffo: 0, affo: 0, revenue: 0, noi: 0, dividend: 0, nav: 0, targetPrice: 0, shares: 1 };
    }

    const shares = reit.sharesOutstanding; // millions
    // TTM = last 4 quarters
    const ttm = financials.slice(-4);
    const ttmRevenue = ttm.reduce((s, q) => s + q.revenue, 0);
    const ttmNoi = ttm.reduce((s, q) => s + q.noi, 0);
    const ttmFfo = ttm.reduce((s, q) => s + q.ffo, 0);
    const ttmSlr = ttm.reduce((s, q) => s + q.straightLineRent, 0);
    const ttmMaintCapex = ttm.reduce((s, q) => s + q.maintenanceCapex, 0);
    const ttmAffo = ttmFfo - ttmSlr - ttmMaintCapex;
    const totalDebt = ttm[ttm.length - 1].totalDebt;

    // Model growth rate from strategic model store
    const modelGrowth = (growthSs + (growthAcqVol * growthAcqSpread / 10000) +
      (growthDevVol * growthDevSpread / 10000) + growthLeakage + growthCap) / 100;

    // Current year = TTM, next year = TTM * (1 + growth)
    const fwdRevenue = ttmRevenue * (1 + modelGrowth);
    const fwdNoi = ttmNoi * (1 + modelGrowth);
    const fwdFfo = ttmFfo * (1 + modelGrowth);
    const fwdAffo = ttmAffo * (1 + modelGrowth);

    const dividendPerShare = (reit.nominalPrice * profile.dividendYield);
    const nav = (ttmNoi / profile.baselineCapRate - totalDebt) / shares;

    // WACC
    const ke = waccRf + waccBeta * waccErp;
    const impliedGrowth = modelGrowth * 100;
    const justifiedMultiple = (1 / ((ke / 100) - (impliedGrowth / 100)));
    const clampedMultiple = Math.max(8, Math.min(justifiedMultiple, 35));
    const targetPrice = (fwdAffo / shares) * clampedMultiple;

    return {
      ffo: ttmFfo / shares,
      ffoFwd: fwdFfo / shares,
      affo: ttmAffo / shares,
      affoFwd: fwdAffo / shares,
      revenue: ttmRevenue,
      revenueFwd: fwdRevenue,
      noi: ttmNoi,
      noiFwd: fwdNoi,
      dividend: dividendPerShare,
      nav,
      targetPrice,
      shares,
    };
  }, [reit, financials, profile, growthSs, growthAcqVol, growthAcqSpread,
    growthDevVol, growthDevSpread, growthLeakage, growthCap, waccRf, waccErp, waccBeta]);

  // ── Consensus estimates (simulated) ───────────────────────────────────

  const estimates = useMemo((): EstimateRow[] => {
    if (!reit) return [];
    const mv = modelValues;

    const genEstimate = (
      metricKey: string,
      label: string,
      modelVal: number,
      unit: EstimateRow['unit'],
      salt: number,
      analystBase: number,
    ): EstimateRow => {
      // Consensus median is model value + small random offset
      const offset = seededNormal(ticker, salt, 0, 0.04); // ~4% stdev
      const consensus = modelVal * (1 + offset);
      const spread = Math.abs(modelVal) * (0.06 + seededRandom(ticker, salt + 50) * 0.08);
      const low = consensus - spread;
      const high = consensus + spread;
      const analysts = Math.round(analystBase + seededRandom(ticker, salt + 100) * 6);
      const delta = modelVal - consensus;
      const deltaPct = consensus !== 0 ? (delta / Math.abs(consensus)) * 100 : 0;

      return { metric: label, metricKey, low, consensus, high, model: modelVal, delta, deltaPct, analysts, unit };
    };

    const baseAnalysts = 8 + Math.round(seededRandom(ticker, 0) * 10);

    return [
      genEstimate('ffo_cy', 'FFO/Share (CY)', mv.ffo, 'perShare', 1, baseAnalysts),
      genEstimate('ffo_ny', 'FFO/Share (NY)', mv.ffoFwd ?? mv.ffo * 1.03, 'perShare', 2, baseAnalysts - 1),
      genEstimate('affo_cy', 'AFFO/Share (CY)', mv.affo, 'perShare', 3, baseAnalysts),
      genEstimate('affo_ny', 'AFFO/Share (NY)', mv.affoFwd ?? mv.affo * 1.03, 'perShare', 4, baseAnalysts - 1),
      genEstimate('rev_cy', 'Revenue (CY)', mv.revenue, 'dollarM', 5, baseAnalysts + 2),
      genEstimate('rev_ny', 'Revenue (NY)', mv.revenueFwd ?? mv.revenue * 1.03, 'dollarM', 6, baseAnalysts),
      genEstimate('noi_cy', 'NOI (CY)', mv.noi, 'dollarM', 7, baseAnalysts - 2),
      genEstimate('noi_ny', 'NOI (NY)', mv.noiFwd ?? mv.noi * 1.03, 'dollarM', 8, baseAnalysts - 2),
      genEstimate('div', 'Dividend/Share', mv.dividend, 'perShare', 9, baseAnalysts + 3),
      genEstimate('nav', 'NAV/Share', mv.nav, 'perShare', 10, baseAnalysts - 3),
      genEstimate('tp', 'Target Price', mv.targetPrice, 'perShare', 11, baseAnalysts),
    ];
  }, [reit, modelValues, ticker]);

  // ── Divergence score ──────────────────────────────────────────────────

  const divergenceScore = useMemo(() => {
    if (estimates.length === 0) return 0;
    const avg = estimates.reduce((s, e) => s + Math.abs(e.deltaPct), 0) / estimates.length;
    return Math.round(avg * 10) / 10;
  }, [estimates]);

  // ── Divergence chart data ─────────────────────────────────────────────

  const divergenceChartData = useMemo(() => {
    return estimates.map((e) => ({
      metric: e.metric.replace(' (CY)', '').replace(' (NY)', ' NY'),
      divergence: Math.round(e.deltaPct * 10) / 10,
    }));
  }, [estimates]);

  // ── Revision trend (simulated) ────────────────────────────────────────

  const revisionTrend = useMemo((): RevisionPoint[] => {
    if (!reit) return [];
    const mv = modelValues;
    const quarters = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'];

    return quarters.map((q, i) => {
      const drift = (i - 2) * 0.015; // consensus drifts towards model over time
      const spreadShrink = 1 - i * 0.12; // range narrows
      const ffoBase = mv.ffo * (1 + seededNormal(ticker, 200 + i, drift, 0.02));
      const affoBase = mv.affo * (1 + seededNormal(ticker, 300 + i, drift, 0.025));
      const ffoSpread = Math.abs(mv.ffo) * 0.08 * spreadShrink;
      const affoSpread = Math.abs(mv.affo) * 0.10 * spreadShrink;

      return {
        quarter: q,
        ffoConsensus: ffoBase,
        ffoLow: ffoBase - ffoSpread,
        ffoHigh: ffoBase + ffoSpread,
        affoConsensus: affoBase,
        affoLow: affoBase - affoSpread,
        affoHigh: affoBase + affoSpread,
        ffoError: [ffoSpread, ffoSpread] as [number, number],
        affoError: [affoSpread, affoSpread] as [number, number],
      };
    });
  }, [reit, modelValues, ticker]);

  // ── Analyst coverage (simulated) ──────────────────────────────────────

  const analystCoverage = useMemo((): AnalystCoverage[] => {
    if (!reit) return [];
    return BANKS.map((bank, i) => {
      const r = seededRandom(ticker, 500 + i);
      const rating: 'Buy' | 'Hold' | 'Sell' = r < 0.55 ? 'Buy' : r < 0.85 ? 'Hold' : 'Sell';
      const priceOffset = seededNormal(ticker, 600 + i, 0, 0.12);
      const targetPrice = modelValues.targetPrice * (1 + priceOffset);
      return { bank, rating, targetPrice };
    });
  }, [reit, modelValues, ticker]);

  const consensusRating = useMemo(() => {
    const ratingMap = { Buy: 5, Hold: 3, Sell: 1 };
    const sum = analystCoverage.reduce((s, a) => s + ratingMap[a.rating], 0);
    return analystCoverage.length > 0 ? (sum / analystCoverage.length).toFixed(1) : '0.0';
  }, [analystCoverage]);

  // ── Variant perception takeaways ──────────────────────────────────────

  const takeaways = useMemo((): string[] => {
    if (estimates.length === 0) return [];
    const ffoEst = estimates.find((e) => e.metricKey === 'ffo_cy');
    const revEst = estimates.find((e) => e.metricKey === 'rev_cy');
    const navEst = estimates.find((e) => e.metricKey === 'nav');

    const lines: string[] = [];

    if (ffoEst) {
      const dir = ffoEst.deltaPct >= 0 ? 'above' : 'below';
      const implication = ffoEst.deltaPct >= 0
        ? 'suggesting potential earnings upside if your assumptions are correct'
        : 'indicating the street may be pricing in stronger operating performance';
      lines.push(`Your model is ${Math.abs(ffoEst.deltaPct).toFixed(1)}% ${dir} consensus on FFO/share - ${implication}.`);
    }

    if (revEst) {
      const dir = revEst.deltaPct >= 0 ? 'higher' : 'lower';
      const driver = revEst.deltaPct >= 0
        ? 'more aggressive same-store growth or acquisition assumptions'
        : 'a more conservative leasing and occupancy outlook';
      lines.push(`Revenue estimates diverge by ${Math.abs(revEst.deltaPct).toFixed(1)}% (${dir}) - driven by ${driver}.`);
    }

    if (navEst) {
      const dir = navEst.deltaPct >= 0 ? 'higher' : 'lower';
      const capDir = navEst.deltaPct >= 0 ? 'lower' : 'higher';
      lines.push(`NAV divergence of ${Math.abs(navEst.deltaPct).toFixed(1)}% implies the market is pricing in ${capDir} cap rates than your ${(profile.baselineCapRate * 100).toFixed(1)}% assumption.`);
    }

    return lines;
  }, [estimates, profile]);

  // ── Format helpers ────────────────────────────────────────────────────

  const fmtValue = (v: number, unit: EstimateRow['unit']): string => {
    if (unit === 'dollarM') return fmtDollarM(v);
    return fmtDollar(v);
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (!reit) {
    return (
      <div className="p-6 text-slate-400 font-secondary text-sm">
        Ticker "{ticker}" not found in registry.
      </div>
    );
  }

  const currentPrice = marketData.length > 0 ? marketData[0].closePrice : reit.nominalPrice;

  return (
    <div className="space-y-5 text-slate-200 font-secondary">
      {/* ── A. Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="header-noe text-xl text-slate-100">
          Consensus Estimates vs. Model — <span className="text-lightBlue">{ticker}</span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">Avg Divergence</span>
          <span
            className={`px-3 py-1 rounded text-xs font-semibold ${
              divergenceScore < 3
                ? 'bg-emerald/20 text-emerald'
                : divergenceScore < 7
                  ? 'bg-gold/20 text-gold'
                  : 'bg-pumpkin/20 text-pumpkin'
            }`}
          >
            {divergenceScore.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ── B. Estimates Table ──────────────────────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-darkBlue/50 text-slate-400 uppercase tracking-wider">
                <th className="sticky left-0 bg-darkBlue/80 px-3 py-2.5 text-left font-medium">Metric</th>
                <th className="px-3 py-2.5 text-right font-medium">Low</th>
                <th className="px-3 py-2.5 text-right font-medium">Consensus</th>
                <th className="px-3 py-2.5 text-right font-medium">High</th>
                <th className="px-3 py-2.5 text-center font-medium min-w-[140px]">Range</th>
                <th className="px-3 py-2.5 text-right font-medium">Your Model</th>
                <th className="px-3 py-2.5 text-right font-medium">Delta</th>
                <th className="px-3 py-2.5 text-right font-medium">Delta %</th>
                <th className="px-3 py-2.5 text-right font-medium"># Analysts</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((row, idx) => {
                const isPositive = row.deltaPct >= 0;
                const deltaColor = isPositive ? 'text-emerald' : 'text-pumpkin';

                // Range bar positioning
                const rangeMin = Math.min(row.low, row.model);
                const rangeMax = Math.max(row.high, row.model);
                const rangeSpan = rangeMax - rangeMin || 1;
                const lowPct = ((row.low - rangeMin) / rangeSpan) * 100;
                const highPct = ((row.high - rangeMin) / rangeSpan) * 100;
                const consPct = ((row.consensus - rangeMin) / rangeSpan) * 100;
                const modelPct = ((row.model - rangeMin) / rangeSpan) * 100;

                return (
                  <tr
                    key={row.metricKey}
                    className={`border-t border-rain/5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-darkBlue/15'} hover:bg-darkBlue/25 transition-colors`}
                  >
                    <td className="sticky left-0 bg-inherit px-3 py-2 text-slate-300 font-medium whitespace-nowrap">
                      {row.metric}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{fmtValue(row.low, row.unit)}</td>
                    <td className="px-3 py-2 text-right text-slate-100 font-semibold tabular-nums">{fmtValue(row.consensus, row.unit)}</td>
                    <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{fmtValue(row.high, row.unit)}</td>
                    <td className="px-3 py-2">
                      {/* Inline range visualization */}
                      <div className="relative h-3 w-full">
                        {/* Range bar low-high */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-rain/30 rounded-full"
                          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
                        />
                        {/* Low dot */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-500"
                          style={{ left: `${lowPct}%`, transform: 'translate(-50%, -50%)' }}
                        />
                        {/* High dot */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-500"
                          style={{ left: `${highPct}%`, transform: 'translate(-50%, -50%)' }}
                        />
                        {/* Consensus dot */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-lightBlue border border-lightBlue/60"
                          style={{ left: `${consPct}%`, transform: 'translate(-50%, -50%)' }}
                        />
                        {/* Model dot */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-pumpkin border border-pumpkin/60"
                          style={{ left: `${modelPct}%`, transform: 'translate(-50%, -50%)' }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-pumpkin font-semibold tabular-nums">{fmtValue(row.model, row.unit)}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${deltaColor}`}>
                      {row.delta >= 0 ? '+' : ''}{fmtValue(row.delta, row.unit)}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${deltaColor}`}>
                      {fmtPct(row.deltaPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{row.analysts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 px-3 py-2 border-t border-rain/5 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-lightBlue" /> Consensus
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-pumpkin" /> Your Model
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-500" /> Low / High
          </span>
        </div>
      </div>

      {/* ── C. Divergence Chart ────────────────────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
        <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-medium">
          Model vs. Consensus Divergence (%)
        </h3>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={divergenceChartData} layout="vertical" margin={{ left: 100, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(v: number) => `${v}%`}
                domain={['auto', 'auto']}
              />
              <YAxis
                type="category"
                dataKey="metric"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={95}
              />
              <ReferenceLine x={0} stroke="#475569" strokeWidth={1} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f2240',
                  border: '1px solid rgba(100,160,255,0.15)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: '#e2e8f0',
                }}
                formatter={(value: number | undefined) => [
                  value !== undefined ? `${value.toFixed(1)}%` : 'N/A',
                  'Divergence',
                ]}
              />
              <Bar dataKey="divergence" radius={[0, 3, 3, 0]}>
                {divergenceChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.divergence >= 0 ? '#34d399' : '#f97316'}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom Row: D + E ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── D. Consensus Revision Trend ────────────────────────────── */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
          <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-medium">
            Consensus Revision Trend (FFO / AFFO per Share)
          </h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revisionTrend} margin={{ left: 10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f2240',
                    border: '1px solid rgba(100,160,255,0.15)',
                    borderRadius: 6,
                    fontSize: 11,
                    color: '#e2e8f0',
                  }}
                  formatter={(value: number | undefined, name: string | undefined) => [
                    value !== undefined ? `$${value.toFixed(2)}` : 'N/A',
                    name ?? '',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="ffoConsensus"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  name="FFO Consensus"
                  dot={{ r: 3, fill: '#60a5fa' }}
                />
                <Scatter dataKey="ffoConsensus" fill="#60a5fa" name="FFO">
                  <ErrorBar dataKey="ffoError" width={6} strokeWidth={1.5} stroke="#60a5fa" direction="y" />
                </Scatter>
                <Line
                  type="monotone"
                  dataKey="affoConsensus"
                  stroke="#34d399"
                  strokeWidth={2}
                  name="AFFO Consensus"
                  dot={{ r: 3, fill: '#34d399' }}
                />
                <Scatter dataKey="affoConsensus" fill="#34d399" name="AFFO">
                  <ErrorBar dataKey="affoError" width={6} strokeWidth={1.5} stroke="#34d399" direction="y" />
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-[2px] bg-[#60a5fa]" /> FFO Consensus
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-[2px] bg-[#34d399]" /> AFFO Consensus
            </span>
            <span className="text-slate-600">Error bars = analyst range</span>
          </div>
        </div>

        {/* ── E. Variant Perception Summary ──────────────────────────── */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 flex flex-col">
          <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-medium">
            Variant Perception Summary
          </h3>
          <div className="flex-1 space-y-3">
            {takeaways.map((text, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-lightBlue/15 text-lightBlue flex items-center justify-center text-[10px] font-semibold">
                  {i + 1}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Quick stats */}
          <div className="mt-4 pt-3 border-t border-rain/10 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Current Price</div>
              <div className="text-sm text-slate-200 font-semibold tabular-nums">${currentPrice.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Consensus TP</div>
              <div className="text-sm text-lightBlue font-semibold tabular-nums">
                {estimates.find((e) => e.metricKey === 'tp')
                  ? `$${estimates.find((e) => e.metricKey === 'tp')!.consensus.toFixed(2)}`
                  : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Model TP</div>
              <div className="text-sm text-pumpkin font-semibold tabular-nums">${modelValues.targetPrice.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── F. Analyst Coverage ─────────────────────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs text-slate-400 uppercase tracking-wider font-medium">
            Analyst Coverage
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase">Consensus Rating</span>
            <span className="text-sm font-semibold text-gold tabular-nums">{consensusRating} / 5.0</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {analystCoverage.map((a) => {
            const ratingColor =
              a.rating === 'Buy'
                ? 'text-emerald bg-emerald/10'
                : a.rating === 'Hold'
                  ? 'text-gold bg-gold/10'
                  : 'text-pumpkin bg-pumpkin/10';
            return (
              <div
                key={a.bank}
                className="flex items-center justify-between px-3 py-2 rounded bg-darkBlue/20 border border-rain/5"
              >
                <span className="text-[11px] text-slate-300">{a.bank}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 tabular-nums">${a.targetPrice.toFixed(0)}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${ratingColor}`}>
                    {a.rating}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Rating distribution */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
          <span>
            Buy: {analystCoverage.filter((a) => a.rating === 'Buy').length}
          </span>
          <span>
            Hold: {analystCoverage.filter((a) => a.rating === 'Hold').length}
          </span>
          <span>
            Sell: {analystCoverage.filter((a) => a.rating === 'Sell').length}
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Avg TP: ${(analystCoverage.reduce((s, a) => s + a.targetPrice, 0) / analystCoverage.length).toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ConsensusEstimates;
