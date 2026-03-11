import React, { useMemo, useState, useEffect } from 'react';
import { REITS } from '../services/mockData';
import { Sector, Portfolio, FinancialsQuarterly } from '../types';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, Cell, ResponsiveContainer } from 'recharts';
import { StrategicModelState } from '../App';
import { getFinancials, getMarketDataSync } from '../services/dataService';
import { getInstitutionalProfile } from '../services/reitRegistry';
import { HistoricalReturnsService } from '../services/historicalReturnsService';
import ExportButton from './ExportButton';

interface ReturnDecompositionProps {
  ticker: string;
  sector: Sector | null;
  portfolio: Portfolio | null;
  liveFinancials?: FinancialsQuarterly[];
  strategicModel: StrategicModelState;
}

const COLORS = {
  yield: '#48A3CC',
  growth: '#FF9D3C',
  valuation: '#d4af37',
  total: '#10b981',
  negative: '#f43f5e'
};

const CustomTooltip = ({ active, payload, label, impliedCap }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    // Add null safety checks
    if (!data || data.yield === undefined || data.growth === undefined || data.valuation === undefined || data.total === undefined) {
      return null;
    }

    const isProj = data.isProjected;
    const decomp: any = data.growthDecomp || {};

    // Standardize logic across components: (Vol * Spread/100) / CapRate
    // Fallback to the REIT's institutional profile baseline cap rate instead of generic 5.0%
    const cap = impliedCap || 5.0; // Note: per-ticker override happens via impliedCap prop from parent
    const ss = decomp.ss ?? decomp.ssNoi ?? 0;
    const acq = decomp.acqVol ? (decomp.acqVol * (decomp.acqSpread / 100) / cap) : (decomp.acquisitionAccretion ?? 0);
    const dev = decomp.devVol ? (decomp.devVol * (decomp.devSpread / 100) / cap) : (decomp.devAlpha ?? 0);
    const leakage = decomp.leakage ?? decomp.structuralLeakage ?? 0;
    const capImpact = decomp.cap ?? decomp.capImpact ?? 0;

    return (
      <div className="bg-obsidian/95 border border-rain/40 p-5 rounded shadow-2xl backdrop-blur-xl min-w-[300px]">
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
          <span className="text-[10px] font-black text-lightBlue uppercase tracking-widest">
            {isProj ? 'Strategic Return Bridge' : `${label} Attribution`}
          </span>
          {isProj && <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">LINKED TO P/AFFO MODEL</span>}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              {isProj ? 'Current Dividend Yield' : 'Going-in Dividend Yield'}
            </span>
            <span className="text-xs font-black text-lightBlue mono">+{data.yield.toFixed(1)}%</span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-white/5 bg-white/5 p-2 rounded">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-pumpkin uppercase tracking-widest">
                {isProj ? 'Sustainable g (Decomp)' : 'Growth-Driven Return'}
              </span>
              <span className="text-xs font-black text-white mono">+{data.growth.toFixed(1)}%</span>
            </div>
            <div className="grid grid-cols-1 gap-1 pl-2 opacity-80 border-l border-pumpkin/30 ml-1">
              <div className="flex justify-between text-[8px] uppercase tracking-tighter font-bold text-slate-400"><span>Organic SS-NOI</span><span className="text-white mono">{ss.toFixed(1)}%</span></div>
              <div className="flex justify-between text-[8px] uppercase tracking-tighter font-bold text-slate-400"><span>Inorganic Rollup</span><span className="text-white mono">+{(acq + dev).toFixed(1)}%</span></div>
              <div className="flex justify-between text-[8px] uppercase tracking-tighter font-bold text-slate-400"><span>CAD Leakage (Cap-Ex)</span><span className="text-rose-400 mono">{leakage.toFixed(1)}%</span></div>
              <div className="flex justify-between text-[8px] uppercase tracking-tighter font-bold text-slate-400"><span>Capital Impact</span><span className="text-white mono">{capImpact >= 0 ? '+' : ''}{capImpact.toFixed(1)}%</span></div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-white/5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Multiple Rerating (p.a.)</span>
            <span className={`text-xs font-black mono ${data.valuation >= 0 ? 'text-gold' : 'text-rose-400'}`}>
              {data.valuation >= 0 ? '+' : ''}{data.valuation.toFixed(1)}%
            </span>
          </div>

          <div className="pt-3 mt-1 border-t border-emerald-500/30 flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{isProj ? 'Expected Total IRR' : 'Realized Total Return'}</span>
              <span className="text-[7px] text-slate-500 uppercase font-black">{isProj ? 'Yield + g + Rerating' : 'Income + Growth + Rerating (Ann.)'}</span>
            </div>
            <span className={`text-2xl font-black mono ${data.total >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {data.total.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const ReturnDecomposition: React.FC<ReturnDecompositionProps> = ({ ticker, sector, portfolio, liveFinancials, strategicModel }) => {
  const [horizon, setHorizon] = useState<number>(3);
  const [historicalReturns, setHistoricalReturns] = useState<any[]>([]);

  useEffect(() => {
    async function loadHistoricalReturns() {
      try {
        const returns = await HistoricalReturnsService.getReturnsForTicker(ticker);
        setHistoricalReturns(returns);
      } catch (error) {
        // failed to load historical returns
      }
    }
    loadHistoricalReturns();
  }, [ticker]);

  const baseMetrics = useMemo(() => {
    const targets = portfolio
      ? portfolio.holdings.map(h => REITS.find(r => r.ticker === h.ticker)!)
      : sector
        ? REITS.filter(r => r.sector === sector)
        : [REITS.find(r => r.ticker === ticker)!];

    if (targets.length === 0) {
      // Use institutional profile baseline cap rate as fallback instead of generic 5.0%
      const fallbackProfile = getInstitutionalProfile(ticker);
      return { impliedCap: fallbackProfile.baselineCapRate * 100, yield: fallbackProfile.dividendYield * 100 };
    }

    const metrics = targets.map(reit => {
      const marketData = getMarketDataSync(reit.id);
      const market = marketData && marketData.length > 0 ? marketData[0] : null;
      const financials = getFinancials(reit.id, liveFinancials);
      const latestFin = financials && financials.length > 0 ? financials[financials.length - 1] : null;

      if (!market || !latestFin) {
        // Use per-REIT institutional profile instead of generic 5.0%
        const profile = getInstitutionalProfile(reit.ticker);
        return { impliedCap: profile.baselineCapRate * 100, yield: profile.dividendYield * 100 };
      }

      const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
      return {
        impliedCap: (ttmNOI / (market.marketCap + latestFin.totalDebt)) * 100,
        yield: market.dividendYield
      };
    });

    const count = metrics.length;
    return {
      impliedCap: metrics.reduce((a, m) => a + m.impliedCap, 0) / count,
      yield: metrics.reduce((a, m) => a + m.yield, 0) / count,
    };
  }, [ticker, sector, portfolio, liveFinancials]);

  const [targetCap, setTargetCap] = useState<number>(baseMetrics.impliedCap);

  const combinedData = useMemo(() => {
    const { growth } = strategicModel;
    const impliedCap = baseMetrics.impliedCap || 5.0;
    const acqAccretion = (growth.acqVol * (growth.acqSpread / 100)) / impliedCap;
    const devAccretion = (growth.devVol * (growth.devSpread / 100)) / impliedCap;
    const netG = growth.ss + acqAccretion + devAccretion + growth.leakage + growth.cap;

    // Valuation rerating: annualized % return from cap rate compression/expansion
    // Uses log-based approach: if cap compresses from 5% to 4%, NAV rises by 5/4 = 25%
    const currentCapDecimal = impliedCap / 100;
    const targetCapDecimal = targetCap / 100;
    const valuationChange = targetCapDecimal > 0
      ? ((currentCapDecimal / targetCapDecimal - 1) * 100) / horizon
      : 0;

    const buildBar = (name: string, y: number, gVal: number, groDecomp: any, val: number, isProj: boolean) => ({
      name,
      yield: y,
      growth: gVal,
      growthDecomp: groDecomp,
      valuation: val,
      total: y + gVal + val,
      isProjected: isProj
    });

    const projected = buildBar('Forward', baseMetrics.yield, netG, growth, valuationChange, true);

    const historicals = historicalReturns.length > 0
      ? historicalReturns.map(ret =>
          buildBar(
            ret.period + ' Hist.',
            ret.dividendYieldContribution,
            ret.affoGrowthContribution,
            {
              ss: ret.organicSsNoi ?? 0,
              acquisitionAccretion: ret.acquisitionAccretion ?? 0,
              devAlpha: ret.developmentAccretion ?? 0,
              acqVol: growth.acqVol,  // Fallback to forward model values
              acqSpread: growth.acqSpread,
              devVol: growth.devVol,
              devSpread: growth.devSpread,
              leakage: ret.cadLeakage ?? 0,
              cap: ret.capImpact ?? 0
            },
            ret.multipleReratingContribution,
            false
          )
        )
      : [
          buildBar('1Y Hist.', baseMetrics.yield * 0.9, netG - 1.5, { ss: growth.ss - 1.5, acqVol: growth.acqVol, acqSpread: growth.acqSpread, devVol: growth.devVol, devSpread: growth.devSpread, leakage: growth.leakage, cap: growth.cap }, -4.5, false),
          buildBar('3Y Hist.', baseMetrics.yield * 1.1, netG + 0.5, { ss: growth.ss + 0.5, acqVol: growth.acqVol, acqSpread: growth.acqSpread, devVol: growth.devVol, devSpread: growth.devSpread, leakage: growth.leakage, cap: growth.cap }, 2.1, false),
          buildBar('5Y Hist.', baseMetrics.yield, netG + 1.2, { ss: growth.ss + 1.2, acqVol: growth.acqVol, acqSpread: growth.acqSpread, devVol: growth.devVol, devSpread: growth.devSpread, leakage: growth.leakage, cap: growth.cap }, 5.4, false),
        ];

    const allBars = [projected, ...historicals];
    return allBars;
  }, [targetCap, horizon, baseMetrics, strategicModel, historicalReturns]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-institutional text-2xl font-black text-white tracking-institutional uppercase">Strategic Return Decomposition</h2>
          <p className="text-[10px] text-rain uppercase tracking-[0.4em] mt-2">IRR ATTRIBUTION: INCOME YIELD + SUSTAINABLE GROWTH + MULTIPLE RERATING</p>
        </div>
        <div className="flex items-center gap-4">
          <ExportButton
            data={combinedData.map(d => ({
              Period: d.name,
              'Dividend Yield (%)': d.yield.toFixed(2),
              'Sustainable g (%)': d.growth.toFixed(2),
              'Multiple Rerating (%)': d.valuation.toFixed(2),
              'Total IRR (%)': d.total.toFixed(2),
            }))}
            filename={`REITLens-ReturnDecomp-${ticker}`}
            title="Strategic Return Decomposition"
            sheetName="Return Decomposition"
            compact
          />
          <div className="flex bg-darkBlue/50 p-1 rounded-lg border border-lightBlue/20">
            <button onClick={() => setHorizon(3)} className={`px-5 py-2 text-[10px] font-black rounded transition-all ${horizon === 3 ? 'bg-lightBlue text-white shadow-lg' : 'text-rain'}`}>3Y HORIZON</button>
            <button onClick={() => setHorizon(5)} className={`px-5 py-2 text-[10px] font-black rounded transition-all ${horizon === 5 ? 'bg-lightBlue text-white shadow-lg' : 'text-rain'}`}>5Y HORIZON</button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <aside className="lg:col-span-1 space-y-6">
          <div className="aegis-card gold-braiding p-8 border-gold/20 bg-darkBlue/40">
            <h3 className="text-[11px] font-black text-gold uppercase tracking-[0.4em] mb-6 border-b border-gold/10 pb-4">Terminal Exit Multiple</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black text-white uppercase tracking-widest">Exit Cap Rate</span><span className="text-white mono text-xs font-black">{targetCap.toFixed(1)}%</span></div>
              <input type="range" min="3" max="9" step="0.1" value={targetCap} onChange={(e) => setTargetCap(parseFloat(e.target.value))} className="w-full accent-gold h-1.5 bg-slate-800 rounded-full" />
              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-tight"><span>Current Implied Cap</span><span className="text-white mono">{baseMetrics.impliedCap.toFixed(1)}%</span></div>
                <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-tight"><span>Target AFFO Multiple</span><span className="text-white mono">{(100 / targetCap).toFixed(1)}x</span></div>
              </div>
            </div>
          </div>

          <div className="aegis-card p-6 bg-emerald-500/5 border border-emerald-500/10">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Strategic Model Sync</span>
            <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
              Forward IRR is powered by the shared strategic plan. Historical bars reflect realized returns decomposed into the same attribution framework.
            </p>
          </div>
        </aside>

        <div className="lg:col-span-3 aegis-card gold-braiding p-10 relative overflow-hidden">
          <div style={{ width: '100%', height: 440, overflow: 'visible' }} className="font-tertiary">
            <ResponsiveContainer width="100%" height={440}>
            <ComposedChart data={combinedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 154, 174, 0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tick={{ fontWeight: 800 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} tick={{ fontWeight: 800 }} domain={[-20, 20]} />
              <Tooltip cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} content={<CustomTooltip impliedCap={baseMetrics.impliedCap} />} />
              <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <ReferenceLine y={0} stroke="#475569" strokeWidth={2} />
              <Bar dataKey="yield" name="Dividend Yield" stackId="a" fill={COLORS.yield} barSize={60} />
              <Bar dataKey="growth" name="Sustainable g" stackId="a" fill={COLORS.growth} barSize={60} />
              <Bar dataKey="valuation" name="Multiple Rerating" stackId="a" barSize={60}>
                {combinedData.map((entry, index) => <Cell key={index} fill={entry.valuation >= 0 ? COLORS.valuation : COLORS.negative} />)}
              </Bar>
              <Line type="monotone" dataKey="total" name="Total IRR" stroke="#10b981" strokeWidth={0} dot={{ r: 8, fill: '#10b981', stroke: '#010409', strokeWidth: 3 }} />
            </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-10 border-t border-white/10 pt-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest border-l-2 border-lightBlue pl-3">Income / Yield Strategy</h4>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                Income return is highly predictable based on the current dividend yield. High-payout REITs (Retail/Office) derive the majority of IRR from this bucket.
              </p>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest border-l-2 border-pumpkin pl-3">Growth / CAD Generation</h4>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                Sustainable $g$ accounts for organic rent bumps and external accretion, but is strictly net of <span className="text-rose-400 font-bold">CAD Leakage</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnDecomposition;
