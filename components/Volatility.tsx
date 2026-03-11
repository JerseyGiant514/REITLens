import React, { useMemo } from 'react';
import { REITS } from '../services/mockData';
import { getInstitutionalProfile, REITS as REGISTRY_REITS } from '../services/reitRegistry';
import { Sector } from '../types';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ReferenceLine,
  BarChart,
} from 'recharts';

// ── Theme Colors ──────────────────────────────────────────────────
const THEME = {
  lightBlue: '#48A3CC',
  pumpkin: '#FF9D3C',
  emerald: '#10b981',
  gold: '#d4af37',
  rain: '#64748b',
  red: '#f43f5e',
  obsidian: '#0a1628',
};

// ── Sector Vol Map ────────────────────────────────────────────────
const SECTOR_VOL: Record<string, number> = {
  [Sector.INDUSTRIAL]: 0.18,
  [Sector.RESIDENTIAL]: 0.20,
  [Sector.RETAIL]: 0.28,
  [Sector.OFFICE]: 0.35,
  [Sector.SFR]: 0.22,
  [Sector.SELF_STORAGE]: 0.22,
  [Sector.LODGING]: 0.32,
  [Sector.DATA_CENTERS]: 0.24,
  [Sector.HEALTHCARE]: 0.25,
  [Sector.TOWERS]: 0.20,
};

const BENCHMARK_VOL = 0.22;
const RISK_FREE = 0.0425;
const TRADING_DAYS = 252;

interface VolatilityProps {
  ticker: string;
}

// ── Deterministic seeded PRNG ─────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashTicker(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) {
    h = (h * 31 + ticker.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Box-Muller transform ─────────────────────────────────────────
function boxMuller(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
}

// ── Generate GBM price series ─────────────────────────────────────
function generatePriceSeries(
  basePrice: number,
  annualVol: number,
  days: number,
  seed: number,
  drift: number = 0.06
): number[] {
  const rng = mulberry32(seed);
  const dailyVol = annualVol / Math.sqrt(TRADING_DAYS);
  const dailyDrift = drift / TRADING_DAYS;
  const prices: number[] = [basePrice];

  for (let i = 1; i < days; i++) {
    const z = boxMuller(rng);
    const ret = dailyDrift - 0.5 * dailyVol * dailyVol + dailyVol * z;
    prices.push(prices[i - 1] * Math.exp(ret));
  }
  return prices;
}

// ── Statistical helpers ───────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function covariance(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - ma) * (b[i] - mb);
  return sum / (a.length - 1);
}

function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
}

function skewness(arr: number[]): number {
  const m = mean(arr);
  const s = stdDev(arr);
  const n = arr.length;
  return (n / ((n - 1) * (n - 2))) * arr.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0);
}

function kurtosis(arr: number[]): number {
  const m = mean(arr);
  const s = stdDev(arr);
  const n = arr.length;
  const k4 =
    ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
    arr.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0);
  return k4 - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

