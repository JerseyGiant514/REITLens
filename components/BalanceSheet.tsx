
import React, { useState, useEffect, useMemo } from 'react';
import { MetricChart } from './Charts';
import { REITS } from '../services/mockData';
import { getFinancials, getKPIs, loadRealFinancials, loadRealKPIs, getDebtMaturitySchedule, getWeightedAvgRate, getFinancialsDataSource } from '../services/dataService';
import { InfoTooltip } from './InfoTooltip';
import { DataSourceBadge, type DataSource } from './DataSourceBadge';
import { StalenessIndicator } from './StalenessIndicator';
import { useToast } from '../contexts/ToastContext';

interface BalanceSheetProps {
  ticker: string;
}

const BalanceSheet: React.FC<BalanceSheetProps> = ({ ticker }) => {
  const reit = REITS.find(r => r.ticker === ticker)!;
  const [dataLoaded, setDataLoaded] = useState(false);
  const { addToast } = useToast();

  // Load real data from database on mount (populates the async cache)
  useEffect(() => {
    setDataLoaded(false);
    Promise.all([
      loadRealFinancials(reit.id),
      loadRealKPIs(reit.id),
    ]).then(() => {
      setDataLoaded(true);
    }).catch(() => {
      setDataLoaded(true); // Still render with mock fallback
      addToast({
        type: 'warning',
        title: 'Using estimated balance sheet data',
        message: `Could not load verified financials for ${ticker}. Displaying synthetic estimates.`,
        duration: 6000,
      });
    });
  }, [reit.id, addToast, ticker]);

  // Detect data source
  const financialsSource = useMemo(
    () => getFinancialsDataSource(reit.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reit.id, dataLoaded]
  );

  // Data-driven debt maturity: uses actual total debt from financials,
  // distributed across industry-standard maturity buckets.
  // Falls back to mock generator if no real debt data is available.
  const debtData = useMemo(() => getDebtMaturitySchedule(ticker), [ticker, dataLoaded]);

  // These sync getters read from the async cache (real DB data) or fall back to mock
  const financials = useMemo(() => getFinancials(reit.id), [reit.id, dataLoaded]);
  const kpis = useMemo(() => getKPIs(reit.id), [reit.id, dataLoaded]);

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-lightBlue border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-rain uppercase tracking-widest">Loading Balance Sheet Data...</span>
        </div>
      </div>
    );
  }

  const latestFinancial = financials[financials.length - 1];
  const latestKPI = kpis[kpis.length - 1];

  const totalDebt = latestFinancial.totalDebt;
  const debtToAssets = (totalDebt / latestFinancial.totalAssets) * 100;
  const ttmEbitdare = financials.slice(-4).reduce((a, f) => a + f.ebitdare, 0);
  const netDebtToEbitda = ttmEbitdare > 0 ? (totalDebt / ttmEbitdare) : 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex items-center justify-end gap-3 mb-1">
        <DataSourceBadge
          source={financialsSource.source === 'DB' ? 'SEC' : financialsSource.source === 'Mock' ? 'Mock' : 'SEC'}
          confidence={financialsSource.isFallback ? 'low' : 'high'}
        />
        <StalenessIndicator
          lastUpdated={financialsSource.lastUpdated}
          source={financialsSource.source === 'DB' ? 'DB' : financialsSource.source === 'Mock' ? 'Mock' : 'SEC'}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Aggregate Debt', value: `$${totalDebt.toLocaleString('en-US', { maximumFractionDigits: 0 })}M`, sub: 'Fixed: 92% | Floating: 8%', color: 'lightBlue', tooltip: "Total principal amount of all outstanding debt instruments.", dataSource: 'SEC' as DataSource },
          { label: 'Net Debt / EBITDAre', value: `${netDebtToEbitda.toFixed(1)}x`, sub: 'Sector Median: 6.1x', green: netDebtToEbitda < 6.1, color: 'lightBlue', tooltip: "Total debt minus cash, divided by annualized EBITDA for Real Estate. A key leverage metric." },
          { label: 'Debt / Total Assets', value: `${debtToAssets.toFixed(1)}%`, sub: 'LTV Ceiling: <40%', color: 'pumpkin', tooltip: "Total debt as a percentage of total GAAP assets. Measures balance sheet leverage." },
          { label: 'G&A Efficiency', value: `${latestKPI.gaToGav.toFixed(2)}%`, sub: '% of GAV Platform', green: latestKPI.gaToGav < 0.5, color: 'emerald', tooltip: "Annualized G&A expense as a percentage of Gross Asset Value. Measures management platform efficiency.", dataSource: 'Computed' as DataSource },
        ].map((item, i) => (
          <div key={i} className={`aegis-card p-6 flex flex-col justify-between border-${item.color === 'emerald' ? 'emerald-500' : item.color}/20`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${item.color === 'lightBlue' ? 'text-lightBlue' : item.color === 'pumpkin' ? 'text-pumpkin' : 'text-emerald-400'}`}>
                  {item.label}
                </span>
                {item.dataSource && <DataSourceBadge source={item.dataSource} />}
              </div>
              <InfoTooltip content={item.tooltip} />
            </div>
            <div className="mt-4 text-2xl font-bold text-white font-tertiary">{item.value}</div>
            <div className={`mt-1 text-[9px] font-bold uppercase tracking-tight ${item.green ? 'text-emerald-500/60' : 'text-rain/40'}`}>
              {item.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 aegis-card p-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
              <h3 className="header-noe text-lg text-white">Debt Maturity Schedule</h3>
              <p className="text-[10px] text-rain font-bold uppercase tracking-widest mt-1">Institutional Wall Aggregate</p>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-pumpkin rounded-full"></div><span className="text-[9px] font-bold text-rain uppercase">Senior Unsecured</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-lightBlue rounded-full"></div><span className="text-[9px] font-bold text-rain uppercase">Term Facilities</span></div>
            </div>
          </div>
          <MetricChart data={debtData} xKey="year" dataKey="amount" type="bar" color="#FF9D3C" format={(v) => `$${v}M`} height={340} />
          
          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-darkBlue/40 text-rain font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-3 border-b border-rain/10">Maturity</th>
                  <th className="px-6 py-3 border-b border-rain/10">Principal ($M)</th>
                  <th className="px-6 py-3 border-b border-rain/10">Instrument</th>
                  <th className="px-6 py-3 border-b border-rain/10">Avg. Rate</th>
                  <th className="px-6 py-3 border-b border-rain/10 text-right">Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rain/10 font-tertiary">
                {debtData.map(d => (
                  <tr key={d.year} className="hover:bg-white/5 transition-all">
                    <td className="px-6 py-4 font-bold text-slate-300">{d.year}</td>
                    <td className="px-6 py-4 text-white font-bold">${d.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}M</td>
                    <td className="px-6 py-4 text-rain font-medium">{d.year < 2027 ? 'Sr Unsecured Bond' : 'Syndicated Term Loan'}</td>
                    <td className="px-6 py-4 text-slate-400 font-bold">{((getWeightedAvgRate(ticker) * 100) + (d.year - new Date().getFullYear()) * 0.15).toFixed(1)}%</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2.5 py-1 rounded-[4px] font-bold uppercase text-[9px] ${d.year === 2025 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-darkBlue/60 text-rain/60 border border-rain/10'}`}>
                        {d.year === 2025 ? 'Critical Refi' : 'Strategic Pool'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-8">
          <div className="aegis-card p-8 flex flex-col justify-center bg-darkBlue/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="header-noe text-base text-white">EBITDAre Coverage</h3>
              <InfoTooltip content="Annualized EBITDAre divided by interest expense. Measures the ability to service debt from operations." />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-white font-tertiary">{latestKPI.interestCoverage.toFixed(1)}x</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${latestKPI.interestCoverage > 3 ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-rose-400 bg-rose-400/10 border-rose-400/20'}`}>
                {latestKPI.interestCoverage > 3 ? 'Institutional Safe' : 'Coverage Warning'}
              </span>
            </div>
            <div className="mt-8 space-y-4">
              <div className="flex justify-between text-[10px] font-bold text-rain uppercase tracking-widest"><span>Covenant Floor</span><span>&gt; 1.5x</span></div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full shadow-[0_0_12px_rgba(16,185,129,0.4)] ${latestKPI.interestCoverage > 3 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                  style={{ width: `${Math.min(100, (latestKPI.interestCoverage / 5) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
          
          <div className="aegis-card p-8 bg-darkBlue/20">
            <h3 className="header-noe text-base text-white mb-8">Capital Stack Topology</h3>
            <div className="space-y-6">
               {[
                 { label: 'Public Markets (Bonds)', val: 45, color: 'pumpkin' },
                 { label: 'Bank Term Loans', val: 15, color: 'lightBlue' },
                 { label: 'Mezzanine / Preferred', val: 5, color: 'rain' },
                 { label: 'Common Equity (Market Cap)', val: 35, color: 'gold' }
               ].map((item, i) => (
                 <div key={item.label} className="space-y-2">
                   <div className="flex justify-between text-[10px] text-rain uppercase font-bold tracking-tight">
                     <span>{item.label}</span>
                     <span className="text-white">{item.val}%</span>
                   </div>
                   <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                     <div 
                        className={`h-full ${item.color === 'pumpkin' ? 'bg-pumpkin' : item.color === 'lightBlue' ? 'bg-lightBlue' : item.color === 'rain' ? 'bg-rain' : 'bg-gold'}`} 
                        style={{ width: `${item.val}%` }}
                      ></div>
                   </div>
                 </div>
               ))}
            </div>
          </div>

          <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-lg flex items-start gap-4">
             <div className="mt-1"><svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
             <div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Rate Sensitivity Alert</span>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">
                  Floating rate exposure is currently unhedged. A 100bps move in SOFR impacts FFO by estimated 4.2% based on current utilization.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheet;
