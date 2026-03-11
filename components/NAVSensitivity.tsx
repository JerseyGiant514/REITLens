
import React, { useMemo, useState, useEffect } from 'react';
import { REIT, FinancialsQuarterly } from '../types';
import { REITS } from '../services/mockData';
import { getFinancials, getMarketDataSync, loadRealFinancials } from '../services/dataService';

interface NAVSensitivityProps {
  ticker: string;
}

const NAVSensitivity: React.FC<NAVSensitivityProps> = ({ ticker }) => {
  const reit = REITS.find(r => r.ticker === ticker)!;
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load real data from database on mount (populates the async cache)
  useEffect(() => {
    setDataLoaded(false);
    loadRealFinancials(reit.id).then(() => {
      setDataLoaded(true);
    }).catch(() => {
      setDataLoaded(true); // Still render with mock fallback
    });
  }, [reit.id]);

  // These sync getters read from the async cache (real DB data) or fall back to mock
  const financials = useMemo(() => getFinancials(reit.id), [reit.id, dataLoaded]);
  const market = useMemo(() => getMarketDataSync(reit.id)[0], [reit.id, dataLoaded]);

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-rain uppercase tracking-widest">Loading NAV Sensitivity Data...</span>
        </div>
      </div>
    );
  }

  const latestFin = financials[financials.length - 1];
  const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);

  const spotCap = (ttmNOI / (market.marketCap + latestFin.totalDebt)) * 100;
  
  // Equity Duration = (1 / CapRate) * (GAV / Equity)
  const equityDuration = useMemo(() => {
    const capDecimal = spotCap / 100;
    const gav = market.marketCap + latestFin.totalDebt;
    const equity = market.marketCap;
    if (equity === 0 || capDecimal === 0) return 0;
    return (1 / capDecimal) * (gav / equity);
  }, [spotCap, market.marketCap, latestFin.totalDebt]);

  const capRateSteps = [-100, -75, -50, -25, 0, 25, 50, 75, 100]; // bps

  const sensitivityData = useMemo(() => {
    return capRateSteps.map(bps => {
      const adjustedCap = (spotCap + (bps / 100)) / 100;
      const theoreticalGAV = ttmNOI / adjustedCap;
      const theoreticalEquity = theoreticalGAV - (latestFin.totalDebt);
      const theoreticalPrice = theoreticalEquity / latestFin.dilutedShares;
      const discount = ((theoreticalPrice - market.closePrice) / theoreticalPrice) * 100;

      return {
        bps,
        cap: adjustedCap * 100,
        price: theoreticalPrice,
        discount
      };
    });
  }, [spotCap, ttmNOI, latestFin, market.closePrice]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-institutional text-2xl font-black text-white tracking-institutional uppercase">NAV Sensitivity Matrix</h2>
          <p className="text-[10px] text-rain uppercase tracking-[0.4em] mt-2">Cap Rate Expansion/Compression Impact on Equity Value</p>
        </div>
        <div className="flex items-center gap-4 bg-darkBlue/60 border border-gold/20 p-4 rounded-lg">
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black text-rain uppercase tracking-widest">NAV Duration</span>
            <span className="text-xl font-black text-pumpkin mono">{equityDuration.toFixed(1)}x</span>
          </div>
          <div className="w-px h-8 bg-rain/20 mx-2"></div>
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black text-rain uppercase tracking-widest">Spot Cap Rate</span>
            <span className="text-xl font-black text-gold mono">{spotCap.toFixed(2)}%</span>
          </div>
          <div className="w-px h-8 bg-rain/20 mx-2"></div>
          <div className="flex flex-col text-right">
            <span className="text-[8px] font-black text-rain uppercase tracking-widest">Spot Price</span>
            <span className="text-xl font-black text-white mono">${market.closePrice.toFixed(2)}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 aegis-card gold-braiding overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-obsidian/60 border-b border-rain/10">
              <tr>
                <th className="px-8 py-5 font-black text-rain uppercase text-[10px] tracking-widest">Cap Rate Shift (bps)</th>
                <th className="px-8 py-5 font-black text-rain uppercase text-[10px] tracking-widest text-center">Effective Cap</th>
                <th className="px-8 py-5 font-black text-rain uppercase text-[10px] tracking-widest text-center">Theoretical NAV/Sh</th>
                <th className="px-8 py-5 font-black text-rain uppercase text-[10px] tracking-widest text-right">NAV Upside / (Downside)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rain/5">
              {sensitivityData.map((row) => (
                <tr key={row.bps} className={`hover:bg-white/5 transition-colors ${row.bps === 0 ? 'bg-lightBlue/5' : ''}`}>
                  <td className="px-8 py-5 text-[11px] font-black text-white mono">
                    {row.bps > 0 ? '+' : ''}{row.bps} bps
                  </td>
                  <td className="px-8 py-5 text-center text-[11px] font-black text-slate-400 mono">
                    {row.cap.toFixed(2)}%
                  </td>
                  <td className="px-8 py-5 text-center text-[12px] font-black text-white mono">
                    ${row.price.toFixed(2)}
                  </td>
                  <td className={`px-8 py-5 text-right text-[11px] font-black mono ${row.discount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.discount >= 0 ? '+' : ''}{row.discount.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-8">
           <div className="aegis-card p-10 bg-darkBlue/20 border-rain/10">
             <h3 className="header-institutional text-sm font-black text-white uppercase tracking-widest mb-6">Assumptions Protocol</h3>
             <ul className="space-y-6 text-[11px] text-slate-400 leading-relaxed font-medium">
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1"></div>
                  <span><strong>Equity Duration:</strong> Measures sensitivity of Equity Value to cap rate moves. Calculated as <code>(1 / Cap Rate) * (GAV / Equity)</code>.</span>
                </li>
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1"></div>
                  <span><strong>Net Debt:</strong> Held constant at current reported levels. No impact from interest rate changes on NAV calculation.</span>
                </li>
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1"></div>
                  <span><strong>NOI Base:</strong> TTM Reported NOI used as the perpetual cash flow baseline.</span>
                </li>
                <li className="flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1"></div>
                  <span><strong>GAV Methodology:</strong> Derived via simple direct capitalization. Does not account for portfolio premium or platform value.</span>
                </li>
             </ul>
           </div>

           <div className="bg-pumpkin/5 border border-pumpkin/20 p-8 rounded-lg flex items-start gap-4 shadow-2xl">
              <svg className="w-6 h-6 text-pumpkin mt-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <div>
                 <span className="text-[10px] font-black text-pumpkin uppercase tracking-widest">Duration Risk Warning</span>
                 <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-2 italic">
                   The Equity NAV Duration of <span className="text-white font-bold">{equityDuration.toFixed(1)}x</span> indicates that a 100bps move in market cap rates would theoretically shift the share price by approximately <span className="text-white font-bold">{equityDuration.toFixed(1)}%</span>.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default NAVSensitivity;
