
import React, { useMemo, useState, useEffect } from 'react';
import { REITS } from '../services/mockData';
import { FinancialsQuarterly, Sector, Portfolio } from '../types';
import { StrategicModelState } from '../App';
import {
  getHistoricalLookbacks, getExpectationsStatus, checkValueTrap, calculatePercentile,
  computeSectorExpectations, computeHistoricalLookbacks,
  getHardcodedNavStats, getHardcodedSpreadStats,
  DistributionStats
} from '../services/expectationsService';
import { InfoTooltip } from './InfoTooltip';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart, Line, Area
} from 'recharts';
import { getFinancials, getMarketDataSync, fetchFREDMacro, getFinancialsDataSource, getMarketDataSource } from '../services/dataService';
import ExportButton from './ExportButton';
import { DataSourceBadge } from './DataSourceBadge';
import { StalenessIndicator } from './StalenessIndicator';
import { useToast } from '../contexts/ToastContext';

interface ValuationProps {
  ticker: string;
  sector: Sector | null;
  portfolio: Portfolio | null;
  liveFinancials?: FinancialsQuarterly[];
  strategicModel: StrategicModelState;
}

// Visual component for the 10Y distribution bands
const DistributionScale = ({ current, stats, unit = "", color = "#d4af37" }: {
  current: number,
  stats: { low: number, p25: number, med: number, p75: number, high: number },
  unit?: string,
  color?: string
}) => {
  const percent = ((current - stats.low) / (stats.high - stats.low)) * 100;
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className="mt-6 space-y-3">
      <div className="relative h-2 w-full bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
        {/* Color zones for 25th-75th percentile */}
        <div
          className="absolute h-full bg-white/5"
          style={{
            left: `${((stats.p25 - stats.low) / (stats.high - stats.low)) * 100}%`,
            width: `${((stats.p75 - stats.p25) / (stats.high - stats.low)) * 100}%`
          }}
        ></div>
        {/* Median Marker Line */}
        <div
          className="absolute h-full w-px bg-slate-500 z-10"
          style={{ left: `${((stats.med - stats.low) / (stats.high - stats.low)) * 100}%` }}
        ></div>
        {/* Current Value Pointer */}
        <div
          className="absolute h-full z-20 transition-all duration-1000 ease-out"
          style={{
            backgroundColor: color,
            width: '3px',
            left: `${clampedPercent}%`,
            boxShadow: `0 0 12px ${color}`
          }}
        ></div>
      </div>
      <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter mono">
        <div className="flex flex-col items-start text-slate-400">
          <span className="opacity-60">LOW</span>
          <span className="text-white">{stats.low.toFixed(1)}{unit}</span>
        </div>
        <div className="flex flex-col items-center text-slate-500">
          <span className="opacity-60">25TH</span>
          <span>{stats.p25.toFixed(1)}{unit}</span>
        </div>
        <div className="flex flex-col items-center text-gold drop-shadow-sm">
          <span className="opacity-80">MEDIAN</span>
          <span className="font-bold">{stats.med.toFixed(1)}{unit}</span>
        </div>
        <div className="flex flex-col items-center text-slate-500">
          <span className="opacity-60">75TH</span>
          <span>{stats.p75.toFixed(1)}{unit}</span>
        </div>
        <div className="flex flex-col items-end text-slate-400">
          <span className="opacity-60">HIGH</span>
          <span className="text-white">{stats.high.toFixed(1)}{unit}</span>
        </div>
      </div>
    </div>
  );
};

