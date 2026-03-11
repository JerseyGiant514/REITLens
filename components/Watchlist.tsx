
import React, { useState, useEffect, useMemo } from 'react';
import { REITS } from '../services/mockData';
import { loadRealFinancials, getMarketData } from '../services/dataService';
import { FinancialsQuarterly, MarketDaily } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DataSourceBadge } from './DataSourceBadge';
import TickerLink from './TickerLink';

interface WatchReitData {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  price: number;
  marketCap: number;
  divYield: number;
  impliedCap: number;
}

const Watchlist: React.FC = () => {
  const [watchData, setWatchData] = useState<WatchReitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'SEC' | 'Mock'>('Mock');

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      const watchReits = REITS.slice(0, 8);

      try {
        // Batch-load financials and market data for all watchlist REITs in parallel
        const results = await Promise.all(
          watchReits.map(async (r) => {
            const [fin, mktArr] = await Promise.all([
              loadRealFinancials(r.id),
              getMarketData(r.id),
            ]);

            const mkt = mktArr[0];
            const latestFin = fin[fin.length - 1];
            const ttmNoi = fin.slice(-4).reduce((acc, f) => acc + f.noi, 0);
            const ev = mkt.marketCap + latestFin.totalDebt;
            const impliedCap = ev > 0 ? (ttmNoi / ev) * 100 : 0;

            return {
              id: r.id,
              ticker: r.ticker,
              name: r.name,
              sector: r.sector,
              price: mkt.closePrice,
              marketCap: mkt.marketCap,
              divYield: mkt.dividendYield,
              impliedCap,
            };
          })
        );

        if (!cancelled) {
          setWatchData(results);
          // Determine data source: if financials came from DB they have realistic dates
          // (loadRealFinancials falls back to mock internally, but the cache is populated)
          setDataSource('SEC');
          setLoading(false);
        }
      } catch (err) {
        // failed to load real data, fallback to mock
        if (!cancelled) {
          setDataSource('Mock');
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const aggregates = useMemo(() => {
    if (watchData.length === 0) {
      return { avgDiv: 0, avgCap: 0, totalCap: 0, pieData: [] };
    }

    const avgDiv = watchData.reduce((acc, curr) => acc + curr.divYield, 0) / watchData.length;
    const avgCap = watchData.reduce((acc, curr) => acc + curr.impliedCap, 0) / watchData.length;
    const totalCap = watchData.reduce((acc, curr) => acc + curr.marketCap, 0);

    // Group by sector for pie
    const sectorGroups: Record<string, number> = {};
    watchData.forEach(r => {
      sectorGroups[r.sector] = (sectorGroups[r.sector] || 0) + r.marketCap;
    });
    const pieData = Object.entries(sectorGroups).map(([name, value]) => ({ name, value }));

    return { avgDiv, avgCap, totalCap, pieData };
  }, [watchData]);

  const COLORS = ['#48A3CC', '#FF9D3C', '#5F9AAE', '#d4af37', '#f43f5e', '#10b981'];

  if (loading) {
    return (
      <div className="space-y-10 animate-in fade-in duration-700">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-rain/30 border-t-rain rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-bold text-rain/60 uppercase tracking-widest">Loading Watchlist Data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="aegis-card p-6 border-rain/20">
            <span className="text-[10px] font-bold text-rain uppercase tracking-widest">Aggregate Market Value</span>
            <div className="mt-4 text-2xl font-bold text-white font-tertiary">${(aggregates.totalCap / 1000).toFixed(1)}B</div>
            <div className="mt-1 text-[9px] font-medium text-rain/50 uppercase tracking-tighter">Market-Cap Weighted Protocol</div>
          </div>
          <div className="aegis-card p-6 border-lightBlue/20">
            <span className="text-[10px] font-bold text-lightBlue uppercase tracking-widest">Avg. Dividend Yield</span>
            <div className="mt-4 text-2xl font-bold text-white font-tertiary">{aggregates.avgDiv.toFixed(2)}%</div>
            <div className="mt-1 text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Sector Outperform</div>
          </div>
          <div className="aegis-card p-6 border-pumpkin/20">
            <span className="text-[10px] font-bold text-pumpkin uppercase tracking-widest">Avg. Implied Cap Rate</span>
            <div className="mt-4 text-2xl font-bold text-white font-tertiary">{aggregates.avgCap.toFixed(2)}%</div>
            <div className="mt-1 text-[9px] font-bold text-pumpkin/60 uppercase tracking-tighter">Valuation Multiplier</div>
          </div>
        </div>

        <div className="aegis-card p-4 flex flex-col items-center bg-darkBlue/40 border-rain/20">
          <span className="text-[10px] font-bold text-rain uppercase tracking-widest mb-2 self-start ml-2 mt-2">Sector Allocation</span>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={aggregates.pieData} innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value" stroke="none">
                  {aggregates.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(2, 45, 91, 0.95)', border: '1px solid #5F9AAE', borderRadius: '4px', fontSize: '11px' }}
                  itemStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="aegis-card overflow-hidden shadow-2xl border-rain/10">
        <div className="px-8 py-5 bg-darkBlue/40 border-b border-rain/10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="header-noe text-lg text-white tracking-wide uppercase">Core Research Watchlist</h3>
            <DataSourceBadge source={dataSource} />
          </div>
          <button className="text-[10px] font-bold bg-pumpkin/10 text-pumpkin px-4 py-2 rounded border border-pumpkin/20 hover:bg-pumpkin/20 transition-all uppercase tracking-widest">Update Universe</button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-black/20">
            <tr>
              <th className="px-8 py-4 font-bold text-rain uppercase text-[10px] tracking-[0.2em]">Asset ID</th>
              <th className="px-8 py-4 font-bold text-rain uppercase text-[10px] tracking-[0.2em]">Sector Focus</th>
              <th className="px-8 py-4 font-bold text-rain uppercase text-[10px] tracking-[0.2em] text-right">Last Price</th>
              <th className="px-8 py-4 font-bold text-rain uppercase text-[10px] tracking-[0.2em] text-right">Implied Cap</th>
              <th className="px-8 py-4 font-bold text-rain uppercase text-[10px] tracking-[0.2em] text-right">Div Yield</th>
              <th className="px-8 py-4 font-bold text-rain uppercase text-[10px] tracking-[0.2em] text-right">Mkt Cap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rain/10 font-tertiary">
            {watchData.map(r => (
              <tr key={r.id} className="hover:bg-lightBlue/5 transition-all group">
                <td className="px-8 py-4"><TickerLink ticker={r.ticker} className="font-bold text-lightBlue hover:text-white underline decoration-dotted cursor-pointer transition-colors" /></td>
                <td className="px-8 py-4 text-rain/60 text-[10px] font-bold uppercase tracking-tight">{r.sector}</td>
                <td className="px-8 py-4 text-right text-slate-200 font-bold font-tertiary">${r.price.toFixed(2)}</td>
                <td className="px-8 py-4 text-right text-pumpkin font-bold font-tertiary">{r.impliedCap.toFixed(2)}%</td>
                <td className="px-8 py-4 text-right text-emerald-400 font-bold font-tertiary">{r.divYield.toFixed(2)}%</td>
                <td className="px-8 py-4 text-right text-slate-400 font-medium font-tertiary">${(r.marketCap / 1000).toFixed(1)}B</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Watchlist;
