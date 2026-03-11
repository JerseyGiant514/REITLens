
import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Bar,
  Cell,
  Line,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getFinancials } from '../services/dataService';
import { getInstitutionalProfile } from '../services/reitRegistry';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PNAVHistoryProps {
  ticker: string;
}

interface HistoricalPoint {
  date: string;
  label: string;
  price: number;
  navPerShare: number;
  pnavPct: number;
}

interface SectorCompEntry {
  ticker: string;
  name: string;
  pnavPct: number;
  isCurrent: boolean;
}

type TimeRange = '1Y' | '3Y' | '5Y' | '10Y';

// ─── Seeded PRNG ────────────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function tickerSeed(ticker: string): number {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = (hash * 31 + ticker.charCodeAt(i)) % 2147483647;
  }
  return Math.max(hash, 1);
}

// ─── Component ──────────────────────────────────────────────────────────────

const PNAVHistory: React.FC<PNAVHistoryProps> = ({ ticker }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('10Y');

  const reit = REITS.find(r => r.ticker === ticker)!;
  const profile = getInstitutionalProfile(ticker);
  const financials = useMemo(() => getFinancials(reit.id), [reit.id]);

  // ── Derive current NAV/share ────────────────────────────────────────────
  const currentNAVData = useMemo(() => {
    const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
    const latestFin = financials[financials.length - 1];
    const gav = ttmNOI / profile.baselineCapRate;
    const nav = gav - latestFin.totalDebt;
    const navPerShare = nav / latestFin.dilutedShares;
    return { ttmNOI, totalDebt: latestFin.totalDebt, navPerShare, shares: latestFin.dilutedShares };
  }, [financials, profile.baselineCapRate]);

  // ── Generate 40 quarters of simulated history ───────────────────────────
  const historicalData = useMemo<HistoricalPoint[]>(() => {
    const rand = seededRandom(tickerSeed(ticker));
    const points: HistoricalPoint[] = [];
    const baseNAV = currentNAVData.navPerShare;
    const basePrice = reit.nominalPrice;

    for (let q = 39; q >= 0; q--) {
      const yearsBack = q / 4;
      const date = new Date();
      date.setMonth(date.getMonth() - q * 3);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Cap rate variation: ±50bps with mean-reverting drift
      const capRateShock = (rand() - 0.5) * 0.01; // ±50bps
      const adjustedCapRate = profile.baselineCapRate + capRateShock;
      const gav = currentNAVData.ttmNOI / adjustedCapRate;
      const nav = gav - currentNAVData.totalDebt;
      const navPerShare = nav / currentNAVData.shares;

      // Price variation: ±20% with cyclical + trend component
      const cyclical = Math.sin(yearsBack * 0.8 + tickerSeed(ticker) * 0.01) * 0.10;
      const trend = (1 - yearsBack / 12) * 0.05; // slight uptrend
      const noise = (rand() - 0.5) * 0.12;
      const priceMultiplier = 1 + cyclical + trend + noise;
      const price = basePrice * priceMultiplier;

      const pnavPct = ((price / navPerShare) - 1) * 100;

      const label = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;

      points.push({ date: dateStr, label, price, navPerShare, pnavPct });
    }

    return points;
  }, [ticker, reit.nominalPrice, currentNAVData, profile.baselineCapRate]);

  // ── Filter by time range ────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    const rangeMap: Record<TimeRange, number> = { '1Y': 4, '3Y': 12, '5Y': 20, '10Y': 40 };
    const count = rangeMap[timeRange];
    return historicalData.slice(-count);
  }, [historicalData, timeRange]);

  // ── Statistics ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const values = historicalData.map(d => d.pnavPct);
    const current = values[values.length - 1];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const sorted = [...values].sort((a, b) => a - b);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const rank = sorted.filter(v => v <= current).length;
    const percentile = Math.round((rank / sorted.length) * 100);
    const zScore = stdDev === 0 ? 0 : (current - mean) / stdDev;

    let signal: 'EXPENSIVE' | 'FAIR_VALUE' | 'ATTRACTIVE';
    if (zScore > 1) signal = 'EXPENSIVE';
    else if (zScore < -1) signal = 'ATTRACTIVE';
    else signal = 'FAIR_VALUE';

    const medianReversionTarget = Math.abs(zScore) > 1;

    return { current, mean, stdDev, high, low, percentile, zScore, signal, medianReversionTarget };
  }, [historicalData]);

  // ── Sector comparison ──────────────────────────────────────────────────
  const sectorComps = useMemo<SectorCompEntry[]>(() => {
    const sectorPeers = REITS.filter(r => r.sector === reit.sector);
    return sectorPeers.map(peer => {
      const peerProfile = getInstitutionalProfile(peer.ticker);
      const peerFin = getFinancials(peer.id);
      const ttmNOI = peerFin.slice(-4).reduce((a, f) => a + f.noi, 0);
      const latestFin = peerFin[peerFin.length - 1];
      const gav = ttmNOI / peerProfile.baselineCapRate;
      const nav = gav - latestFin.totalDebt;
      const navPerShare = nav / latestFin.dilutedShares;
      const pnavPct = ((peer.nominalPrice / navPerShare) - 1) * 100;

      return {
        ticker: peer.ticker,
        name: peer.name,
        pnavPct,
        isCurrent: peer.ticker === ticker,
      };
    }).sort((a, b) => a.pnavPct - b.pnavPct);
  }, [reit.sector, ticker]);

  // ── Gradient offset for split coloring ─────────────────────────────────
  const gradientOffset = useMemo(() => {
    const values = filteredData.map(d => d.pnavPct);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max <= 0) return 1;
    if (min >= 0) return 0;
    return max / (max - min);
  }, [filteredData]);

  // ── Signal styling ─────────────────────────────────────────────────────
  const signalConfig = useMemo(() => {
    switch (stats.signal) {
      case 'EXPENSIVE':
        return {
          label: 'EXPENSIVE',
          sublabel: 'Consider Trimming',
          color: 'text-red-400',
          border: 'border-red-500/30',
          bg: 'bg-red-900/20',
          dot: 'bg-red-400',
        };
      case 'ATTRACTIVE':
        return {
          label: 'ATTRACTIVE',
          sublabel: 'Consider Adding',
          color: 'text-emerald',
          border: 'border-emerald/30',
          bg: 'bg-emerald/10',
          dot: 'bg-emerald',
        };
      default:
        return {
          label: 'FAIR VALUE',
          sublabel: 'Hold / Neutral',
          color: 'text-lightBlue',
          border: 'border-lightBlue/30',
          bg: 'bg-lightBlue/10',
          dot: 'bg-lightBlue',
        };
    }
  }, [stats.signal]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-institutional text-2xl font-black text-white tracking-institutional uppercase">
            Premium / Discount to NAV &mdash; {ticker}
          </h2>
          <p className="text-[10px] text-rain uppercase tracking-[0.4em] mt-2">
            Historical P/NAV Analysis &bull; Entry / Exit Timing Signal
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`px-6 py-3 rounded-lg border ${
              stats.current >= 0
                ? 'bg-red-900/20 border-red-500/30'
                : 'bg-emerald/10 border-emerald/30'
            }`}
          >
            <span className="text-[10px] text-rain uppercase tracking-widest block">Current P/NAV</span>
            <span
              className={`text-3xl font-black font-primary ${
                stats.current >= 0 ? 'text-red-400' : 'text-emerald'
              }`}
            >
              {stats.current >= 0 ? '+' : ''}{stats.current.toFixed(1)}%
            </span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Main Chart (3 cols) ────────────────────────────────── */}
        <div className="lg:col-span-3 aegis-card p-6">
          {/* Time range selector */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest">
              Historical P/NAV (%)
            </h3>
            <div className="flex gap-1">
              {(['1Y', '3Y', '5Y', '10Y'] as TimeRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${
                    timeRange === range
                      ? 'bg-gold/20 text-gold border border-gold/40'
                      : 'text-rain hover:text-slate-200 border border-transparent hover:border-rain/20'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={filteredData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnavSplit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={0.05} />
                  <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={0.05} />
                  <stop offset={1} stopColor="#10b981" stopOpacity={0.4} />
                </linearGradient>
                <linearGradient id="pnavStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="#ef4444" stopOpacity={1} />
                  <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={1} />
                  <stop offset={gradientOffset} stopColor="#10b981" stopOpacity={1} />
                  <stop offset={1} stopColor="#10b981" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                interval={Math.max(0, Math.floor(filteredData.length / 8) - 1)}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1d32',
                  border: '1px solid rgba(148,163,184,0.15)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                labelStyle={{ color: '#94a3b8', fontWeight: 700, marginBottom: 4 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => {
                  const v = Number(value);
                  if (isNaN(v)) return ['—', 'P/NAV'];
                  return [`${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, 'P/NAV'];
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any, payload: any) => {
                  const point = payload?.[0]?.payload as HistoricalPoint | undefined;
                  if (!point) return String(label);
                  return `${String(label)}  |  Price: $${point.price.toFixed(2)}  |  NAV: $${point.navPerShare.toFixed(2)}`;
                }}
              />
              {/* Horizontal bands */}
              <ReferenceLine y={20} stroke="rgba(239,68,68,0.15)" strokeDasharray="4 4" />
              <ReferenceLine y={10} stroke="rgba(239,68,68,0.10)" strokeDasharray="4 4" />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />
              <ReferenceLine y={-10} stroke="rgba(16,185,129,0.10)" strokeDasharray="4 4" />
              <ReferenceLine y={-20} stroke="rgba(16,185,129,0.15)" strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="pnavPct"
                stroke="url(#pnavStroke)"
                fill="url(#pnavSplit)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Right sidebar ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Entry/Exit Signal Card */}
          <div className={`p-5 rounded-xl border ${signalConfig.bg} ${signalConfig.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full ${signalConfig.dot} animate-pulse`} />
              <span className={`text-xs font-black uppercase tracking-widest ${signalConfig.color}`}>
                {signalConfig.label}
              </span>
            </div>
            <p className="text-[10px] text-rain uppercase tracking-widest mb-4">
              {signalConfig.sublabel}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] text-rain uppercase tracking-widest">Z-Score</span>
              <span className={`text-lg font-black font-primary ${signalConfig.color}`}>
                {stats.zScore >= 0 ? '+' : ''}{stats.zScore.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-rain uppercase tracking-[0.3em]">10Y Statistics</h4>

            <StatRow label="Current P/NAV" value={`${stats.current >= 0 ? '+' : ''}${stats.current.toFixed(1)}%`} />
            <StatRow label="10Y Average" value={`${stats.mean >= 0 ? '+' : ''}${stats.mean.toFixed(1)}%`} />
            <StatRow label="10Y High" value={`+${stats.high.toFixed(1)}%`} accent="text-red-400" />
            <StatRow label="10Y Low" value={`${stats.low.toFixed(1)}%`} accent="text-emerald" />
            <StatRow label="Std Deviation" value={`${stats.stdDev.toFixed(1)}%`} />

            <div className="pt-3 border-t border-rain/10">
              <span className="text-[10px] text-rain uppercase tracking-widest block mb-1">
                Historical Percentile
              </span>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${stats.percentile}%` }}
                  />
                </div>
                <span className="text-sm font-black text-gold font-primary">{stats.percentile}th</span>
              </div>
              <p className="text-[9px] text-rain mt-1">
                Trading at the {stats.percentile}th percentile of historical range
              </p>
            </div>

            {stats.medianReversionTarget && (
              <div className="pt-3 border-t border-rain/10">
                <div className="flex items-center gap-2 text-pumpkin">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Mean Reversion Flag
                  </span>
                </div>
                <p className="text-[9px] text-rain mt-1">
                  Current P/NAV is &gt;1 std dev from 10Y mean ({stats.mean >= 0 ? '+' : ''}{stats.mean.toFixed(1)}%).
                  Historical tendency to revert.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sector P/NAV Comparison ──────────────────────────────── */}
      <div className="aegis-card p-6">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-6">
          Sector P/NAV Comparison &mdash; {reit.sector}
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={sectorComps} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
            <XAxis
              dataKey="ticker"
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1d32',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => {
                const v = Number(value);
                if (isNaN(v)) return ['—', 'P/NAV'];
                return [`${v >= 0 ? '+' : ''}${v.toFixed(1)}%`, 'P/NAV'];
              }}
            />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" strokeWidth={1.5} />
            <Bar
              dataKey="pnavPct"
              radius={[4, 4, 0, 0]}
              fill="#334155"
              maxBarSize={48}
            >
              {sectorComps.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isCurrent
                      ? '#f59e0b'
                      : entry.pnavPct >= 0
                      ? 'rgba(239,68,68,0.4)'
                      : 'rgba(16,185,129,0.4)'
                  }
                />
              ))}
            </Bar>
            <Line type="monotone" dataKey="pnavPct" stroke="transparent" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-center gap-6 mt-2 text-[10px] text-rain">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Current ({ticker})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'rgba(239,68,68,0.4)' }} /> Premium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: 'rgba(16,185,129,0.4)' }} /> Discount
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const StatRow: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-rain uppercase tracking-widest">{label}</span>
    <span className={`text-sm font-black font-primary ${accent || 'text-slate-200'}`}>{value}</span>
  </div>
);

export default PNAVHistory;
