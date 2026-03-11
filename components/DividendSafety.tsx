import React, { useEffect, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getFinancials, getKPIs, getMarketDataSync, loadRealFinancials } from '../services/dataService';
import { FinancialsQuarterly, MarketDaily, REITKPIs } from '../types';
import { getInstitutionalProfile } from '../services/reitRegistry';

interface DividendSafetyProps {
  ticker: string;
}

interface SafetyRating {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  borderColor: string;
  explanation: string;
}

interface QuarterlyChartData {
  quarter: string;
  affoPerShare: number;
  dividendPerShare: number;
  payoutRatio: number;
  cushion: number;
}

interface StressRow {
  decline: string;
  declinePct: number;
  newAffoPerShare: number;
  newPayoutRatio: number;
  coverage: number;
  verdict: string;
  verdictColor: string;
}

const SECTOR_AVG_PAYOUT: Record<string, number> = {
  Industrial: 65,
  Residential: 70,
  Retail: 80,
  Office: 75,
  'Single Family Rental': 65,
  'Self-Storage': 70,
  Lodging: 60,
  'Data Centers': 70,
  Healthcare: 75,
  Towers: 65,
};

function getSafetyRating(payoutRatio: number, coverageRatio: number): SafetyRating {
  if (payoutRatio < 70 && coverageRatio > 1.4) {
    return {
      score: 5,
      label: 'Very Safe',
      color: '#34d399',
      borderColor: 'border-emerald-400',
      explanation: 'AFFO comfortably covers dividends with a wide margin of safety.',
    };
  }
  if (payoutRatio <= 80 && coverageRatio >= 1.25) {
    return {
      score: 4,
      label: 'Safe',
      color: '#4ade80',
      borderColor: 'border-green-400',
      explanation: 'Dividend is well covered by AFFO with adequate retained earnings.',
    };
  }
  if (payoutRatio <= 90 && coverageRatio >= 1.1) {
    return {
      score: 3,
      label: 'Moderate',
      color: '#fbbf24',
      borderColor: 'border-yellow-400',
      explanation: 'Payout is manageable but leaves limited cushion for earnings decline.',
    };
  }
  if (payoutRatio <= 100 && coverageRatio >= 1.0) {
    return {
      score: 2,
      label: 'At Risk',
      color: '#f97316',
      borderColor: 'border-pumpkin',
      explanation: 'Dividend consumes nearly all AFFO; vulnerable to any earnings decline.',
    };
  }
  return {
    score: 1,
    label: 'Unsafe',
    color: '#ef4444',
    borderColor: 'border-red-500',
    explanation: 'Dividend exceeds AFFO — a cut is likely unless earnings recover.',
  };
}

function formatQuarterLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth();
  const year = d.getFullYear();
  const q = month < 3 ? 'Q1' : month < 6 ? 'Q2' : month < 9 ? 'Q3' : 'Q4';
  return `${q} ${year}`;
}