const Valuation: React.FC<ValuationProps> = ({ ticker, sector, portfolio, liveFinancials, strategicModel }) => {
  const [selectedLookback, setSelectedLookback] = useState<'1Y' | '3Y' | '5Y' | '10Y'>('10Y');
  const [treasury10Y, setTreasury10Y] = useState<number>(4.25);
  const { addToast } = useToast();

  // Data-driven distribution stats (loaded asynchronously)
  const [computedNavStats, setComputedNavStats] = useState<DistributionStats>(getHardcodedNavStats());
  const [computedSpreadStats, setComputedSpreadStats] = useState<DistributionStats>(getHardcodedSpreadStats());
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);

  useEffect(() => {
    fetchFREDMacro()
      .then((macroData) => {
        const dgs10 = macroData.find(m => m.seriesId === 'DGS10');
        if (dgs10) {
          setTreasury10Y(dgs10.value);
        }
      })
      .catch(() => {
        addToast({
          type: 'warning',
          title: 'FRED macro data unavailable',
          message: 'Using default 10Y Treasury rate (4.25%). Spreads may be approximate.',
          duration: 6000,
        });
      });
  }, [addToast]);

  const reit = REITS.find(r => r.ticker === ticker)!;

  // Data source detection
  const financialsSource = useMemo(
    () => getFinancialsDataSource(reit.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reit.id, dataLoaded]
  );
  const marketSource = useMemo(
    () => getMarketDataSource(reit.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reit.id, dataLoaded]
  );

  // Load data-driven sector expectations asynchronously
  useEffect(() => {
    let cancelled = false;

    async function loadSectorExpectations() {
      try {
        // Fire async lookback computations to populate the cache
        // so that subsequent synchronous getHistoricalLookbacks() calls return real data
        const [, , , sectorExp] = await Promise.all([
          computeHistoricalLookbacks('g', reit.sector, reit.ticker),
          computeHistoricalLookbacks('cap', reit.sector, reit.ticker),
          computeHistoricalLookbacks('multiple', reit.sector, reit.ticker),
          computeSectorExpectations(reit.ticker),
        ]);

        if (cancelled) return;

        if (sectorExp) {
          setComputedNavStats(sectorExp.nav);
          setComputedSpreadStats(sectorExp.spread);
        }
        setDataLoaded(true);
      } catch {
        // Keep hardcoded fallback values on failure
        if (!cancelled) setDataLoaded(true);
      }
    }

    loadSectorExpectations();
    return () => { cancelled = true; };
  }, [reit.sector, reit.ticker]);

  const marketData = useMemo(() => getMarketDataSync(reit.id), [reit.id]);
  const financials = useMemo(() => getFinancials(reit.id, liveFinancials), [reit.id, liveFinancials]);
  const latestFinancial = financials[financials.length - 1];

  // After dataLoaded flips to true, getHistoricalLookbacks will return cached computed data
  const historicalG = useMemo(() => getHistoricalLookbacks('g', reit.sector), [reit.sector, dataLoaded]);
  const historicalCap = useMemo(() => getHistoricalLookbacks('cap', reit.sector), [reit.sector, dataLoaded]);
  const historicalMultiple = useMemo(() => getHistoricalLookbacks('multiple', reit.sector), [reit.sector, dataLoaded]);

  const currentLookbackG = historicalG.find(l => l.period === selectedLookback)!;
  const currentLookbackCap = historicalCap.find(l => l.period === selectedLookback)!;
  const currentLookbackMultiple = historicalMultiple.find(l => l.period === selectedLookback)!;

  const histStats = useMemo(() => ({
    multiple: { low: currentLookbackMultiple.low, p25: currentLookbackMultiple.p25, med: currentLookbackMultiple.median, p75: currentLookbackMultiple.p75, high: currentLookbackMultiple.high },
    cap: { low: currentLookbackCap.low, p25: currentLookbackCap.p25, med: currentLookbackCap.median, p75: currentLookbackCap.p75, high: currentLookbackCap.high },
    nav: computedNavStats
  }), [currentLookbackMultiple, currentLookbackCap, computedNavStats]);

  const valuationTrend = useMemo(() => {
    return marketData.slice().reverse().map(d => {
      const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
      const shares = latestFinancial.dilutedShares;
      const mktCap = d.closePrice * shares;
      const debt = latestFinancial.totalDebt;
      const ev = mktCap + debt;

      // NAV Proxy calculation: Value = NOI / Sector Median Cap Rate
      const gavEstimate = ttmNOI / (histStats.cap.med / 100);
      const navEstimateTotal = gavEstimate - debt;
      const priceToNav = (mktCap / navEstimateTotal) * 100;

      const navPerShare = navEstimateTotal / shares;
      const navLow = navPerShare * 0.95;
      const navHigh = navPerShare * 1.05;

      return {
        ...d,
        impliedCap: ev > 0 ? (ttmNOI / ev) * 100 : 0,
        evNoi: ttmNOI > 0 ? ev / ttmNOI : 0,
        priceToNav,
        navLow,
        navHigh,
        navMid: navPerShare
      };
    });
  }, [marketData, financials, latestFinancial, histStats]);

  const currentVal = valuationTrend[valuationTrend.length - 1];

  // Expectations Framework Logic
  const impliedG = useMemo(() => {
    const wacc = (strategicModel.wacc.rf + (strategicModel.wacc.beta * strategicModel.wacc.erp)) / 100;
    const payout = strategicModel.wacc.payout / 100;
    const multiple = currentVal.evNoi;
    if (multiple <= 0) return 0;

    // Implied_g = (WACC - (Payout / Multiple)) / (1 + (Payout / Multiple))
    const divYield = payout / multiple;
    return ((wacc - divYield) / (1 + divYield)) * 100;
  }, [strategicModel, currentVal.evNoi]);

  const expectationsStatus = useMemo(() => getExpectationsStatus(impliedG, currentLookbackG), [impliedG, currentLookbackG]);
  const valueTrapStatus = useMemo(() => checkValueTrap(reit.ticker, reit.sector, impliedG, currentLookbackG, strategicModel.wacc.payout), [reit.ticker, reit.sector, impliedG, currentLookbackG, strategicModel.wacc.payout]);

  // Get 10Y Treasury rate for spread calculation (loaded asynchronously from FRED)
  const spreadTo10Y = currentVal.impliedCap - treasury10Y;

  const kpis = [
    {
      label: 'Price / FFO (Proxy)',
      value: `${currentVal.evNoi.toFixed(1)}x`,
      p: `${((currentVal.evNoi - histStats.multiple.low) / (histStats.multiple.high - histStats.multiple.low) * 100).toFixed(0)}%`,
      color: 'royal',
      stats: histStats.multiple,
      unit: "x",
      tooltip: "Enterprise Value divided by TTM NOI. A cleaner alternative to P/FFO that accounts for leverage."
    },
    {
      label: 'Implied Cap Rate',
      value: `${currentVal.impliedCap.toFixed(2)}%`,
      p: `${((currentVal.impliedCap - histStats.cap.low) / (histStats.cap.high - histStats.cap.low) * 100).toFixed(0)}%`,
      color: 'gold',
      stats: histStats.cap,
      unit: "%",
      tooltip: "The yield the market is pricing into the assets. Calculated as TTM NOI / Enterprise Value."
    },
    {
      label: 'Spread to 10Y Treasury',
      value: `${spreadTo10Y > 0 ? '+' : ''}${spreadTo10Y.toFixed(0)} bps`,
      p: `${spreadTo10Y > 200 ? '75' : spreadTo10Y > 150 ? '50' : '25'}%`,
      color: spreadTo10Y > 200 ? 'emerald' : spreadTo10Y > 100 ? 'gold' : 'rose',
      stats: { low: 50, p25: 125, med: 175, p75: 225, high: 300 },
      unit: " bps",
      tooltip: `Implied Cap Rate minus 10Y Treasury (${treasury10Y.toFixed(2)}%). Higher spreads indicate better relative value vs. risk-free bonds. Institutional benchmark: 150-200 bps for quality REITs.`
    },
    {
      label: 'Price / NAV Est',
      value: `${currentVal.priceToNav.toFixed(1)}%`,
      p: `${((currentVal.priceToNav - histStats.nav.low) / (histStats.nav.high - histStats.nav.low) * 100).toFixed(0)}%`,
      color: 'amber',
      stats: histStats.nav,
      unit: "%",
      tooltip: "Current market cap relative to the estimated Net Asset Value (NAV) based on sector median cap rates."
    },
    {
      label: 'Sector Relative',
      value: '14.0th',
      p: 'ALPHA',
      color: 'royal',
      stats: { low: 0, p25: 25, med: 50, p75: 75, high: 100 },
      unit: "pt",
      tooltip: "The stock's valuation percentile relative to its sector peers over the selected lookback period."
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Expectations Framework Header */}
      <div className="aegis-card p-8 border-gold/20 bg-darkBlue/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
          <div className="flex items-center gap-3">
            <ExportButton
              data={kpis.map(k => ({
                Metric: k.label,
                Value: k.value,
                Percentile: k.p,
                Low: k.stats.low,
                '25th': k.stats.p25,
                Median: k.stats.med,
                '75th': k.stats.p75,
                High: k.stats.high,
              }))}
              filename={`REITLens-Valuation-${ticker}`}
              title="Valuation Metrics"
              sheetName="Valuation"
              compact
            />
            <div className="flex gap-2">
              {['1Y', '3Y', '5Y', '10Y'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedLookback(p as any)}
                  className={`px-3 py-1 rounded text-[10px] font-black border transition-all ${selectedLookback === p
                      ? 'bg-gold text-obsidian border-gold'
                      : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20'
                    }`}
                >
                  {p} LOOKBACK
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h2 className="header-institutional text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <span className="text-gold">Expectations Framework</span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-rain">v1.0</span>
              <InfoTooltip content="Reverse-engineering the share price to find the growth rate the market is currently pricing in." />
              <DataSourceBadge
                source={financialsSource.source === 'DB' ? 'SEC' : financialsSource.source === 'Mock' ? 'Mock' : 'SEC'}
                confidence={financialsSource.isFallback ? 'low' : 'high'}
              />
              <StalenessIndicator
                lastUpdated={financialsSource.lastUpdated}
                source={financialsSource.source === 'DB' ? 'DB' : financialsSource.source === 'Mock' ? 'Mock' : 'SEC'}
                compact
              />
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Reverse-engineering the current share price to solve for the <span className="text-white font-bold">Implied Growth</span>.
              Comparing market expectations against the <span className="text-gold font-bold">{selectedLookback} historical distribution</span> for the {reit.sector} sector.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[9px] font-black text-rain uppercase tracking-widest block">Implied g</span>
                <InfoTooltip content="The long-term growth rate required to justify the current stock price given the WACC and payout ratio." />
              </div>
              <span className="text-4xl font-black text-white mono">{impliedG.toFixed(1)}%</span>
            </div>
            <div className="w-px h-12 bg-white/10"></div>
            <div className="flex flex-col">
              <span className={`text-[10px] font-black uppercase tracking-widest mb-1`} style={{ color: `var(--${expectationsStatus.color})` }}>
                {expectationsStatus.label}
              </span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse`} style={{ backgroundColor: `var(--${expectationsStatus.color})` }}></div>
                <span className="text-[11px] font-bold text-white">{calculatePercentile(impliedG, currentLookbackG).toFixed(0)}th Percentile</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-white/5 rounded border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-rain uppercase tracking-widest block">Market Sentiment</span>
              <InfoTooltip content="A qualitative assessment of what the market's implied growth rate signals about investor sentiment." />
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed italic">"{expectationsStatus.description}"</p>
          </div>
          <div className="p-4 bg-white/5 rounded border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-rain uppercase tracking-widest block">Independent Verdict</span>
              <InfoTooltip content="An algorithmic check for 'Value Traps' where low valuation is justified by poor operational fundamentals." />
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-black uppercase ${valueTrapStatus.status === 'Cheap' ? 'text-emerald-400' : valueTrapStatus.status === 'Value Trap' ? 'text-rose-400' : 'text-slate-400'}`}>
                {valueTrapStatus.status}
              </span>
              <span className="text-[10px] text-slate-500">— {valueTrapStatus.reason}</span>
            </div>
          </div>
          <div className="p-4 bg-gold/5 rounded border border-gold/10 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black text-gold uppercase tracking-widest">Sector Nuance: {reit.sector}</span>
              <InfoTooltip content="Specific operational factors that drive valuation in this particular REIT sector." />
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              {reit.sector === Sector.SFR ? "Focus on Bad Debt % and Turnover Cost. Sensitive to local HPI and property tax resets." :
                reit.sector === Sector.INDUSTRIAL ? "Focus on Mark-to-Market (MTM) Rent Spreads and Logistics supply." :
                  reit.sector === Sector.OFFICE ? "Focus on TI/LC leakage and structural occupancy shifts." :
                    reit.sector === Sector.RESIDENTIAL ? "Focus on Loss-to-Lease and high-frequency inflation hedging." :
                      reit.sector === Sector.RETAIL ? "Focus on Sales PSF and Occupancy Cost Ratio. Anchor stability vs. Inline profitability." :
                        reit.sector === Sector.DATA_CENTERS ? "Focus on Power Capacity (MW) and Interconnection Revenue. Driven by AI demand." :
                          reit.sector === Sector.HEALTHCARE ? "Focus on EBITDAR Coverage and Operator Credit. Sensitive to labor costs." :
                            reit.sector === Sector.TOWERS ? "Focus on Tenant Lease-up and 5G/6G CapEx cycles. High barrier to entry." :
                              "Standard institutional valuation framework applied."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpis.map((s, i) => (
          <div key={i} className="aegis-card gold-braiding p-6 group">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{s.label}</span>
                <InfoTooltip content={s.tooltip} />
              </div>
              <span className={`text-[8px] font-black text-${s.color} bg-${s.color}/10 px-2 py-0.5 rounded uppercase border border-${s.color}/20 tracking-tighter shadow-sm`}>
                {s.p} Percentile
              </span>
            </div>
            <div className="mt-4 text-3xl font-black text-white mono drop-shadow-sm">{s.value}</div>

            <DistributionScale
              current={parseFloat(s.value.replace(/[^0-9.]/g, ''))}
              stats={s.stats}
              unit={s.unit}
              color={i === 0 ? '#9333ea' : i === 1 ? '#d4af37' : '#f97316'}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10">
        <div className="aegis-card gold-braiding p-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="header-institutional text-sm font-bold text-white uppercase tracking-widest">NAV Proxy Corridor</h3>
              <p className="text-[10px] text-slate-500 uppercase mt-1 tracking-widest">Theoretical Range vs Actual Price</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-royal shadow-[0_0_12px_rgba(147,51,234,0.4)]"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Spot Price</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-royal/40 border border-royal/60"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">NAV Band</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 border-t border-dashed border-gold/60"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Median Proxy</span>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: 480 }}>
            <ResponsiveContainer>
              <ComposedChart data={valuationTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(147, 51, 234, 0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} dy={10} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} domain={['auto', 'auto']} tick={{ fontWeight: 800 }} dx={-10} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.98)', border: '1.5px solid #d4af37', borderRadius: '4px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}
                  formatter={(val: number | undefined) => [`$${(val ?? 0).toFixed(2)}`]}
                />
                <Area type="monotone" dataKey="navHigh" stroke="none" fill="#9333ea" fillOpacity={0.12} />
                <Area type="monotone" dataKey="navLow" stroke="none" fill="#020617" fillOpacity={1} />
                <Line type="monotone" dataKey="closePrice" stroke="#9333ea" strokeWidth={3} dot={false} name="Spot Price" animationDuration={2000} />
                <Line type="monotone" dataKey="navMid" stroke="#d4af37" strokeDasharray="6 6" strokeWidth={1.5} dot={false} name="NAV Median" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Valuation;
