
import React, { useEffect, useMemo, useState } from 'react';
import { FinancialsQuarterly, MarketDaily } from '../types';
import { REITS } from '../services/mockData';
import { getFinancials, loadRealFinancials, getMarketDataSync } from '../services/dataService';
import { getInstitutionalProfile } from '../services/reitRegistry';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface NAVModelProps {
  ticker: string;
}

interface SensitivityRow {
  capRate: number;
  gav: number;
  nav: number;
  navPerShare: number;
  premDisc: number;
}

// Approximate sector P/NAV averages (institutional consensus)
const SECTOR_NAV_PREMIUMS: Record<string, number> = {
  Industrial: -5,
  Office: -25,
  Residential: -2,
  Retail: -15,
  'REIT Avg': -10,
};

const formatM = (v: number): string => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
};

const formatPct = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

const NAVModel: React.FC<NAVModelProps> = ({ ticker }) => {
  const reit = REITS.find((r) => r.ticker === ticker)!;
  const profile = getInstitutionalProfile(ticker);

  // Load real financials from DB in background on mount / ticker change
  useEffect(() => {
    loadRealFinancials(reit.id);
  }, [reit.id]);

  const financials: FinancialsQuarterly[] = useMemo(
    () => getFinancials(reit.id),
    [reit.id]
  );
  const marketData: MarketDaily[] = useMemo(
    () => getMarketDataSync(reit.id),
    [reit.id]
  );

  const [capRate, setCapRate] = useState<number>(profile.baselineCapRate * 100);

  // ── Core NAV Calculation ──────────────────────────────────────────────────
  const ttmNOI = useMemo(
    () => financials.slice(-4).reduce((acc, f) => acc + f.noi, 0),
    [financials]
  );

  const latestFin = financials[financials.length - 1];
  const totalDebt = latestFin.totalDebt;
  const dilutedShares = latestFin.dilutedShares;
  const currentPrice = marketData[0].closePrice;

  const capRateDecimal = capRate / 100;
  const gav = ttmNOI / capRateDecimal;
  const nav = gav - totalDebt;
  const navPerShare = nav / dilutedShares;
  const premDisc = (currentPrice / navPerShare - 1) * 100;

  // ── NAV Waterfall Data ────────────────────────────────────────────────────
  const waterfallData = useMemo(
    () => [
      { name: 'Gross Asset Value', value: gav / 1e6, color: '#34d399' },
      { name: 'Less: Total Debt', value: -(totalDebt / 1e6), color: '#f87171' },
      { name: 'Net Asset Value', value: nav / 1e6, color: '#60a5fa' },
    ],
    [gav, totalDebt, nav]
  );

  // ── Sensitivity Table ─────────────────────────────────────────────────────
  const sensitivityRows: SensitivityRow[] = useMemo(() => {
    const steps: number[] = [];
    for (let bps = -150; bps <= 150; bps += 25) {
      steps.push(bps);
    }
    return steps.map((bps) => {
      const cr = capRate + bps / 100;
      const crDec = cr / 100;
      const rowGav = ttmNOI / crDec;
      const rowNav = rowGav - totalDebt;
      const rowNavPerShare = rowNav / dilutedShares;
      const rowPremDisc = (currentPrice / rowNavPerShare - 1) * 100;
      return {
        capRate: cr,
        gav: rowGav / 1e6,
        nav: rowNav / 1e6,
        navPerShare: rowNavPerShare,
        premDisc: rowPremDisc,
      };
    });
  }, [capRate, ttmNOI, totalDebt, dilutedShares, currentPrice]);

  // ── P/NAV Context Bars ────────────────────────────────────────────────────
  const pnavContextData = useMemo(() => {
    const currentPremDisc = premDisc;
    const sectorKey = reit.sector as string;
    const sectorAvg = SECTOR_NAV_PREMIUMS[sectorKey] ?? -10;
    return [
      { name: ticker, value: currentPremDisc },
      { name: `${reit.sector} Avg`, value: sectorAvg },
      { name: 'Industrial Avg', value: SECTOR_NAV_PREMIUMS['Industrial'] },
      { name: 'Office Avg', value: SECTOR_NAV_PREMIUMS['Office'] },
      { name: 'REIT Avg', value: SECTOR_NAV_PREMIUMS['REIT Avg'] },
    ];
  }, [premDisc, ticker, reit.sector]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* A) Header */}
      <div className="flex items-center gap-4">
        <h2 className="header-noe text-2xl text-slate-100">
          Bottoms-Up NAV Model
        </h2>
        <span className="px-3 py-1 rounded-full bg-lightBlue/20 text-lightBlue text-sm font-semibold tracking-wide">
          {ticker}
        </span>
      </div>

      {/* B) + C) NAV Waterfall + Assumptions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* B) NAV Waterfall (60%) */}
        <div className="lg:col-span-3 bg-darkBlue/30 border border-rain/10 rounded-lg p-6">
          <h3 className="font-secondary text-sm text-rain uppercase tracking-widest mb-4">
            NAV Bridge
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={waterfallData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.08)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatM(Math.abs(v))}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fill: '#cbd5e1', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1d32',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number | undefined) => [
                    formatM(Math.abs(value ?? 0)),
                    '',
                  ]}
                  labelStyle={{ color: '#cbd5e1' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <span className="text-rain text-xs uppercase tracking-widest">
              NAV Per Share
            </span>
            <div className="header-noe text-3xl text-slate-100 mt-1">
              ${navPerShare.toFixed(2)}
            </div>
          </div>
        </div>

        {/* C) Assumptions Panel (40%) */}
        <div className="lg:col-span-2 bg-darkBlue/30 border border-rain/10 rounded-lg p-6">
          <h3 className="font-secondary text-sm text-rain uppercase tracking-widest mb-5">
            Assumptions & Output
          </h3>

          {/* Cap Rate Slider */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-300 text-sm font-primary">
                Cap Rate
              </span>
              <span className="text-lightBlue font-semibold text-sm">
                {capRate.toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min={3.0}
              max={10.0}
              step={0.1}
              value={capRate}
              onChange={(e) => setCapRate(parseFloat(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-lightBlue bg-rain/20"
            />
            <div className="flex justify-between text-[10px] text-rain mt-1">
              <span>3.0%</span>
              <span>10.0%</span>
            </div>
          </div>

          {/* Derived Metrics */}
          <div className="space-y-3">
            <MetricRow
              label="TTM NOI"
              value={formatM(ttmNOI / 1e6)}
            />
            <MetricRow
              label="Gross Asset Value"
              value={formatM(gav / 1e6)}
            />
            <MetricRow
              label="Total Debt"
              value={formatM(totalDebt / 1e6)}
            />
            <div className="border-t border-rain/10 pt-2">
              <MetricRow
                label="Net Asset Value"
                value={formatM(nav / 1e6)}
                bold
              />
            </div>
            <MetricRow
              label="Shares Outstanding"
              value={`${dilutedShares.toFixed(0)}M`}
            />
            <MetricRow
              label="NAV / Share"
              value={`$${navPerShare.toFixed(2)}`}
              bold
            />
            <MetricRow
              label="Current Price"
              value={`$${currentPrice.toFixed(2)}`}
            />
            <div className="border-t border-rain/10 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 text-sm font-primary">
                  Premium / (Discount)
                </span>
                <span
                  className={`header-noe text-xl ${
                    premDisc < 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {formatPct(premDisc)}
                </span>
              </div>
              <p className="text-[10px] text-rain mt-1">
                {premDisc < 0
                  ? 'Trading at a discount to NAV (potential value)'
                  : 'Trading at a premium to NAV'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* D) Cap Rate Sensitivity Table */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-6">
        <h3 className="font-secondary text-sm text-rain uppercase tracking-widest mb-4">
          Cap Rate Sensitivity
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rain/10">
                <th className="text-left py-2 px-3 text-rain font-secondary text-xs uppercase tracking-wider">
                  Cap Rate
                </th>
                <th className="text-right py-2 px-3 text-rain font-secondary text-xs uppercase tracking-wider">
                  GAV ($M)
                </th>
                <th className="text-right py-2 px-3 text-rain font-secondary text-xs uppercase tracking-wider">
                  NAV ($M)
                </th>
                <th className="text-right py-2 px-3 text-rain font-secondary text-xs uppercase tracking-wider">
                  NAV/Share
                </th>
                <th className="text-right py-2 px-3 text-rain font-secondary text-xs uppercase tracking-wider">
                  Prem/(Disc)
                </th>
              </tr>
            </thead>
            <tbody>
              {sensitivityRows.map((row) => {
                const isSelected =
                  Math.abs(row.capRate - capRate) < 0.01;
                return (
                  <tr
                    key={row.capRate.toFixed(2)}
                    className={`border-b border-rain/5 transition-colors ${
                      isSelected
                        ? 'bg-lightBlue/10 border-lightBlue/20'
                        : 'hover:bg-darkBlue/40'
                    }`}
                  >
                    <td
                      className={`py-2 px-3 ${
                        isSelected
                          ? 'text-lightBlue font-semibold'
                          : 'text-slate-300'
                      }`}
                    >
                      {row.capRate.toFixed(2)}%
                      {isSelected && (
                        <span className="ml-2 text-[10px] text-lightBlue/60">
                          &#9668;
                        </span>
                      )}
                    </td>
                    <td className="text-right py-2 px-3 text-slate-300 tabular-nums">
                      {formatM(row.gav)}
                    </td>
                    <td className="text-right py-2 px-3 text-slate-300 tabular-nums">
                      {formatM(row.nav)}
                    </td>
                    <td
                      className={`text-right py-2 px-3 tabular-nums ${
                        isSelected
                          ? 'text-slate-100 font-semibold'
                          : 'text-slate-300'
                      }`}
                    >
                      ${row.navPerShare.toFixed(2)}
                    </td>
                    <td
                      className={`text-right py-2 px-3 font-semibold tabular-nums ${
                        row.premDisc < 0
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}
                    >
                      {formatPct(row.premDisc)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* E) Historical P/NAV Context */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-6">
        <h3 className="font-secondary text-sm text-rain uppercase tracking-widest mb-4">
          P/NAV Context — Where REITs Trade vs NAV
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={pnavContextData}
              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.08)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(148,163,184,0.15)' }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1d32',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'P/NAV']}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {pnavContextData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      index === 0
                        ? premDisc < 0
                          ? '#34d399'
                          : '#f87171'
                        : '#64748b'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-rain mt-2 text-center">
          Negative = discount to NAV (potential value) | Positive = premium to NAV
        </p>
      </div>
    </div>
  );
};

// ── Helper sub-component ──────────────────────────────────────────────────
interface MetricRowProps {
  label: string;
  value: string;
  bold?: boolean;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, bold }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-400 text-sm font-primary">{label}</span>
    <span
      className={`text-slate-200 tabular-nums ${
        bold ? 'font-semibold text-base' : 'text-sm'
      }`}
    >
      {value}
    </span>
  </div>
);

export default NAVModel;