// ── Main Component ────────────────────────────────────────────────
const Volatility: React.FC<VolatilityProps> = ({ ticker }) => {
  const reit = REITS.find((r) => r.ticker === ticker);
  const sectorVol = reit ? SECTOR_VOL[reit.sector] ?? 0.22 : 0.22;

  // ── Generate price data ─────────────────────────────────────────
  const {
    prices,
    benchmarkPrices,
    dailyReturns,
    benchmarkReturns,
    dates,
  } = useMemo(() => {
    const seed = hashTicker(ticker);
    const base = reit?.nominalPrice ?? 100;
    const p = generatePriceSeries(base, sectorVol, TRADING_DAYS, seed, 0.07);
    const bp = generatePriceSeries(100, BENCHMARK_VOL, TRADING_DAYS, seed + 9999, 0.06);

    const dr: number[] = [];
    const br: number[] = [];
    for (let i = 1; i < p.length; i++) {
      dr.push(p[i] / p[i - 1] - 1);
      br.push(bp[i] / bp[i - 1] - 1);
    }

    const d: string[] = [];
    for (let i = 0; i < TRADING_DAYS; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() - (TRADING_DAYS - 1 - i));
      d.push(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
          dt.getDate()
        ).padStart(2, '0')}`
      );
    }

    return {
      prices: p,
      benchmarkPrices: bp,
      dailyReturns: dr,
      benchmarkReturns: br,
      dates: d,
    };
  }, [ticker, reit, sectorVol]);

  // ── Risk Metrics ────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const annualizedReturn =
      (prices[prices.length - 1] / prices[0]) ** (TRADING_DAYS / (prices.length - 1)) - 1;
    const annualizedVol = stdDev(dailyReturns) * Math.sqrt(TRADING_DAYS);

    // Max drawdown
    let peak = prices[0];
    let maxDD = 0;
    let maxDDIdx = 0;
    const drawdowns: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (prices[i] > peak) peak = prices[i];
      const dd = (prices[i] - peak) / peak;
      drawdowns.push(dd * 100);
      if (dd < maxDD) {
        maxDD = dd;
        maxDDIdx = i;
      }
    }

    const sharpe = (annualizedReturn - RISK_FREE) / annualizedVol;

    // Sortino: downside deviation
    const negReturns = dailyReturns.filter((r) => r < 0);
    const downsideDev =
      Math.sqrt(negReturns.reduce((s, r) => s + r * r, 0) / negReturns.length) *
      Math.sqrt(TRADING_DAYS);
    const sortino = (annualizedReturn - RISK_FREE) / downsideDev;

    // Beta
    const cov = covariance(dailyReturns, benchmarkReturns);
    const benchVar = variance(benchmarkReturns);
    const beta = cov / benchVar;

    // VaR & CVaR (95%)
    const var95 = percentile(dailyReturns, 5);
    const cvar95 =
      mean(dailyReturns.filter((r) => r <= var95));
    const portfolioValue = (reit?.nominalPrice ?? 100) * (reit?.sharesOutstanding ?? 100) ;
    const var95Dollar = Math.abs(var95) * portfolioValue;

    // Rolling 30-day vol
    const rollingVol: { date: string; reitVol: number; benchVol: number }[] = [];
    for (let i = 29; i < dailyReturns.length; i++) {
      const window = dailyReturns.slice(i - 29, i + 1);
      const bWindow = benchmarkReturns.slice(i - 29, i + 1);
      rollingVol.push({
        date: dates[i + 1],
        reitVol: stdDev(window) * Math.sqrt(TRADING_DAYS) * 100,
        benchVol: stdDev(bWindow) * Math.sqrt(TRADING_DAYS) * 100,
      });
    }

    // Histogram bins
    const binCount = 20;
    const minRet = Math.min(...dailyReturns);
    const maxRet = Math.max(...dailyReturns);
    const binWidth = (maxRet - minRet) / binCount;
    const bins: { x: number; count: number; normal: number }[] = [];
    const retMean = mean(dailyReturns);
    const retStd = stdDev(dailyReturns);

    for (let b = 0; b < binCount; b++) {
      const lo = minRet + b * binWidth;
      const hi = lo + binWidth;
      const mid = (lo + hi) / 2;
      const count = dailyReturns.filter((r) => r >= lo && (b === binCount - 1 ? r <= hi : r < hi)).length;
      // Normal PDF scaled to histogram
      const normalPdf =
        (1 / (retStd * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * ((mid - retMean) / retStd) ** 2);
      const normalCount = normalPdf * binWidth * dailyReturns.length;
      bins.push({ x: mid * 100, count, normal: normalCount });
    }

    const sk = skewness(dailyReturns);
    const kt = kurtosis(dailyReturns);

    return {
      annualizedVol: annualizedVol * 100,
      maxDD: maxDD * 100,
      maxDDIdx,
      sharpe,
      sortino,
      beta,
      var95: var95 * 100,
      cvar95: cvar95 * 100,
      var95Dollar,
      drawdowns,
      rollingVol,
      bins,
      skewness: sk,
      kurtosis: kt,
      avgRollingVol: mean(rollingVol.map((r) => r.reitVol)),
    };
  }, [prices, dailyReturns, benchmarkReturns, dates, reit]);

  // ── Drawdown chart data ─────────────────────────────────────────
  const drawdownData = useMemo(
    () =>
      metrics.drawdowns.map((dd, i) => ({
        date: dates[i],
        drawdown: dd,
      })),
    [metrics.drawdowns, dates]
  );

  // ── Peer comparison ─────────────────────────────────────────────
  const peerData = useMemo(() => {
    const currentSector = reit?.sector;
    if (!currentSector) return [];

    const peers = REGISTRY_REITS.filter((r) => r.sector === currentSector);
    return peers
      .map((peer) => {
        const peerSeed = hashTicker(peer.ticker);
        const vol = SECTOR_VOL[peer.sector] ?? 0.22;
        const p = generatePriceSeries(peer.nominalPrice, vol, TRADING_DAYS, peerSeed, 0.07);
        const bp = generatePriceSeries(100, BENCHMARK_VOL, TRADING_DAYS, peerSeed + 9999, 0.06);
        const dr: number[] = [];
        const br: number[] = [];
        for (let i = 1; i < p.length; i++) {
          dr.push(p[i] / p[i - 1] - 1);
          br.push(bp[i] / bp[i - 1] - 1);
        }
        const annRet = (p[p.length - 1] / p[0]) ** (TRADING_DAYS / (p.length - 1)) - 1;
        const annVol = stdDev(dr) * Math.sqrt(TRADING_DAYS);
        let peak = p[0];
        let mdd = 0;
        for (let i = 0; i < p.length; i++) {
          if (p[i] > peak) peak = p[i];
          const dd = (p[i] - peak) / peak;
          if (dd < mdd) mdd = dd;
        }
        const sharpe = (annRet - RISK_FREE) / annVol;
        const beta = covariance(dr, br) / variance(br);

        return {
          ticker: peer.ticker,
          vol: annVol * 100,
          maxDD: mdd * 100,
          sharpe,
          beta,
          isCurrent: peer.ticker === ticker,
        };
      })
      .sort((a, b) => b.sharpe - a.sharpe);
  }, [reit, ticker]);

  // ── Format helpers ──────────────────────────────────────────────
  const fmt = (v: number, decimals = 2) => v.toFixed(decimals);
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const fmtDollar = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${v.toFixed(0)}`;
  };

  // ── Metric card color ──────────────────────────────────────────
  const metricColor = (label: string, value: number): string => {
    if (label === 'Sharpe' || label === 'Sortino') {
      if (value > 0.8) return 'text-emerald-400';
      if (value > 0.3) return 'text-gold';
      return 'text-rose-400';
    }
    if (label === 'Max DD') {
      if (value > -10) return 'text-emerald-400';
      if (value > -20) return 'text-gold';
      return 'text-rose-400';
    }
    return 'text-lightBlue';
  };

  return (
    <div className="space-y-6">
      {/* ── A) Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="header-noe text-2xl text-slate-100 tracking-tight">
          Volatility & Drawdown{' '}
          <span className="text-lightBlue">
            — {ticker}
          </span>
        </h2>
        <span className="text-xs font-secondary text-slate-500 uppercase tracking-widest">
          {reit?.sector ?? 'Unknown'} &bull; 252-day simulation
        </span>
      </div>

      {/* ── B) Risk Metrics Row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Ann. Volatility',
            value: `${fmt(metrics.annualizedVol)}%`,
            colorLabel: 'Vol',
            raw: metrics.annualizedVol,
          },
          {
            label: 'Max Drawdown',
            value: `${fmt(metrics.maxDD)}%`,
            colorLabel: 'Max DD',
            raw: metrics.maxDD,
          },
          {
            label: 'Sharpe Ratio',
            value: fmt(metrics.sharpe),
            colorLabel: 'Sharpe',
            raw: metrics.sharpe,
          },
          {
            label: 'Sortino Ratio',
            value: fmt(metrics.sortino),
            colorLabel: 'Sortino',
            raw: metrics.sortino,
          },
          {
            label: 'Beta (vs VNQ)',
            value: fmt(metrics.beta),
            colorLabel: 'Beta',
            raw: metrics.beta,
          },
          {
            label: 'VaR 95% (Daily)',
            value: fmtDollar(metrics.var95Dollar),
            colorLabel: 'VaR',
            raw: metrics.var95,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-obsidian border border-rain/20 rounded-lg p-4 hover:border-rain/40 transition-colors"
          >
            <div className="text-[10px] font-secondary text-slate-500 uppercase tracking-widest mb-1">
              {card.label}
            </div>
            <div
              className={`text-xl font-primary font-bold ${metricColor(card.colorLabel, card.raw)}`}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── C) Drawdown Chart ──────────────────────────────────────── */}
      <div className="bg-obsidian border border-rain/20 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-secondary text-slate-400 uppercase tracking-widest">
            Drawdown from Peak
          </h3>
          <span className="text-[10px] font-secondary text-rose-400 font-bold">
            Max: {fmt(metrics.maxDD)}% on Day {metrics.maxDDIdx}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={drawdownData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={THEME.pumpkin} stopOpacity={0.1} />
                <stop offset="100%" stopColor={THEME.red} stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v: string) => v.slice(5)}
              interval={Math.floor(drawdownData.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              domain={['dataMin', 0]}
              tickFormatter={(v: number | undefined) => (v !== undefined ? `${v.toFixed(0)}%` : '')}
              reversed={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a1628',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number | undefined) =>
                value !== undefined ? [`${value.toFixed(2)}%`, 'Drawdown'] : ['—', 'Drawdown']
              }
              labelFormatter={(label: unknown) => `Date: ${label}`}
            />
            <ReferenceLine y={metrics.maxDD} stroke={THEME.red} strokeDasharray="4 4">
              {/* Max drawdown reference */}
            </ReferenceLine>
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke={THEME.pumpkin}
              fill="url(#drawdownGrad)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── D) Rolling Volatility Chart ────────────────────────────── */}
      <div className="bg-obsidian border border-rain/20 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-secondary text-slate-400 uppercase tracking-widest">
            30-Day Rolling Annualized Volatility
          </h3>
          <span className="text-[10px] font-secondary text-slate-500">
            Avg: {fmt(metrics.avgRollingVol)}%
          </span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart
            data={metrics.rollingVol}
            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v: string) => v.slice(5)}
              interval={Math.floor(metrics.rollingVol.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickFormatter={(v: number | undefined) => (v !== undefined ? `${v.toFixed(0)}%` : '')}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a1628',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number | undefined, name: string | undefined) => {
                const label = name === 'reitVol' ? ticker : 'Benchmark';
                return value !== undefined ? [`${value.toFixed(1)}%`, label] : ['—', label];
              }}
              labelFormatter={(label: unknown) => `Date: ${label}`}
            />
            <ReferenceLine
              y={metrics.avgRollingVol}
              stroke={THEME.gold}
              strokeDasharray="6 3"
              label={{
                value: `Avg ${fmt(metrics.avgRollingVol)}%`,
                position: 'right',
                fill: THEME.gold,
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="reitVol"
              stroke={THEME.lightBlue}
              strokeWidth={2}
              dot={false}
              name="reitVol"
            />
            <Line
              type="monotone"
              dataKey="benchVol"
              stroke="rgba(100,116,139,0.5)"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              name="benchVol"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-6 mt-2 px-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-lightBlue rounded" />
            <span className="text-[10px] text-slate-400 font-secondary">{ticker}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-rain/50 rounded" style={{ borderTop: '1px dashed' }} />
            <span className="text-[10px] text-slate-400 font-secondary">Benchmark (VNQ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: THEME.gold }} />
            <span className="text-[10px] text-slate-400 font-secondary">Long-term Avg</span>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Distribution + Peer Table ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── E) Return Distribution ─────────────────────────────────── */}
        <div className="bg-obsidian border border-rain/20 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-secondary text-slate-400 uppercase tracking-widest">
              Return Distribution
            </h3>
            <div className="flex gap-4">
              <span className="text-[10px] font-secondary text-slate-500">
                Skew: <span className="text-slate-300">{fmt(metrics.skewness, 3)}</span>
              </span>
              <span className="text-[10px] font-secondary text-slate-500">
                Excess Kurt: <span className="text-slate-300">{fmt(metrics.kurtosis, 3)}</span>
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={metrics.bins}
              margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 9, fill: '#64748b' }}
                tickFormatter={(v: number | undefined) =>
                  v !== undefined ? `${v.toFixed(1)}%` : ''
                }
                label={{
                  value: 'Daily Return (%)',
                  position: 'bottom',
                  offset: 0,
                  fill: '#64748b',
                  fontSize: 10,
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{
                  value: 'Frequency',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#64748b',
                  fontSize: 10,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a1628',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  const label = name === 'count' ? 'Observed' : 'Normal';
                  return value !== undefined ? [value.toFixed(1), label] : ['—', label];
                }}
                labelFormatter={(label: unknown) =>
                  `Return: ${typeof label === 'number' ? label.toFixed(2) : label}%`
                }
              />
              <ReferenceLine
                x={metrics.var95}
                stroke={THEME.red}
                strokeDasharray="4 4"
                label={{
                  value: `VaR 95%`,
                  position: 'top',
                  fill: THEME.red,
                  fontSize: 9,
                }}
              />
              <ReferenceLine
                x={metrics.cvar95}
                stroke={THEME.pumpkin}
                strokeDasharray="4 4"
                label={{
                  value: `CVaR`,
                  position: 'top',
                  fill: THEME.pumpkin,
                  fontSize: 9,
                }}
              />
              <Bar dataKey="count" fill="rgba(72,163,204,0.6)" radius={[2, 2, 0, 0]} />
              <Line
                type="monotone"
                dataKey="normal"
                stroke={THEME.gold}
                strokeWidth={2}
                dot={false}
                name="normal"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-1 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(72,163,204,0.6)' }} />
              <span className="text-[10px] text-slate-400 font-secondary">Observed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: THEME.gold }} />
              <span className="text-[10px] text-slate-400 font-secondary">Normal fit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: THEME.red, borderTop: '1px dashed' }} />
              <span className="text-[10px] text-slate-400 font-secondary">VaR / CVaR 95%</span>
            </div>
          </div>
        </div>

        {/* ── F) Risk Comparison Table ────────────────────────────────── */}
        <div className="bg-obsidian border border-rain/20 rounded-lg p-5">
          <h3 className="text-sm font-secondary text-slate-400 uppercase tracking-widest mb-4">
            Sector Peer Risk Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rain/30">
                  <th className="text-left text-[10px] font-secondary text-slate-500 uppercase tracking-widest pb-2 pr-4">
                    Ticker
                  </th>
                  <th className="text-right text-[10px] font-secondary text-slate-500 uppercase tracking-widest pb-2 px-3">
                    Vol
                  </th>
                  <th className="text-right text-[10px] font-secondary text-slate-500 uppercase tracking-widest pb-2 px-3">
                    Max DD
                  </th>
                  <th className="text-right text-[10px] font-secondary text-slate-500 uppercase tracking-widest pb-2 px-3">
                    Sharpe
                  </th>
                  <th className="text-right text-[10px] font-secondary text-slate-500 uppercase tracking-widest pb-2 pl-3">
                    Beta
                  </th>
                </tr>
              </thead>
              <tbody>
                {peerData.map((peer) => (
                  <tr
                    key={peer.ticker}
                    className={`border-b border-rain/10 transition-colors ${
                      peer.isCurrent
                        ? 'bg-lightBlue/8 border-l-2 border-l-lightBlue'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td
                      className={`py-2.5 pr-4 font-primary font-bold text-xs ${
                        peer.isCurrent ? 'text-lightBlue' : 'text-slate-300'
                      }`}
                    >
                      {peer.ticker}
                      {peer.isCurrent && (
                        <span className="ml-1.5 text-[8px] bg-lightBlue/20 text-lightBlue px-1.5 py-0.5 rounded font-secondary">
                          CURRENT
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 font-primary text-xs">
                      {fmt(peer.vol)}%
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-primary text-xs ${
                        peer.maxDD > -15 ? 'text-emerald-400' : peer.maxDD > -25 ? 'text-gold' : 'text-rose-400'
                      }`}
                    >
                      {fmt(peer.maxDD)}%
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-primary text-xs font-bold ${
                        peer.sharpe > 0.8
                          ? 'text-emerald-400'
                          : peer.sharpe > 0.3
                          ? 'text-gold'
                          : 'text-rose-400'
                      }`}
                    >
                      {fmt(peer.sharpe)}
                    </td>
                    <td className="py-2.5 pl-3 text-right text-slate-300 font-primary text-xs">
                      {fmt(peer.beta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {peerData.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-8 font-secondary">
              No sector peers available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Volatility;
