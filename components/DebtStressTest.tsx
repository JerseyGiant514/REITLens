import React, { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getFinancials, getDebtMaturitySchedule, loadRealFinancials } from '../services/dataService';
import type { FinancialsQuarterly } from '../types';
import { getInstitutionalProfile } from '../services/reitRegistry';

interface DebtStressTestProps {
  ticker: string;
}

const DebtStressTest: React.FC<DebtStressTestProps> = ({ ticker }) => {
  const reit = useMemo(() => REITS.find((r) => r.ticker === ticker), [ticker]);
  const profile = useMemo(() => getInstitutionalProfile(ticker), [ticker]);

  // Load real financials from DB in background on mount / ticker change
  useEffect(() => {
    if (reit) {
      loadRealFinancials(reit.id);
    }
  }, [reit]);

  const financials = useMemo(() => {
    if (!reit) return [] as FinancialsQuarterly[];
    return getFinancials(reit.id);
  }, [reit]);

  const maturities = useMemo(() => {
    if (!reit) return [] as { year: number; reitId: string; amount: number }[];
    return getDebtMaturitySchedule(ticker);
  }, [reit, ticker]);

  // Current debt profile
  const debtProfile = useMemo(() => {
    if (financials.length === 0) {
      return {
        totalDebt: 0,
        avgRate: 4.5,
        ttmInterest: 0,
        interestCoverage: 0,
        sharesOutstanding: 1,
        ebitdare: 0,
      };
    }
    const ttmQuarters = financials.slice(-4);
    const latest = financials[financials.length - 1];
    const totalDebt = latest.totalDebt;
    const ttmInterest = ttmQuarters.reduce((sum, q) => sum + q.interestExpense, 0);
    const ttmEbitdare = ttmQuarters.reduce((sum, q) => sum + q.ebitdare, 0);
    const avgRate = totalDebt > 0 ? (ttmInterest / totalDebt) * 100 : 4.5;
    const interestCoverage = ttmInterest > 0 ? ttmEbitdare / ttmInterest : 0;
    const sharesOutstanding = latest.dilutedShares || reit?.sharesOutstanding || 1;

    return {
      totalDebt,
      avgRate,
      ttmInterest,
      interestCoverage,
      sharesOutstanding,
      ebitdare: ttmEbitdare,
    };
  }, [financials, reit]);

  const defaultRate = Math.round((debtProfile.avgRate + 0.5) * 4) / 4;
  const [newRate, setNewRate] = useState<number>(defaultRate);

  // Spread scenario columns: -100, -50, 0, +50, +100, +150, +200 bps
  const spreadBps = [-100, -50, 0, 50, 100, 150, 200];

  const totalMaturing = useMemo(
    () => maturities.reduce((sum, m) => sum + m.amount, 0),
    [maturities]
  );

  // Maturity table rows
  const maturityRows = useMemo(() => {
    let cumulativeDelta = 0;
    return maturities.map((m) => {
      const pctOfTotal = debtProfile.totalDebt > 0 ? (m.amount / debtProfile.totalDebt) * 100 : 0;
      const oldCost = m.amount * (debtProfile.avgRate / 100);
      const newCost = m.amount * (newRate / 100);
      const delta = newCost - oldCost;
      cumulativeDelta += delta;
      const affoImpact = cumulativeDelta / debtProfile.sharesOutstanding;
      return {
        year: m.year,
        amount: m.amount,
        pctOfTotal,
        oldCost,
        newCost,
        delta,
        cumulativeDelta,
        affoImpact,
      };
    });
  }, [maturities, newRate, debtProfile]);

  // Total row
  const totalRow = useMemo(() => {
    if (maturityRows.length === 0) return null;
    const last = maturityRows[maturityRows.length - 1];
    const totalOldCost = maturityRows.reduce((s, r) => s + r.oldCost, 0);
    const totalNewCost = maturityRows.reduce((s, r) => s + r.newCost, 0);
    const totalDelta = totalNewCost - totalOldCost;
    return {
      amount: totalMaturing,
      pctOfTotal: debtProfile.totalDebt > 0 ? (totalMaturing / debtProfile.totalDebt) * 100 : 0,
      oldCost: totalOldCost,
      newCost: totalNewCost,
      delta: totalDelta,
      affoImpact: last.affoImpact,
    };
  }, [maturityRows, totalMaturing, debtProfile]);

  // Rate sensitivity matrix
  const sensitivityMatrix = useMemo(() => {
    return maturities.map((m) => {
      const row: Record<string, number | string> = { year: m.year };
      spreadBps.forEach((bps) => {
        const rate = newRate + bps / 100;
        const oldCost = m.amount * (debtProfile.avgRate / 100);
        const newCost = m.amount * (rate / 100);
        const delta = newCost - oldCost;
        const impact = delta / debtProfile.sharesOutstanding;
        row[`bps_${bps}`] = impact;
      });
      return row;
    });
  }, [maturities, newRate, debtProfile, spreadBps]);

  // Chart data
  const chartData = useMemo(() => {
    let cumulative = 0;
    // Calculate running coverage
    let runningInterest = debtProfile.ttmInterest;
    return maturityRows.map((r) => {
      cumulative += r.delta;
      // Update running interest: old debt at old rate replaced with new rate
      runningInterest += r.delta;
      const coverage = runningInterest > 0 ? debtProfile.ebitdare / runningInterest : 0;
      return {
        year: r.year,
        cumulativeAffo: cumulative / debtProfile.sharesOutstanding,
        coverage,
      };
    });
  }, [maturityRows, debtProfile]);

  // Stress scenario summary
  const scenarios = useMemo(() => {
    const calcScenario = (rateAdj: number, label: string) => {
      const scenarioRate = debtProfile.avgRate + rateAdj;
      let totalDelta = 0;
      maturities.forEach((m) => {
        const oldCost = m.amount * (debtProfile.avgRate / 100);
        const newCost = m.amount * (scenarioRate / 100);
        totalDelta += newCost - oldCost;
      });
      const newInterest = debtProfile.ttmInterest + totalDelta;
      const newCoverage = newInterest > 0 ? debtProfile.ebitdare / newInterest : 0;
      const affoImpact = totalDelta / debtProfile.sharesOutstanding;
      return {
        label,
        rate: scenarioRate,
        newInterest,
        newCoverage,
        affoImpact,
      };
    };
    return [
      calcScenario(-0.5, 'Benign'),
      calcScenario(0, 'Base'),
      calcScenario(2.0, 'Stress'),
    ];
  }, [maturities, debtProfile]);

  const fmt = (val: number, decimals = 1) => val.toFixed(decimals);
  const fmtM = (val: number) => `$${(val / 1_000_000).toFixed(0)}M`;
  const fmtMDec = (val: number) => `$${(val / 1_000_000).toFixed(1)}M`;

  const scenarioBorderColors = [
    'border-emerald-500/40',
    'border-lightBlue/40',
    'border-red-500/40',
  ];
  const scenarioTextColors = ['text-emerald-400', 'text-lightBlue', 'text-red-400'];

  if (!reit) {
    return (
      <div className="p-6 text-slate-400 font-secondary">
        REIT not found for ticker: {ticker}
      </div>
    );
  }

  return (
    <div className="flex gap-4 font-secondary text-slate-200">
      {/* Main content */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <h2 className="header-noe text-xl text-slate-100">
          Debt Refinancing Stress Test — {ticker}
        </h2>

        {/* Current Debt Profile Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Debt', value: fmtM(debtProfile.totalDebt) },
            { label: 'Wtd Avg Rate', value: `${fmt(debtProfile.avgRate, 2)}%` },
            { label: 'TTM Interest Expense', value: fmtM(debtProfile.ttmInterest) },
            { label: 'Interest Coverage', value: `${fmt(debtProfile.interestCoverage, 2)}x` },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-darkBlue/30 border border-rain/10 rounded-lg p-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                {card.label}
              </div>
              <div className="text-lg font-primary font-semibold text-slate-100">
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* New Rate Slider */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <label className="text-[11px] uppercase tracking-wider text-slate-400 whitespace-nowrap">
              New Debt Rate
            </label>
            <input
              type="range"
              min={3}
              max={9}
              step={0.25}
              value={newRate}
              onChange={(e) => setNewRate(parseFloat(e.target.value))}
              className="flex-1 accent-lightBlue"
            />
            <span className="text-sm font-primary font-semibold text-lightBlue min-w-[4rem] text-right">
              {fmt(newRate, 2)}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1 px-1">
            <span>3.00%</span>
            <span>6.00%</span>
            <span>9.00%</span>
          </div>
        </div>

        {/* Maturity Schedule Table */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-rain/10">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Maturity Schedule with Refi Impact
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-obsidian/50 sticky top-0">
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Year</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Maturing</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">% of Total</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Old Cost</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">New Cost</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Delta</th>
                  <th className="text-right px-3 py-2 text-slate-500 font-medium">
                    Cum. AFFO/Shr
                  </th>
                </tr>
              </thead>
              <tbody>
                {maturityRows.map((row) => (
                  <tr key={row.year} className="border-t border-rain/5 hover:bg-rain/5">
                    <td className="px-3 py-1.5 font-medium text-slate-300">{row.year}</td>
                    <td className="px-3 py-1.5 text-right text-slate-300">
                      {fmtMDec(row.amount)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-400">
                      {fmt(row.pctOfTotal)}%
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-400">
                      {fmtMDec(row.oldCost)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-300">
                      {fmtMDec(row.newCost)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-medium ${
                        row.delta < 0 ? 'text-emerald-400' : row.delta > 0 ? 'text-red-400' : 'text-slate-400'
                      }`}
                    >
                      {row.delta >= 0 ? '+' : ''}
                      {fmtMDec(row.delta)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-medium ${
                        row.affoImpact < 0
                          ? 'text-emerald-400'
                          : row.affoImpact > 0
                            ? 'text-red-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {row.affoImpact >= 0 ? '+' : ''}${fmt(row.affoImpact, 3)}
                    </td>
                  </tr>
                ))}
                {totalRow && (
                  <tr className="border-t-2 border-rain/20 bg-obsidian/30 font-semibold">
                    <td className="px-3 py-2 text-slate-200">TOTAL</td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {fmtMDec(totalRow.amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {fmt(totalRow.pctOfTotal)}%
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {fmtMDec(totalRow.oldCost)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {fmtMDec(totalRow.newCost)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        totalRow.delta < 0 ? 'text-emerald-400' : totalRow.delta > 0 ? 'text-red-400' : 'text-slate-400'
                      }`}
                    >
                      {totalRow.delta >= 0 ? '+' : ''}
                      {fmtMDec(totalRow.delta)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${
                        totalRow.affoImpact < 0
                          ? 'text-emerald-400'
                          : totalRow.affoImpact > 0
                            ? 'text-red-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {totalRow.affoImpact >= 0 ? '+' : ''}${fmt(totalRow.affoImpact, 3)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rate Sensitivity Matrix */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-rain/10">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Rate Sensitivity Matrix — AFFO/Share Impact
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-obsidian/50 sticky top-0">
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Year</th>
                  {spreadBps.map((bps) => {
                    const rate = newRate + bps / 100;
                    const isSelected = bps === 0;
                    return (
                      <th
                        key={bps}
                        className={`text-right px-2 py-2 font-medium ${
                          isSelected
                            ? 'text-lightBlue bg-lightBlue/5'
                            : 'text-slate-500'
                        }`}
                      >
                        <div>{fmt(rate, 2)}%</div>
                        <div className="text-[9px] opacity-60">
                          {bps >= 0 ? '+' : ''}
                          {bps}bp
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sensitivityMatrix.map((row) => (
                  <tr key={row.year as number} className="border-t border-rain/5 hover:bg-rain/5">
                    <td className="px-3 py-1.5 font-medium text-slate-300">
                      {row.year as number}
                    </td>
                    {spreadBps.map((bps) => {
                      const val = row[`bps_${bps}`] as number;
                      const isSelected = bps === 0;
                      return (
                        <td
                          key={bps}
                          className={`px-2 py-1.5 text-right font-mono ${
                            isSelected ? 'bg-lightBlue/5' : ''
                          } ${
                            val < -0.001
                              ? 'text-emerald-400'
                              : val > 0.001
                                ? 'text-red-400'
                                : 'text-slate-500'
                          }`}
                        >
                          {val >= 0 ? '+' : ''}
                          {fmt(val, 3)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cumulative Refi Impact Chart */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
            Cumulative Refinancing Impact
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="year"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
              />
              <YAxis
                yAxisId="affo"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                label={{
                  value: 'AFFO/Shr Impact',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#64748b',
                  fontSize: 10,
                }}
              />
              <YAxis
                yAxisId="coverage"
                orientation="right"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#334155' }}
                tickFormatter={(v: number) => `${v.toFixed(1)}x`}
                label={{
                  value: 'Coverage',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#64748b',
                  fontSize: 10,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1d32',
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#e2e8f0',
                }}
                formatter={(value: number | undefined, name?: string) => {
                  if (value === undefined) return ['—', name ?? ''];
                  if (name === 'cumulativeAffo')
                    return [`$${value.toFixed(3)}/shr`, 'Cum. AFFO Impact'];
                  if (name === 'coverage') return [`${value.toFixed(2)}x`, 'Interest Coverage'];
                  return [value, name ?? ''];
                }}
              />
              <Bar yAxisId="affo" dataKey="cumulativeAffo" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.cumulativeAffo < 0 ? '#34d399' : '#f87171'}
                    fillOpacity={0.7}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="coverage"
                type="monotone"
                dataKey="coverage"
                stroke="#facc15"
                strokeWidth={2}
                dot={{ fill: '#facc15', r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right Sidebar — Stress Scenario Summary */}
      <div className="w-56 shrink-0 space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
          Scenario Summary
        </h3>
        {scenarios.map((s, i) => (
          <div
            key={s.label}
            className={`bg-darkBlue/30 border ${scenarioBorderColors[i]} rounded-lg p-3 space-y-2`}
          >
            <div className={`text-xs font-semibold uppercase tracking-wider ${scenarioTextColors[i]}`}>
              {s.label}
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">New Avg Rate</span>
                <span className="text-slate-200 font-medium">{fmt(s.rate, 2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Interest</span>
                <span className="text-slate-200 font-medium">{fmtMDec(s.newInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coverage</span>
                <span className="text-slate-200 font-medium">{fmt(s.newCoverage, 2)}x</span>
              </div>
              <div className="flex justify-between border-t border-rain/10 pt-1.5">
                <span className="text-slate-500">AFFO/Shr</span>
                <span
                  className={`font-semibold ${
                    s.affoImpact < 0
                      ? 'text-emerald-400'
                      : s.affoImpact > 0
                        ? 'text-red-400'
                        : 'text-slate-400'
                  }`}
                >
                  {s.affoImpact >= 0 ? '+' : ''}${fmt(s.affoImpact, 3)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebtStressTest;
