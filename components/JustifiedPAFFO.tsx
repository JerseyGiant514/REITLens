import React, { useMemo, useState } from 'react';
import { REITS, MACRO_DATA, generateMarketData, generateFinancials } from '../services/mockData';
import { Sector, Portfolio, FinancialsQuarterly } from '../types';
import { StrategicModelState } from '../App';
import { getHistoricalLookbacks } from '../services/expectationsService';
import { InfoTooltip } from './InfoTooltip';
import { getFinancials, getMarketDataSync } from '../services/dataService';
import ScenarioManager from './ScenarioManager';

interface JustifiedPAFFOProps {
  ticker: string;
  sector: Sector | null;
  portfolio: Portfolio | null;
  liveFinancials?: FinancialsQuarterly[];
  model: StrategicModelState;
  onUpdateModel: (m: StrategicModelState) => void;
}

const PercentilePicker = ({
  label, p25, p50, p75, spot, onSelect, currentVal, currentLabel, accent = "gold"
}: {
  label: string, p25: number, p50: number, p75: number, spot: number,
  onSelect: (v: number, l: string) => void, currentVal: number, currentLabel: string,
  accent?: "gold" | "lightBlue" | "pumpkin" | "emerald"
}) => {
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <span className="text-[7px] font-black text-rain uppercase tracking-widest">{label}</span>
      <div className="grid grid-cols-4 gap-1">
        {[
          { label: 'CURR', val: spot },
          { label: '25th', val: p25 },
          { label: '50th', val: p50 },
          { label: '75th', val: p75 }
        ].map((p) => {
          const isActive = p.label === currentLabel || (currentLabel === 'custom' && Math.abs(currentVal - p.val) < 0.0001);
          return (
            <button
              key={p.label}
              onClick={() => onSelect(p.val, p.label)}
              className={`py-1 rounded text-[7px] font-black border transition-all ${isActive
                  ? 'bg-lightBlue text-white border-lightBlue'
                  : 'bg-white/5 text-slate-500 border-white/5 hover:border-white/20 hover:text-white'
                }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const GrowthBridge = ({
  state,
  onUpdate,
  impliedCap
}: {
  state: StrategicModelState['growth'],
  onUpdate: (updates: Record<string, number>) => void,
  impliedCap: number
}) => {
  // Accretion calculation normalized by Cap Rate
  const acqAccretion = (state.acqVol * (state.acqSpread / 100)) / impliedCap;
  const devAccretion = (state.devVol * (state.devSpread / 100)) / impliedCap;
  const inorganicTotal = acqAccretion + devAccretion;

  // SUSTAINABLE G LOGIC: 
  // We apply the Organic SS-NOI rate to the ENTIRE expansionary base,
  // acknowledging that new acquisitions also grow at the organic rate in Year T+1
  const netG = state.ss + inorganicTotal + state.leakage + state.cap;

  return (
    <div className="space-y-10 mt-6">
      <div className="flex items-center justify-between border-b border-rain/10 pb-2">
        <span className="text-[10px] font-black text-rain uppercase tracking-[0.2em]">Institutional Growth Bridge</span>
      </div>

      {/* ORGANIC */}
      <div className="aegis-card p-4 border-pumpkin/20 bg-pumpkin/5 space-y-3">
        <div className="flex justify-between items-center text-[10px] font-black text-white">
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-widest">1. Organic SS-NOI</span>
            <InfoTooltip content="The organic growth from existing properties, driven by rent escalators and occupancy gains." />
          </div>
          <span className="mono text-pumpkin">+{state.ss.toFixed(1)}%</span>
        </div>
        <input type="range" min="-1" max="8" step="0.1" value={state.ss} onChange={(e) => onUpdate({ ss: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-pumpkin" />
        <p className="text-[7px] text-rain uppercase font-bold">Base Portfolio Rent/Escalator Growth</p>
      </div>

      {/* INORGANIC */}
      <div className="aegis-card p-4 border-lightBlue/30 bg-lightBlue/5 space-y-6">
        <div className="flex justify-between items-center text-[10px] font-black text-white">
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-widest">2. Inorganic Non-SS NOI</span>
            <InfoTooltip content="Growth from acquisitions and development deliveries, net of the cost of capital." />
          </div>
          <span className="mono text-lightBlue">+{inorganicTotal.toFixed(1)}%</span>
        </div>

        <div className="space-y-6 pl-2 border-l border-white/10">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">2a. Acquisitions</span>
              <span className="text-[10px] font-black text-white mono">+{acqAccretion.toFixed(1)}%</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[7px] text-rain uppercase font-bold"><span>Volume (% GAV)</span><span>{state.acqVol.toFixed(1)}%</span></div>
              <input type="range" min="0" max="15" step="0.5" value={state.acqVol} onChange={(e) => onUpdate({ acqVol: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-700 rounded-full accent-lightBlue" />
              <div className="flex justify-between text-[7px] text-rain uppercase font-bold"><span>Spread (bps)</span><span>{state.acqSpread.toFixed(0)}bps</span></div>
              <input type="range" min="-50" max="300" step="10" value={state.acqSpread} onChange={(e) => onUpdate({ acqSpread: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-700 rounded-full accent-lightBlue" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">2b. Dev Alpha</span>
              <span className="text-[10px] font-black text-white mono">+{devAccretion.toFixed(1)}%</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[7px] text-rain uppercase font-bold"><span>Deliveries (% GAV)</span><span>{state.devVol.toFixed(1)}%</span></div>
              <input type="range" min="0" max="10" step="0.5" value={state.devVol} onChange={(e) => onUpdate({ devVol: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-700 rounded-full accent-emerald-500" />
              <div className="flex justify-between text-[7px] text-rain uppercase font-bold"><span>Alpha (bps)</span><span>{state.devSpread.toFixed(0)}bps</span></div>
              <input type="range" min="50" max="400" step="10" value={state.devSpread} onChange={(e) => onUpdate({ devSpread: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-700 rounded-full accent-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* LEAKAGE */}
      <div className="aegis-card p-4 border-rose-500/20 bg-rose-500/5 space-y-3">
        <div className="flex justify-between items-center text-[10px] font-black text-white">
          <div className="flex items-center gap-1.5">
            <span className="uppercase tracking-widest">3. CAD Leakage</span>
            <InfoTooltip content="The structural cash drag from recurring maintenance CapEx, TIs, and LCs required to maintain asset quality." />
          </div>
          <span className="mono text-rose-400">{state.leakage.toFixed(1)}%</span>
        </div>
        <input type="range" min="-12" max="0" step="0.1" value={state.leakage} onChange={(e) => onUpdate({ leakage: parseFloat(e.target.value) })} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-rose-500" />
        <p className="text-[7px] text-rain uppercase font-bold">Capital maintenance drag on FFO-to-AFFO</p>
      </div>

      {/* TOTAL G */}
      <div className="bg-pumpkin/10 border border-pumpkin/30 p-4 rounded flex justify-between items-center shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]"></div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black text-pumpkin uppercase tracking-widest">SUSTAINABLE g</span>
          <InfoTooltip content="The total long-term growth rate used in the terminal value calculation of the P/AFFO model." />
        </div>
        <span className="text-xl font-black text-white mono">{netG.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const JustifiedPAFFO: React.FC<JustifiedPAFFOProps> = ({ ticker, sector, portfolio, liveFinancials, model, onUpdateModel }) => {
  const { wacc, growth } = model;
  const [activeRf, setActiveRf] = useState<number | null>(null);
  const [activeG, setActiveG] = useState<number | null>(null);

  const impliedCap = useMemo(() => {
    const targets = portfolio
      ? portfolio.holdings.map(h => ({ reit: REITS.find(r => r.ticker === h.ticker)!, weight: h.weight / 100 }))
      : sector
        ? REITS.filter(r => r.sector === sector).map(r => ({ reit: r, weight: 1 / REITS.filter(re => re.sector === sector).length }))
        : [{ reit: REITS.find(r => r.ticker === ticker)!, weight: 1 }];

    const caps = targets.map(({ reit, weight }) => {
      const market = getMarketDataSync(reit.id)[0];
      const financials = getFinancials(reit.id, liveFinancials);
      const latestFin = financials[financials.length - 1];
      const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
      const ev = market.marketCap + latestFin.totalDebt;
      return { cap: (ttmNOI / ev) * 100, weight };
    });

    return caps.reduce((acc, c) => acc + (c.cap * c.weight), 0) || 5.0;
  }, [ticker, sector, portfolio, liveFinancials]);

  const acqAccretion = (growth.acqVol * (growth.acqSpread / 100)) / impliedCap;
  const devAccretion = (growth.devVol * (growth.devSpread / 100)) / impliedCap;
  const inorganicTotal = acqAccretion + devAccretion;
  const netG = growth.ss + inorganicTotal + growth.leakage + growth.cap;
  const costOfEquity = wacc.rf + (wacc.beta * wacc.erp);

  const calculateJustified = (g: number, r: number, p: number) => {
    const cost = r / 100;
    const growthVal = g / 100;
    const pay = p / 100;
    if (growthVal >= cost) return 45.0;
    const mult = (pay * (1 + growthVal)) / (cost - growthVal);
    return Math.max(5, Math.min(45, mult));
  };

  const justifiedMultiple = calculateJustified(netG, costOfEquity, wacc.payout);

  const historicalG = useMemo(() => {
    const reit = REITS.find(r => r.ticker === ticker)!;
    return getHistoricalLookbacks('g', reit.sector).find(l => l.period === '10Y')!;
  }, [ticker]);

  const updateWacc = (updates: Record<string, any>) => {
    onUpdateModel({ ...model, wacc: { ...wacc, ...updates } });
  };

  const updateGrowth = (updates: Record<string, any>) => {
    onUpdateModel({ ...model, growth: { ...growth, ...updates } });
  };

  const currentMetrics = useMemo(() => {
    const targets = portfolio
      ? portfolio.holdings.map(h => ({ reit: REITS.find(r => r.ticker === h.ticker)!, weight: h.weight / 100 }))
      : sector
        ? REITS.filter(r => r.sector === sector).map(r => ({ reit: r, weight: 1 / REITS.filter(re => re.sector === sector).length }))
        : [{ reit: REITS.find(r => r.ticker === ticker)!, weight: 1 }];

    const results = targets.map(({ reit, weight }) => {
      const market = getMarketDataSync(reit.id)[0];
      const financials = getFinancials(reit.id, liveFinancials);
      const ttmAFFO = financials.slice(-4).reduce((acc, f) => acc + (f.ffo - f.straightLineRent - f.maintenanceCapex), 0);
      const mMultiple = ttmAFFO > 0 ? market.marketCap / ttmAFFO : 0;
      return { mMultiple, weight };
    });

    return { marketMultiple: results.reduce((acc, r) => acc + (r.mMultiple * r.weight), 0) };
  }, [ticker, sector, portfolio, liveFinancials]);

  const axisValues = useMemo(() => ({
    growths: [netG - 1, netG - 0.5, netG, netG + 0.5, netG + 1],
    yields: [wacc.rf - 1, wacc.rf - 0.5, wacc.rf, wacc.rf + 0.5, wacc.rf + 1]
  }), [netG, wacc.rf]);

  const sensitivityData = useMemo(() => {
    return axisValues.yields.map(rf => {
      const r = rf + (wacc.beta * wacc.erp);
      return axisValues.growths.map(g => calculateJustified(g, r, wacc.payout));
    });
  }, [axisValues, wacc.beta, wacc.erp, wacc.payout]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-institutional text-2xl font-black text-white tracking-institutional uppercase">Justified P/AFFO Model</h2>
          <p className="text-[10px] text-rain uppercase tracking-[0.4em] mt-2">Accretion Analysis via Capital Velocity and Spreads</p>
        </div>
        <div className="flex items-center gap-4 bg-darkBlue/60 border border-lightBlue/20 p-4 rounded-lg glass-modal">
          <div className="flex flex-col text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[8px] font-black text-rain uppercase tracking-widest">Ke (Discount Rate)</span>
              <InfoTooltip content="The required rate of return for equity investors, calculated using CAPM (Rf + Beta * ERP)." />
            </div>
            <span className="text-xl font-black text-lightBlue mono">{costOfEquity.toFixed(1)}%</span>
          </div>
          <div className="w-px h-8 bg-rain/20 mx-2"></div>
          <div className="flex flex-col text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[8px] font-black text-rain uppercase tracking-widest">Implied Growth (g)</span>
              <InfoTooltip content="The sustainable long-term growth rate derived from organic SS-NOI and inorganic accretion." />
            </div>
            <span className="text-xl font-black text-pumpkin mono">{netG.toFixed(1)}%</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <aside className="lg:col-span-1 space-y-8">
          <div className="aegis-card gold-braiding p-8 border-gold/20 bg-darkBlue/40">
            <h3 className="text-[11px] font-black text-gold uppercase tracking-[0.4em] mb-6 border-b border-gold/10 pb-4">WACC Protocol</h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Rf (10Y Yield)</span>
                    <InfoTooltip content="The risk-free rate, typically the 10-Year Treasury yield." />
                  </div>
                  <span className="text-white font-black mono text-[11px]">{wacc.rf.toFixed(1)}%</span>
                </div>
                <input type="range" min="2" max="6" step="0.1" value={wacc.rf} onChange={(e) => updateWacc({ rf: parseFloat(e.target.value) })} className="w-full accent-rose-400 h-1 bg-slate-800 rounded-full" />
                <PercentilePicker label="10Y Rate Profile" spot={MACRO_DATA[0].value} p25={2.5} p50={3.9} p75={4.7} accent="lightBlue" currentVal={wacc.rf} currentLabel={wacc.rfLabel} onSelect={(v, l) => updateWacc({ rf: v, rfLabel: l })} />
              </div>

              <div className="space-y-3 group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">ERP</span>
                    <InfoTooltip content="Equity Risk Premium. The excess return required for investing in the stock market over risk-free assets." />
                  </div>
                  <span className="text-white font-black mono text-[11px]">{wacc.erp.toFixed(1)}%</span>
                </div>
                <input type="range" min="3" max="10" step="0.1" value={wacc.erp} onChange={(e) => updateWacc({ erp: parseFloat(e.target.value) })} className="w-full accent-lightBlue h-1 bg-slate-800 rounded-full" />
                <PercentilePicker label="Market Risk Profile" spot={5.0} p25={4.5} p50={5.5} p75={6.5} accent="lightBlue" currentVal={wacc.erp} currentLabel={wacc.erpLabel} onSelect={(v, l) => updateWacc({ erp: v, erpLabel: l })} />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Growth Benchmark (10Y)</span>
                    <InfoTooltip content="Historical 10-year organic growth rate for the sector, used as a baseline for SS-NOI expectations." />
                  </div>
                  <span className="text-white font-black mono text-[11px]">{growth.ss.toFixed(1)}%</span>
                </div>
                <PercentilePicker
                  label="Sector Growth Profile"
                  spot={historicalG.median}
                  p25={historicalG.p25}
                  p50={historicalG.median}
                  p75={historicalG.p75}
                  accent="pumpkin"
                  currentVal={growth.ss}
                  currentLabel={growth.ssLabel || 'custom'}
                  onSelect={(v, l) => updateGrowth({ ss: v, ssLabel: l })}
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-white uppercase tracking-widest">AFFO Payout</span><span className="text-white font-black mono text-[11px]">{wacc.payout.toFixed(1)}%</span></div>
                <input type="range" min="40" max="100" step="1" value={wacc.payout} onChange={(e) => updateWacc({ payout: parseFloat(e.target.value) })} className="w-full accent-gold h-1 bg-slate-800 rounded-full" />
              </div>
            </div>

            <GrowthBridge state={growth} onUpdate={updateGrowth} impliedCap={impliedCap} />
          </div>
        </aside>

        <div className="lg:col-span-3 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="aegis-card gold-braiding p-10 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-lightBlue/5 animate-pulse group-hover:bg-lightBlue/10 transition-colors"></div>
              <span className="text-6xl font-black text-white mono tracking-tighter relative z-10">{justifiedMultiple.toFixed(1)}x</span>
              <div className="text-[10px] font-black text-gold uppercase tracking-[0.4em] mt-4 relative z-10">Justified P/AFFO Multiple</div>
            </div>
            <div className="aegis-card gold-braiding p-10 flex flex-col items-center justify-center bg-darkBlue/20 border-lightBlue/20 opacity-80">
              <span className="text-6xl font-black text-white/40 mono tracking-tighter">{currentMetrics.marketMultiple.toFixed(1)}x</span>
              <div className="text-[10px] font-black text-rain uppercase tracking-[0.4em] mt-4">Current Market P/AFFO</div>
            </div>
          </div>

          <div className="aegis-card gold-braiding p-10 bg-black/30">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-10">Sensitivity Analysis: Sustainable g vs. Risk-Free Yield</h3>
            <div className="grid grid-cols-6 gap-2">
              {/* Top-left corner cell with axis labels */}
              <div className="h-14 flex items-center justify-center bg-obsidian/80 border border-gold/30 rounded">
                <div className="text-center">
                  <div className="text-[9px] font-black text-pumpkin uppercase tracking-wider">Sustainable G →</div>
                  <div className="text-[9px] font-black text-rose-400 uppercase tracking-wider mt-0.5">↓ Risk-Free</div>
                </div>
              </div>
              {/* Column headers - Growth rates */}
              {axisValues.growths.map((g, idx) => (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveG(g)}
                  onMouseLeave={() => setActiveG(null)}
                  className={`h-14 flex flex-col items-center justify-center border transition-all ${
                    activeG === g
                      ? 'bg-pumpkin/20 border-pumpkin/40 rounded-t-lg'
                      : 'bg-obsidian/40 border-gold/20'
                  }`}
                >
                  <span className="text-[9px] font-black text-pumpkin uppercase tracking-wider">Sustain. G</span>
                  <span className={`text-sm font-black mono mt-1 ${
                    activeG === g ? 'text-pumpkin' : 'text-white'
                  }`}>
                    {g.toFixed(1)}%
                  </span>
                </div>
              ))}
              {/* Data rows */}
              {axisValues.yields.map((rf, rfIdx) => (
                <React.Fragment key={rf}>
                  {/* Row header - Risk-free rate */}
                  <div
                    onMouseEnter={() => setActiveRf(rf)}
                    onMouseLeave={() => setActiveRf(null)}
                    className={`h-20 flex items-center justify-center border transition-all ${
                      activeRf === rf
                        ? 'bg-rose-500/20 border-rose-500/40 rounded-l-lg'
                        : 'bg-obsidian/40 border-gold/20'
                    }`}
                  >
                    <div className="text-center px-2">
                      <span className="block text-[9px] font-black text-rose-400 uppercase tracking-wider">Risk-Free</span>
                      <span className={`text-sm font-black mono mt-1 block ${
                        activeRf === rf ? 'text-rose-400' : 'text-white'
                      }`}>
                        {rf.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Data cells - Multiples */}
                  {sensitivityData[rfIdx].map((val, gIdx) => (
                    <div
                      key={gIdx}
                      className={`h-20 rounded-sm flex items-center justify-center border transition-all ${
                        activeRf === rf || activeG === axisValues.growths[gIdx]
                          ? 'brightness-125 border-white/30 shadow-lg'
                          : 'border-white/10'
                      }`}
                      style={{
                        backgroundColor: val > currentMetrics.marketMultiple
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(244, 63, 94, 0.08)',
                        borderColor: val > currentMetrics.marketMultiple
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'rgba(244, 63, 94, 0.2)'
                      }}
                    >
                      <span className={`text-base font-black mono ${
                        val > currentMetrics.marketMultiple ? 'text-emerald-300' : 'text-white'
                      }`}>
                        {val.toFixed(1)}x
                      </span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 aegis-card p-10 bg-darkBlue/20 border-rain/10 overflow-hidden relative">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-10 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-gold"></div>
                Growth Component Definitions & Benchmarks
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="p-6 bg-black/40 border border-white/5 rounded-lg font-mono">
                    <div className="text-[10px] text-rain uppercase mb-4 border-b border-white/5 pb-2">Accretion Equation Logic</div>
                    <div className="space-y-5">
                      <div className="flex justify-between items-start text-[11px]">
                        <div className="flex flex-col">
                          <span className="text-lightBlue uppercase font-bold">GAV (Gross Asset Value)</span>
                          <span className="text-[8px] text-slate-500 font-bold italic">Denominator for growth. Mkt Cap + Net Debt.</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[11px] pt-2 border-t border-white/5">
                        <div className="flex flex-col">
                          <span className="text-rose-400 uppercase font-bold">CAD Leakage (Cap-Ex)</span>
                          <span className="text-[8px] text-slate-500 font-bold">({Math.abs(growth.leakage).toFixed(1)}% of NOI: TIs, LCs & Maintenance)</span>
                        </div>
                        <span className="text-rose-400 font-black">{growth.leakage.toFixed(1)}%</span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] pt-2 border-t border-white/5">
                        <div className="flex flex-col">
                          <span className="text-emerald-400 uppercase font-bold">Inorganic Non-SS Rollup</span>
                          <span className="text-[8px] text-slate-500 font-bold">(Net Additive: Acquisitions + Development Alpha)</span>
                        </div>
                        <span className="text-white">+{inorganicTotal.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-lg">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">Reasonable Ranges: External Spreads</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[9px]"><span className="text-slate-400">Stable Acquisitions:</span><span className="text-white font-bold">75 - 125 bps</span></div>
                      <div className="flex justify-between text-[9px]"><span className="text-slate-400">Opportunistic Dev:</span><span className="text-white font-bold">150 - 250 bps</span></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-1 h-14 bg-rose-500"></div>
                      <div>
                        <span className="text-[10px] font-bold text-white uppercase block">CAD Leakage vs. Property OpEx</span>
                        <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                          Routine "make-ready" (cleaning, minor paint) is OpEx and already in <span className="text-white font-bold">NOI</span>.
                          <br /><br />
                          <span className="text-white font-bold">CAD Leakage</span> represents capitalized "big ticket" cash drag: 2nd Gen TIs, Leasing Commissions (LCs), and major structural capex.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-1 h-14 bg-lightBlue"></div>
                      <div>
                        <span className="text-[10px] font-bold text-white uppercase block">Inorganic Growth Accuracy</span>
                        <p className="text-[9px] text-slate-400 mt-1 leading-relaxed italic text-rain">
                          Accretion is calculated as investment volume multiplied by incremental yield spread, normalized by current portfolio cap rate. Formula: (Vol % * Spread bps/100) / CapRate.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="aegis-card p-8 bg-darkBlue/40 border border-lightBlue/30 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-lightBlue/5 blur-3xl rounded-full"></div>
              <h3 className="text-sm font-black text-lightBlue uppercase tracking-widest mb-6 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                Institutional Valuation Logic
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="bg-emerald-500/5 p-4 border border-emerald-500/20 rounded space-y-2">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Justified P/AFFO Formula</span>
                    <span className="text-[11px] font-black text-white mono block">P/AFFO = [Payout × (1 + g)] / [k - g]</span>
                    <p className="text-[8px] text-slate-500 leading-tight">Payout = % of AFFO as Dividend | k = Discount Rate | g = Sustainable Growth</p>
                  </div>

                  <div className="bg-pumpkin/5 p-4 border border-pumpkin/20 rounded space-y-2">
                    <span className="text-[9px] font-black text-pumpkin uppercase tracking-widest">Sustainable g Formula</span>
                    <span className="text-[10px] font-black text-white mono block">g = SS-NOI + Accretion + Leakage + Cap Impact</span>
                    <p className="text-[8px] text-slate-500 leading-tight">Linear approximation of sustainable growth: organic rent growth plus inorganic accretion, net of recurring maintenance drag and capital structure impact.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-rose-500/5 p-4 border border-rose-500/20 rounded space-y-2">
                    <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">CAD Leakage Formula</span>
                    <span className="text-[10px] font-black text-white mono block">Leakage = Maintenance CapEx / TTM NOI</span>
                    <p className="text-[8px] text-slate-500 leading-tight">The structural "cash drag" from maintaining asset quality across cycles.</p>
                  </div>

                  <div className="p-4 bg-black/30 border border-white/5 rounded">
                    <p className="text-[10px] text-slate-400 leading-relaxed uppercase font-bold tracking-tighter">
                      Note: Sustainable g is a multi-period concept. This model treats it as a terminal perpetuity rate for valuing the FFO stream.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Manager */}
      <ScenarioManager
        ticker={ticker}
        model={model}
        onLoadScenario={onUpdateModel}
        impliedCapRate={impliedCap}
      />
    </div>
  );
};

export default JustifiedPAFFO;