function formatDollars(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

const DividendSafety: React.FC<DividendSafetyProps> = ({ ticker }) => {
  const reit = useMemo(() => REITS.find((r) => r.ticker === ticker), [ticker]);

  // Load real financials from DB in background on mount / ticker change
  useEffect(() => {
    if (reit) {
      loadRealFinancials(reit.id);
    }
  }, [reit]);

  const financials = useMemo(() => {
    if (!reit) return [];
    return getFinancials(reit.id);
  }, [reit]);

  const marketData = useMemo(() => {
    if (!reit) return [];
    return getMarketDataSync(reit.id);
  }, [reit]);

  const kpis = useMemo(() => {
    if (!reit) return [];
    return getKPIs(reit.id);
  }, [reit]);

  const profile = useMemo(() => getInstitutionalProfile(ticker), [ticker]);

  const calculations = useMemo(() => {
    if (financials.length < 4 || marketData.length === 0) return null;

    const last4 = financials.slice(-4);

    // TTM AFFO = sum of last 4 quarters (ffo - straightLineRent - maintenanceCapex)
    const ttmAffo = last4.reduce(
      (sum, q) => sum + (q.ffo - q.straightLineRent - q.maintenanceCapex),
      0,
    );

    // TTM Dividends = sum of last 4 quarters dividendsPaid * dilutedShares
    // dividendsPaid is per share in the mock data
    const ttmDividends = last4.reduce(
      (sum, q) => sum + q.dividendsPaid * q.dilutedShares,
      0,
    );

    // AFFO Payout Ratio
    const payoutRatio = ttmAffo > 0 ? (ttmDividends / ttmAffo) * 100 : 999;

    // Dividend Coverage Ratio
    const coverageRatio = ttmDividends > 0 ? ttmAffo / ttmDividends : 0;

    // Dividend Per Share (annualized)
    const latestQ = financials[financials.length - 1];
    const annualizedDPS = latestQ.dividendsPaid * 4;

    // Dividend Yield
    const dividendYield = marketData[0].dividendYield;

    // Free Cash Flow After Dividends
    const retainedAffo = ttmAffo - ttmDividends;

    // AFFO per share (TTM)
    const affoPerShare = ttmAffo / latestQ.dilutedShares;

    return {
      ttmAffo,
      ttmDividends,
      payoutRatio,
      coverageRatio,
      annualizedDPS,
      dividendYield,
      retainedAffo,
      affoPerShare,
      dilutedShares: latestQ.dilutedShares,
    };
  }, [financials, marketData]);

  const safetyRating = useMemo(() => {
    if (!calculations) return getSafetyRating(100, 1.0);
    return getSafetyRating(calculations.payoutRatio, calculations.coverageRatio);
  }, [calculations]);

  // Quarterly chart data
  const chartData = useMemo((): QuarterlyChartData[] => {
    return financials.map((q) => {
      const qAffo = q.ffo - q.straightLineRent - q.maintenanceCapex;
      const affoPS = qAffo / q.dilutedShares;
      const divPS = q.dividendsPaid;
      const payout = affoPS > 0 ? (divPS / affoPS) * 100 : 0;
      const cushion = Math.max(0, affoPS - divPS);

      return {
        quarter: formatQuarterLabel(q.periodEndDate),
        affoPerShare: parseFloat(affoPS.toFixed(3)),
        dividendPerShare: parseFloat(divPS.toFixed(3)),
        payoutRatio: parseFloat(payout.toFixed(1)),
        cushion: parseFloat(cushion.toFixed(3)),
      };
    });
  }, [financials]);

  // Stress test data
  const stressData = useMemo((): StressRow[] => {
    if (!calculations) return [];
    const declines = [-5, -10, -15, -20, -25];

    return declines.map((pct) => {
      const factor = 1 + pct / 100;
      const newAffo = calculations.ttmAffo * factor;
      const newAffoPS = newAffo / calculations.dilutedShares;
      const newPayout = calculations.ttmDividends > 0 ? (calculations.ttmDividends / newAffo) * 100 : 999;
      const newCoverage = calculations.ttmDividends > 0 ? newAffo / calculations.ttmDividends : 0;

      let verdict: string;
      let verdictColor: string;
      if (newPayout < 85) {
        verdict = 'Safe';
        verdictColor = 'text-emerald-400';
      } else if (newPayout < 95) {
        verdict = 'Manageable';
        verdictColor = 'text-yellow-400';
      } else if (newPayout < 105) {
        verdict = 'At Risk';
        verdictColor = 'text-orange-400';
      } else {
        verdict = 'Cut Likely';
        verdictColor = 'text-red-400';
      }

      return {
        decline: `${pct}%`,
        declinePct: pct,
        newAffoPerShare: parseFloat(newAffoPS.toFixed(2)),
        newPayoutRatio: parseFloat(newPayout.toFixed(1)),
        coverage: parseFloat(newCoverage.toFixed(2)),
        verdict,
        verdictColor,
      };
    });
  }, [calculations]);

  // Sector average payout
  const sectorAvgPayout = useMemo(() => {
    if (!reit) return 70;
    return SECTOR_AVG_PAYOUT[reit.sector] ?? 70;
  }, [reit]);

  const sectorDelta = useMemo(() => {
    if (!calculations) return 0;
    return Math.round((calculations.payoutRatio - sectorAvgPayout) * 100);
  }, [calculations, sectorAvgPayout]);

  if (!reit || !calculations) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 font-secondary">
        No data available for {ticker}.
      </div>
    );
  }

  const payoutColor =
    calculations.payoutRatio < 70
      ? 'text-emerald-400'
      : calculations.payoutRatio < 80
        ? 'text-green-400'
        : calculations.payoutRatio < 90
          ? 'text-yellow-400'
          : calculations.payoutRatio < 100
            ? 'text-orange-400'
            : 'text-red-400';

  const coverageColor =
    calculations.coverageRatio > 1.4
      ? 'text-emerald-400'
      : calculations.coverageRatio > 1.25
        ? 'text-green-400'
        : calculations.coverageRatio > 1.1
          ? 'text-yellow-400'
          : calculations.coverageRatio > 1.0
            ? 'text-orange-400'
            : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* A) Safety Score Banner */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-6 flex items-center gap-8">
        <div
          className={`flex-shrink-0 w-28 h-28 rounded-full border-4 ${safetyRating.borderColor} flex flex-col items-center justify-center`}
          style={{ borderColor: safetyRating.color }}
        >
          <span className="text-4xl font-bold font-primary" style={{ color: safetyRating.color }}>
            {safetyRating.score}
          </span>
          <span className="text-xs text-slate-400 font-secondary mt-0.5">of 5</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold font-primary text-slate-100">Dividend Safety</h2>
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold font-secondary"
              style={{ backgroundColor: `${safetyRating.color}20`, color: safetyRating.color }}
            >
              {safetyRating.label}
            </span>
          </div>
          <p className="text-slate-400 font-secondary text-sm">{safetyRating.explanation}</p>
          <p className="text-slate-500 font-secondary text-xs mt-1">
            Based on {ticker} trailing twelve-month AFFO payout ratio of{' '}
            {calculations.payoutRatio.toFixed(1)}% and coverage of {calculations.coverageRatio.toFixed(2)}x.
          </p>
        </div>
      </div>

      {/* B) Key Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-5 text-center">
          <div className={`text-3xl font-bold font-primary ${payoutColor}`}>
            {calculations.payoutRatio.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 font-secondary mt-1">AFFO Payout Ratio</div>
        </div>
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-5 text-center">
          <div className={`text-3xl font-bold font-primary ${coverageColor}`}>
            {calculations.coverageRatio.toFixed(2)}x
          </div>
          <div className="text-xs text-slate-400 font-secondary mt-1">Dividend Coverage</div>
        </div>
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold font-primary text-slate-100">
            ${calculations.annualizedDPS.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 font-secondary mt-1">Annualized Dividend/Sh</div>
        </div>
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold font-primary text-lightBlue">
            {calculations.dividendYield.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-400 font-secondary mt-1">Current Yield</div>
        </div>
      </div>

      {/* C & D) Payout Trend Chart + Dividend Profile */}
      <div className="grid grid-cols-5 gap-4">
        {/* C) Payout Trend Chart (left 60%) */}
        <div className="col-span-3 bg-darkBlue/30 border border-rain/10 rounded-lg p-5">
          <h3 className="text-lg font-semibold font-primary text-slate-200 mb-4">
            Quarterly Payout Trend
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="quarter"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                label={{
                  value: '$/Share',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#64748b',
                  fontSize: 11,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 140]}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                label={{
                  value: 'Payout %',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#64748b',
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1d32',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <ReferenceLine
                yAxisId="right"
                y={100}
                stroke="#ef4444"
                strokeDasharray="6 3"
                label={{ value: '100% Payout', fill: '#ef4444', fontSize: 10, position: 'right' }}
              />
              <Area
                yAxisId="left"
                dataKey="cushion"
                fill="#34d39930"
                stroke="none"
                name="Cushion (AFFO - Div)"
              />
              <Bar
                yAxisId="left"
                dataKey="affoPerShare"
                fill="#38bdf8"
                name="AFFO/Share"
                barSize={20}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="dividendPerShare"
                fill="#f97316"
                name="Dividend/Share"
                barSize={20}
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="right"
                dataKey="payoutRatio"
                stroke="#fbbf24"
                strokeDasharray="6 3"
                strokeWidth={2}
                dot={{ fill: '#fbbf24', r: 3 }}
                name="Payout Ratio %"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* D) Dividend Profile (right 40%) */}
        <div className="col-span-2 bg-darkBlue/30 border border-rain/10 rounded-lg p-5">
          <h3 className="text-lg font-semibold font-primary text-slate-200 mb-4">
            Dividend Profile
          </h3>
          <div className="space-y-4">
            <ProfileRow
              label="Est. Annual Dividend"
              value={`$${calculations.annualizedDPS.toFixed(2)}/share`}
            />
            <ProfileRow
              label="Est. Dividend Yield"
              value={`${calculations.dividendYield.toFixed(1)}%`}
            />
            <ProfileRow
              label="AFFO Payout Ratio"
              value={`${calculations.payoutRatio.toFixed(1)}%`}
              valueClass={payoutColor}
            />
            <ProfileRow
              label="Retained AFFO (after div)"
              value={formatDollars(calculations.retainedAffo)}
              valueClass={calculations.retainedAffo > 0 ? 'text-emerald-400' : 'text-red-400'}
            />

            <div className="border-t border-rain/10 pt-4 mt-4">
              <ProfileRow
                label="Sector Average Payout"
                value={`${sectorAvgPayout}%`}
                sublabel={reit.sector}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-400 font-secondary">vs Sector</span>
                <span
                  className={`text-sm font-semibold font-primary ${
                    sectorDelta <= 0 ? 'text-emerald-400' : sectorDelta <= 500 ? 'text-yellow-400' : 'text-red-400'
                  }`}
                >
                  {Math.abs(sectorDelta)} bps {sectorDelta > 0 ? 'above' : 'below'} sector average
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* E) Stress Test Table */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-5">
        <h3 className="text-lg font-semibold font-primary text-slate-200 mb-1">
          Stress Test: What if AFFO Drops?
        </h3>
        <p className="text-xs text-slate-500 font-secondary mb-4">
          Sensitivity analysis assuming current dividend is maintained while AFFO declines.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rain/10">
                <th className="text-left py-2 px-3 text-slate-400 font-secondary font-medium">
                  AFFO Decline
                </th>
                <th className="text-right py-2 px-3 text-slate-400 font-secondary font-medium">
                  New AFFO/Share
                </th>
                <th className="text-right py-2 px-3 text-slate-400 font-secondary font-medium">
                  New Payout Ratio
                </th>
                <th className="text-right py-2 px-3 text-slate-400 font-secondary font-medium">
                  Coverage
                </th>
                <th className="text-right py-2 px-3 text-slate-400 font-secondary font-medium">
                  Verdict
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Current baseline row */}
              <tr className="border-b border-rain/5">
                <td className="py-2.5 px-3 text-slate-300 font-secondary">Baseline (0%)</td>
                <td className="py-2.5 px-3 text-right text-slate-200 font-primary">
                  ${calculations.affoPerShare.toFixed(2)}
                </td>
                <td className={`py-2.5 px-3 text-right font-primary ${payoutColor}`}>
                  {calculations.payoutRatio.toFixed(1)}%
                </td>
                <td className={`py-2.5 px-3 text-right font-primary ${coverageColor}`}>
                  {calculations.coverageRatio.toFixed(2)}x
                </td>
                <td className="py-2.5 px-3 text-right font-semibold font-primary" style={{ color: safetyRating.color }}>
                  {safetyRating.label}
                </td>
              </tr>
              {stressData.map((row) => (
                <tr key={row.decline} className="border-b border-rain/5 hover:bg-rain/5 transition-colors">
                  <td className="py-2.5 px-3 text-slate-300 font-secondary">{row.decline}</td>
                  <td className="py-2.5 px-3 text-right text-slate-200 font-primary">
                    ${row.newAffoPerShare.toFixed(2)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-primary ${
                      row.newPayoutRatio < 85
                        ? 'text-emerald-400'
                        : row.newPayoutRatio < 95
                          ? 'text-yellow-400'
                          : row.newPayoutRatio < 105
                            ? 'text-orange-400'
                            : 'text-red-400'
                    }`}
                  >
                    {row.newPayoutRatio.toFixed(1)}%
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-primary ${
                      row.coverage > 1.25
                        ? 'text-emerald-400'
                        : row.coverage > 1.05
                          ? 'text-yellow-400'
                          : row.coverage > 0.95
                            ? 'text-orange-400'
                            : 'text-red-400'
                    }`}
                  >
                    {row.coverage.toFixed(2)}x
                  </td>
                  <td className={`py-2.5 px-3 text-right font-semibold font-primary ${row.verdictColor}`}>
                    {row.verdict}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function ProfileRow({
  label,
  value,
  sublabel,
  valueClass = 'text-slate-100',
}: {
  label: string;
  value: string;
  sublabel?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm text-slate-400 font-secondary">{label}</span>
        {sublabel && (
          <span className="text-xs text-slate-500 font-secondary ml-1">({sublabel})</span>
        )}
      </div>
      <span className={`text-sm font-semibold font-primary ${valueClass}`}>{value}</span>
    </div>
  );
}

export default DividendSafety;
