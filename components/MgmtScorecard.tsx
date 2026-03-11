import React, { useMemo } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getFinancials, getKPIs } from '../services/dataService';
import { FinancialsQuarterly, REITKPIs } from '../types';
import { getInstitutionalProfile, INSTITUTIONAL_PROFILES, REITS as REGISTRY_REITS } from '../services/reitRegistry';

interface MgmtScorecardProps {
  ticker: string;
}

interface DimensionScore {
  name: string;
  key: string;
  score: number;
  rawValue: string;
  assessment: string;
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function scoreGAEfficiency(gaToGav: number): number {
  if (gaToGav < 0.3) return 10;
  if (gaToGav < 0.5) return 8;
  if (gaToGav < 0.7) return 6;
  if (gaToGav < 1.0) return 4;
  return 2;
}

function scoreCapitalAllocation(acqSpreadBps: number, ytcSpreadBps: number): number {
  const avg = (acqSpreadBps + ytcSpreadBps) / 2;
  if (avg > 200) return 10;
  if (avg > 150) return 8;
  if (avg > 100) return 6;
  if (avg > 50) return 4;
  return 2;
}

function scoreBalanceSheet(debtToAssets: number): number {
  const pct = debtToAssets * 100;
  if (pct < 25) return 10;
  if (pct < 35) return 8;
  if (pct < 45) return 6;
  if (pct < 55) return 4;
  return 2;
}

function scoreEarningsQuality(slrToFfoPct: number): number {
  if (slrToFfoPct < 2) return 10;
  if (slrToFfoPct < 5) return 8;
  if (slrToFfoPct < 10) return 6;
  if (slrToFfoPct < 15) return 4;
  return 2;
}

function scoreOperationalExecution(ssNoiGrowth: number): number {
  if (ssNoiGrowth > 5) return 10;
  if (ssNoiGrowth > 3) return 8;
  if (ssNoiGrowth > 1) return 6;
  if (ssNoiGrowth > 0) return 4;
  return 2;
}

function scoreDividendPolicy(payoutRatio: number): number {
  if (payoutRatio >= 65 && payoutRatio <= 80) return 10;
  if ((payoutRatio >= 55 && payoutRatio < 65) || (payoutRatio > 80 && payoutRatio <= 85)) return 8;
  if (payoutRatio > 85 && payoutRatio <= 90) return 6;
  if (payoutRatio > 90 && payoutRatio <= 95) return 4;
  return 3;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAllScores(ticker: string): DimensionScore[] {
  const reit = REITS.find(r => r.ticker === ticker);
  if (!reit) return [];

  const profile = getInstitutionalProfile(ticker);
  const financials = getFinancials(reit.id);
  const kpis = getKPIs(reit.id);

  const latestFin = financials[financials.length - 1] as FinancialsQuarterly;
  const latestKpi = kpis[kpis.length - 1] as REITKPIs;

  // G&A Efficiency
  const gaToGav = latestKpi.gaToGav;
  const gaScore = scoreGAEfficiency(gaToGav);

  // Capital Allocation
  const capAllocScore = scoreCapitalAllocation(profile.acqSpreadBps, profile.ytcSpreadBps);
  const avgSpread = (profile.acqSpreadBps + profile.ytcSpreadBps) / 2;

  // Balance Sheet
  const debtToAssets = latestFin.totalDebt / latestFin.totalAssets;
  const bsScore = scoreBalanceSheet(debtToAssets);

  // Earnings Quality
  const slrToFfo = latestFin.ffo !== 0
    ? Math.abs((latestFin.straightLineRent / latestFin.ffo) * 100)
    : 0;
  const eqScore = scoreEarningsQuality(slrToFfo);

  // Operational Execution
  const ssNoi = latestKpi.sameStoreNOIGrowth;
  const opScore = scoreOperationalExecution(ssNoi);

  // Dividend Policy
  const payoutRatio = latestKpi.payoutAffo;
  const divScore = scoreDividendPolicy(payoutRatio);

  return [
    {
      name: 'G&A Efficiency',
      key: 'ga',
      score: gaScore,
      rawValue: `${gaToGav.toFixed(2)}% of GAV`,
      assessment: gaScore >= 8 ? 'G&A efficiency in top quartile' :
        gaScore >= 6 ? 'G&A in line with peers' : 'G&A overhead above average',
    },
    {
      name: 'Capital Allocation',
      key: 'capAlloc',
      score: capAllocScore,
      rawValue: `${avgSpread.toFixed(0)} bps avg spread`,
      assessment: capAllocScore >= 8 ? 'Strong value-add on deployed capital' :
        capAllocScore >= 6 ? 'Adequate capital deployment spreads' : 'Thin acquisition/dev spreads',
    },
    {
      name: 'Balance Sheet',
      key: 'bs',
      score: bsScore,
      rawValue: `${(debtToAssets * 100).toFixed(1)}% Debt/Assets`,
      assessment: bsScore >= 8 ? 'Conservative leverage profile' :
        bsScore >= 6 ? 'Moderate leverage, investment grade' : 'Elevated leverage risk',
    },
    {
      name: 'Earnings Quality',
      key: 'eq',
      score: eqScore,
      rawValue: `${slrToFfo.toFixed(1)}% SLR/FFO`,
      assessment: eqScore >= 8 ? 'High cash-basis earnings quality' :
        eqScore >= 6 ? 'Reasonable earnings quality' : 'High non-cash component in earnings',
    },
    {
      name: 'Operational Execution',
      key: 'ops',
      score: opScore,
      rawValue: `${ssNoi.toFixed(1)}% SS-NOI growth`,
      assessment: opScore >= 8 ? 'Exceptional organic growth execution' :
        opScore >= 6 ? 'Solid operational performance' : 'Below-peer organic growth',
    },
    {
      name: 'Dividend Policy',
      key: 'div',
      score: divScore,
      rawValue: `${payoutRatio.toFixed(1)}% AFFO payout`,
      assessment: divScore >= 8 ? 'Sustainable payout with retained cash flow' :
        divScore >= 6 ? 'Payout trending toward upper bound' : 'Payout ratio raises sustainability concerns',
    },
  ];
}

function getScoreColor(score: number): string {
  if (score >= 8) return '#34d399'; // emerald
  if (score >= 6) return '#7dd3fc'; // lightBlue
  if (score >= 4) return '#fbbf24'; // gold
  return '#f87171'; // red
}

function getScoreBorderClass(score: number): string {
  if (score >= 8) return 'border-emerald-400';
  if (score >= 6) return 'border-sky-400';
  if (score >= 4) return 'border-amber-400';
  return 'border-red-400';
}

function getScoreTextClass(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-sky-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MgmtScorecard: React.FC<MgmtScorecardProps> = ({ ticker }) => {
  const reit = useMemo(() => REITS.find(r => r.ticker === ticker), [ticker]);

  // All scores for this ticker
  const dimensions = useMemo(() => computeAllScores(ticker), [ticker]);

  const overallScore = useMemo(() => {
    if (dimensions.length === 0) return 0;
    return dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
  }, [dimensions]);

  // Sector peers and their scores
  const sectorPeerScores = useMemo(() => {
    if (!reit) return [];
    const sectorReits = REGISTRY_REITS.filter(r => r.sector === reit.sector);
    return sectorReits.map(sr => {
      const scores = computeAllScores(sr.ticker);
      const avg = scores.length > 0
        ? scores.reduce((s, d) => s + d.score, 0) / scores.length
        : 0;
      return { ticker: sr.ticker, score: parseFloat(avg.toFixed(1)) };
    }).sort((a, b) => b.score - a.score);
  }, [reit]);

  // Sector average per dimension (for radar overlay)
  const sectorAvgByDimension = useMemo(() => {
    if (!reit) return {} as Record<string, number>;
    const sectorReits = REGISTRY_REITS.filter(r => r.sector === reit.sector);
    const allScores = sectorReits.map(sr => computeAllScores(sr.ticker));
    const avgMap: Record<string, number> = {};
    const dimensionKeys = ['ga', 'capAlloc', 'bs', 'eq', 'ops', 'div'];
    dimensionKeys.forEach((key, idx) => {
      const vals = allScores.filter(s => s.length > 0).map(s => s[idx].score);
      avgMap[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 5;
    });
    return avgMap;
  }, [reit]);

  // Radar data
  const radarData = useMemo(() => {
    return dimensions.map(d => ({
      dimension: d.name,
      value: d.score,
      sectorAvg: sectorAvgByDimension[d.key] ?? 5,
    }));
  }, [dimensions, sectorAvgByDimension]);

  // Capital Allocation Track Record
  const capAllocData = useMemo(() => {
    if (!reit) return { current: null, sectorMedian: null };
    const profile = getInstitutionalProfile(ticker);
    const sectorReits = REGISTRY_REITS.filter(r => r.sector === reit.sector);
    const sectorProfiles = sectorReits.map(sr => getInstitutionalProfile(sr.ticker));

    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return {
      current: {
        acqVolumePct: profile.acqVolumePct * 100,
        acqSpreadBps: profile.acqSpreadBps,
        devPipelinePct: profile.devPipelinePct * 100,
        ytcSpreadBps: profile.ytcSpreadBps,
        recurringCapexIntensity: profile.recurringCapexIntensity * 100,
      },
      sectorMedian: {
        acqVolumePct: median(sectorProfiles.map(p => p.acqVolumePct * 100)),
        acqSpreadBps: median(sectorProfiles.map(p => p.acqSpreadBps)),
        devPipelinePct: median(sectorProfiles.map(p => p.devPipelinePct * 100)),
        ytcSpreadBps: median(sectorProfiles.map(p => p.ytcSpreadBps)),
        recurringCapexIntensity: median(sectorProfiles.map(p => p.recurringCapexIntensity * 100)),
      },
    };
  }, [reit, ticker]);

  if (!reit) {
    return (
      <div className="p-8 text-slate-400 font-secondary">
        REIT not found: {ticker}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── A) Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100 header-noe tracking-wide">
          Management Quality Scorecard — {ticker}
        </h2>
        <div
          className={`w-20 h-20 rounded-full border-4 ${getScoreBorderClass(overallScore)} flex flex-col items-center justify-center bg-obsidian`}
        >
          <span className={`text-2xl font-bold ${getScoreTextClass(overallScore)} font-primary`}>
            {overallScore.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-400 font-secondary">/ 10</span>
        </div>
      </div>

      {/* ─── B) Radar + C) Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 font-secondary uppercase tracking-wider">
            Dimension Radar
          </h3>
          <ResponsiveContainer width="100%" height={360}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="rgba(148,163,184,0.15)" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 10]}
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickCount={6}
              />
              <Radar
                name="Sector Avg"
                dataKey="sectorAvg"
                stroke="#f97316"
                fill="#f97316"
                fillOpacity={0.12}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <Radar
                name={ticker}
                dataKey="value"
                stroke="#7dd3fc"
                fill="#7dd3fc"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1e3a5f', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number | undefined) =>
                  value !== undefined ? [value.toFixed(1), ''] : ['—', '']
                }
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 justify-center mt-2 text-xs text-slate-400 font-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-sky-300 inline-block rounded" /> {ticker}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-orange-400 inline-block rounded border-dashed" /> Sector Avg
            </span>
          </div>
        </div>

        {/* Dimension Detail Cards */}
        <div className="grid grid-cols-2 gap-3">
          {dimensions.map(d => (
            <div
              key={d.key}
              className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs text-slate-400 font-secondary uppercase tracking-wider mb-1">
                  {d.name}
                </p>
                <p className={`text-3xl font-bold ${getScoreTextClass(d.score)} font-primary`}>
                  {d.score}
                </p>
                <p className="text-xs text-slate-500 font-secondary mt-1">{d.rawValue}</p>
              </div>
              <div className="mt-3">
                <p className="text-[11px] text-slate-400 font-secondary italic mb-2">
                  {d.assessment}
                </p>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(d.score / 10) * 100}%`,
                      backgroundColor: getScoreColor(d.score),
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── D) Peer Comparison ─────────────────────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 font-secondary uppercase tracking-wider">
          Peer Management Score — {reit.sector}
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(180, sectorPeerScores.length * 44)}>
          <BarChart
            data={sectorPeerScores}
            layout="vertical"
            margin={{ top: 4, right: 30, left: 50, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
            <XAxis type="number" domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="ticker"
              tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
              width={48}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1e3a5f', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(value: number | undefined) =>
                value !== undefined ? [`${value.toFixed(1)} / 10`, 'Score'] : ['—', 'Score']
              }
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
              {sectorPeerScores.map((entry) => (
                <Cell
                  key={entry.ticker}
                  fill={entry.ticker === ticker ? '#7dd3fc' : '#334155'}
                  stroke={entry.ticker === ticker ? '#7dd3fc' : 'transparent'}
                  strokeWidth={entry.ticker === ticker ? 1 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── E) Capital Allocation Track Record ─────────────────────── */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 font-secondary uppercase tracking-wider">
          Capital Allocation Track Record
        </h3>
        {capAllocData.current && capAllocData.sectorMedian && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-secondary">
              <thead>
                <tr className="border-b border-rain/10">
                  <th className="text-left text-slate-400 py-2 pr-4 font-medium">Metric</th>
                  <th className="text-right text-slate-400 py-2 px-4 font-medium">{ticker}</th>
                  <th className="text-right text-slate-400 py-2 pl-4 font-medium">Sector Median</th>
                  <th className="text-right text-slate-400 py-2 pl-4 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {([
                  {
                    label: 'Acquisition Volume (% of GAV)',
                    currentVal: capAllocData.current.acqVolumePct,
                    medianVal: capAllocData.sectorMedian.acqVolumePct,
                    fmt: (v: number) => `${v.toFixed(1)}%`,
                    higherIsBetter: true,
                  },
                  {
                    label: 'Acquisition Spread (bps)',
                    currentVal: capAllocData.current.acqSpreadBps,
                    medianVal: capAllocData.sectorMedian.acqSpreadBps,
                    fmt: (v: number) => `${v.toFixed(0)}`,
                    higherIsBetter: true,
                  },
                  {
                    label: 'Development Pipeline (% of GAV)',
                    currentVal: capAllocData.current.devPipelinePct,
                    medianVal: capAllocData.sectorMedian.devPipelinePct,
                    fmt: (v: number) => `${v.toFixed(1)}%`,
                    higherIsBetter: true,
                  },
                  {
                    label: 'Development Spread (bps)',
                    currentVal: capAllocData.current.ytcSpreadBps,
                    medianVal: capAllocData.sectorMedian.ytcSpreadBps,
                    fmt: (v: number) => `${v.toFixed(0)}`,
                    higherIsBetter: true,
                  },
                  {
                    label: 'Recurring CapEx Intensity (% of NOI)',
                    currentVal: capAllocData.current.recurringCapexIntensity,
                    medianVal: capAllocData.sectorMedian.recurringCapexIntensity,
                    fmt: (v: number) => `${v.toFixed(1)}%`,
                    higherIsBetter: false,
                  },
                ] as const).map(row => {
                  const delta = row.currentVal - row.medianVal;
                  const favorable = row.higherIsBetter ? delta > 0 : delta < 0;
                  return (
                    <tr key={row.label} className="border-b border-rain/5 hover:bg-rain/5 transition-colors">
                      <td className="py-2.5 pr-4 text-slate-300">{row.label}</td>
                      <td className="py-2.5 px-4 text-right text-slate-200 font-medium">
                        {row.fmt(row.currentVal)}
                      </td>
                      <td className="py-2.5 pl-4 text-right text-slate-400">
                        {row.fmt(row.medianVal)}
                      </td>
                      <td className={`py-2.5 pl-4 text-right font-medium ${favorable ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {delta > 0 ? '+' : ''}{row.fmt(delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MgmtScorecard;
