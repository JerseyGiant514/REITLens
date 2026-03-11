
import React, { useMemo } from 'react';
import { MetricChart } from './Charts';
import { REITS } from '../services/mockData';
import { Sector, Portfolio, FinancialsQuarterly } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { InfoTooltip } from './InfoTooltip';
import { getFinancials, getKPIs, getFinancialsDataSource } from '../services/dataService';
import { DataSourceBadge, type DataSource } from './DataSourceBadge';
import { StalenessIndicator } from './StalenessIndicator';

interface OperationsProps {
  ticker: string;
  sector: Sector | null;
  portfolio: Portfolio | null;
  liveFinancials?: FinancialsQuarterly[];
}

const Operations: React.FC<OperationsProps> = ({ ticker, sector, portfolio, liveFinancials }) => {
  const constituents = useMemo(() => {
    if (portfolio) {
      return portfolio.holdings.map(h => ({
        reit: REITS.find(r => r.ticker === h.ticker)!,
        weight: h.weight / 100
      }));
    }
    const list = sector ? REITS.filter(r => r.sector === sector) : [REITS.find(r => r.ticker === ticker)!];
    return list.map(reit => ({ reit, weight: 1 / list.length }));
  }, [ticker, sector, portfolio]);

  // Data source detection for primary constituent
  const primaryReit = constituents[0]?.reit;
  const financialsSource = useMemo(
    () => primaryReit ? getFinancialsDataSource(primaryReit.id) : null,
    [primaryReit?.id]
  );

  const latestAggregates = useMemo(() => {
    const dataPoints = constituents.map(({ reit, weight }) => {
      const kpis = getKPIs(reit.id, liveFinancials);
      const latest = kpis[kpis.length - 1];
      return {
        occupancy: latest.occupancy,
        leasingSpread: latest.leasingSpread,
        walt: latest.walt,
        ssNoi: latest.sameStoreNOIGrowth,
        weight
      };
    });

    // Weighted averages
    const wtdOccupancy = dataPoints.reduce((sum, d) => sum + (d.occupancy * d.weight), 0);
    const wtdLeasingSpread = dataPoints.reduce((sum, d) => sum + (d.leasingSpread * d.weight), 0);
    const wtdWalt = dataPoints.reduce((sum, d) => sum + (d.walt * d.weight), 0);
    const wtdSsNoi = dataPoints.reduce((sum, d) => sum + (d.ssNoi * d.weight), 0);

    return {
      occupancy: wtdOccupancy,
      leasingSpread: wtdLeasingSpread,
      walt: wtdWalt,
      ssNoi: wtdSsNoi,
      chartData: getKPIs(constituents[0].reit.id, liveFinancials), // Proxy trend
      financials: getFinancials(constituents[0].reit.id, liveFinancials)
    };
  }, [constituents, liveFinancials]);

  const capexData = useMemo(() => {
    const latest = latestAggregates.financials[latestAggregates.financials.length - 1];
    return [
      { name: 'Maintenance', value: latest.maintenanceCapex, color: '#f43f5e' },
      { name: 'Growth', value: latest.growthCapex, color: '#10b981' }
    ];
  }, [latestAggregates.financials]);

  const noiComparisonData = useMemo(() => {
    return latestAggregates.financials.map(f => ({
      date: f.periodEndDate,
      gaapNoi: f.noi,
      cashNoi: f.noi - f.straightLineRent
    }));
  }, [latestAggregates.financials]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-end gap-3 mb-1">
        {financialsSource && (
          <DataSourceBadge
            source={financialsSource.source === 'DB' ? 'SEC' : financialsSource.source === 'Mock' ? 'Mock' : 'SEC'}
            confidence={financialsSource.isFallback ? 'low' : 'high'}
          />
        )}
        {financialsSource && (
          <StalenessIndicator
            lastUpdated={financialsSource.lastUpdated}
            source={financialsSource.source === 'DB' ? 'DB' : financialsSource.source === 'Mock' ? 'Mock' : 'SEC'}
          />
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Wtd. Occupancy', val: `${latestAggregates.occupancy.toFixed(1)}%`, sub: 'Port. Average', blue: true, tooltip: "The weighted average percentage of the portfolio's total leasable area that is currently occupied.", dataSource: 'Mock' as DataSource },
          { label: 'Wtd. Leasing Spreads', val: `+${latestAggregates.leasingSpread.toFixed(1)}%`, sub: 'Cash Basis', green: true, tooltip: "The percentage change in rent for new or renewal leases compared to the previous rent on the same space." },
          { label: 'Wtd. WALT', val: `${latestAggregates.walt.toFixed(1)}Y`, sub: 'Portfolio Life', blue: true, tooltip: "Weighted Average Lease Term. The average remaining duration of all leases in the portfolio." },
          { label: 'Wtd. SS NOI Growth', val: `${latestAggregates.ssNoi.toFixed(1)}%`, sub: 'Strategy Core', green: true, tooltip: "Same-Store Net Operating Income growth. Measures the organic performance of properties owned for at least 12 months.", dataSource: 'Computed' as DataSource },
        ].map((k, i) => (
          <div key={i} className="bg-[#1e293b] p-6 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{k.label}</span>
                {k.dataSource && <DataSourceBadge source={k.dataSource} />}
              </div>
              <InfoTooltip content={k.tooltip} />
            </div>
            <div className="mt-2 text-2xl font-bold text-white mono">{k.val}</div>
            <div className={`mt-1 text-[10px] font-bold uppercase ${k.green ? 'text-emerald-400' : 'text-slate-400'}`}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cash vs GAAP NOI Normalization</h3>
            <InfoTooltip content="GAAP NOI includes non-cash straight-line rent adjustments. Cash NOI represents actual rent collected." />
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={noiComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => v.split('-').slice(1).join('/')} />
                <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `$${v}M`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', paddingTop: '20px' }} />
                <Bar dataKey="gaapNoi" name="GAAP NOI" fill="#48A3CC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cashNoi" name="Cash NOI" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">CapEx Intensity Breakdown</h3>
            <InfoTooltip content="Distinguishes between recurring maintenance costs and discretionary growth investments." />
          </div>
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-slate-700 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Maintenance CapEx</span>
                <div className="text-xl font-bold text-rose-400 mono">${capexData[0].value}M</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">% of NOI</span>
                <div className="text-xl font-bold text-white mono">{(capexData[0].value / latestAggregates.financials[latestAggregates.financials.length - 1].noi * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="flex justify-between items-end border-b border-slate-700 pb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Growth CapEx</span>
                <div className="text-xl font-bold text-emerald-400 mono">${capexData[1].value}M</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">% of NOI</span>
                <div className="text-xl font-bold text-white mono">{(capexData[1].value / latestAggregates.financials[latestAggregates.financials.length - 1].noi * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 italic text-[11px] text-slate-400">
              Note: Maintenance CapEx is deducted from FFO to arrive at AFFO. Growth CapEx is capitalized and excluded from the payout ratio denominator.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Operations;
