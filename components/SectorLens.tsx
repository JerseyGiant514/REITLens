
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { REITS } from '../services/mockData';
import { Sector } from '../types';
import { loadRealFinancials, getMarketData, loadRealKPIs } from '../services/dataService';
import { FinancialsQuarterly, MarketDaily, REITKPIs } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { InfoTooltip } from './InfoTooltip';
import { getSectorReturnProfiles, FALLBACK_SECTOR_RETURN_PROFILES } from '../services/historicalReturnsService';

type ReturnPeriod = '1M' | 'CYTD' | '1Y' | '3Y' | '5Y' | '10Y';

interface SectorMetrics {
  sector: Sector;
  count: number;
  medEvNoi: number;
  medImpliedCap: number;
  medDivYield: number;
  medSsNoi: number;
  medReturn: number;
}

// Per-REIT loaded data for sector aggregation
interface ReitLoadedData {
  reitId: string;
  sector: Sector;
  financials: FinancialsQuarterly[];
  market: MarketDaily;
  kpis: REITKPIs[];
}

/** Data-driven highlight cards derived from sector return profiles */
const HighlightCards: React.FC<{ sectorReturnProfiles: Record<string, Record<string, number>> }> = ({ sectorReturnProfiles }) => {
  // Find the sector with best 10Y cumulative return
  let best10YSector = 'Industrial';
  let best10YReturn = 0;
  for (const [sector, profile] of Object.entries(sectorReturnProfiles)) {
    const val = profile['10Y'] ?? 0;
    if (val > best10YReturn) {
      best10YReturn = val;
      best10YSector = sector;
    }
  }

  // Find the sector with best 1Y return (short-term alpha)
  let best1YSector = 'Data Centers';
  let best1YReturn = 0;
  for (const [sector, profile] of Object.entries(sectorReturnProfiles)) {
    const val = profile['1Y'] ?? 0;
    if (val > best1YReturn) {
      best1YReturn = val;
      best1YSector = sector;
    }
  }

  // Find the "cyclical recovery" candidate: sector with moderate positive 1Y
  // but that isn't the top 1Y or 10Y performer (provides diversification insight)
  let recoverySector = 'Retail';
  let recoveryReturn = 0;
  const sortedBy1Y = Object.entries(sectorReturnProfiles)
    .map(([sector, profile]) => ({ sector, ret: profile['1Y'] ?? 0 }))
    .filter(e => e.ret > 0 && e.sector !== best1YSector)
    .sort((a, b) => b.ret - a.ret);
  if (sortedBy1Y.length > 0) {
    recoverySector = sortedBy1Y[0].sector;
    recoveryReturn = sortedBy1Y[0].ret;
  }

  const formatReturn = (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="aegis-card gold-braiding p-6 bg-temple/20">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Long-Term Leader</span>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-black text-white uppercase tracking-tighter">{best10YSector}</span>
          <span className="text-emerald-400 mono font-black">{formatReturn(best10YReturn)}</span>
        </div>
        <p className="text-[9px] text-slate-500 uppercase mt-1">Trailing 10-Year Cumulative</p>
      </div>
      <div className="aegis-card gold-braiding p-6 bg-temple/20">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Short-Term Alpha</span>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-black text-white uppercase tracking-tighter">{best1YSector}</span>
          <span className="text-emerald-400 mono font-black">{formatReturn(best1YReturn)}</span>
        </div>
        <p className="text-[9px] text-slate-500 uppercase mt-1">Trailing 12-Month Momentum</p>
      </div>
      <div className="aegis-card gold-braiding p-6 bg-temple/20">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cyclical Recovery</span>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-black text-white uppercase tracking-tighter">{recoverySector}</span>
          <span className="text-amber-400 mono font-black">{formatReturn(recoveryReturn)}</span>
        </div>
        <p className="text-[9px] text-slate-500 uppercase mt-1">Yield Compression Opportunity</p>
      </div>
    </div>
  );
};

const SectorLens: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<ReturnPeriod>('1M');
  const [reitDataMap, setReitDataMap] = useState<ReitLoadedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectorReturnProfiles, setSectorReturnProfiles] = useState<Record<string, Record<string, number>>>(
    FALLBACK_SECTOR_RETURN_PROFILES
  );
  const sectorReturnProfilesRef = useRef(sectorReturnProfiles);
  sectorReturnProfilesRef.current = sectorReturnProfiles;

  const periodOptions: ReturnPeriod[] = ['1M', 'CYTD', '1Y', '3Y', '5Y', '10Y'];

  // Fetch real sector return profiles on mount
  useEffect(() => {
    let cancelled = false;

    getSectorReturnProfiles()
      .then((profiles) => {
        if (!cancelled) {
          setSectorReturnProfiles(profiles);
        }
      })
      .catch((err) => {
        // fallback to default sector return profiles
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const getPerformanceFactor = (s: Sector, period: ReturnPeriod) => {
    const profiles = sectorReturnProfilesRef.current;
    const base = profiles[s] || profiles[Sector.RESIDENTIAL] || { '1M': 0, 'CYTD': 0, '1Y': 0, '3Y': 0, '5Y': 0, '10Y': 0 };
    return base[period] ?? 0;
  };

  // Load all REIT data once on mount
  useEffect(() => {
    let cancelled = false;

    const loadAllData = async () => {
      setLoading(true);

      try {
        // Batch-load financials, market data, and KPIs for ALL REITs in parallel
        const results = await Promise.all(
          REITS.map(async (r): Promise<ReitLoadedData> => {
            const [fin, mktArr, kpis] = await Promise.all([
              loadRealFinancials(r.id),
              getMarketData(r.id),
              loadRealKPIs(r.id),
            ]);

            return {
              reitId: r.id,
              sector: r.sector,
              financials: fin,
              market: mktArr[0],
              kpis,
            };
          })
        );

        if (!cancelled) {
          setReitDataMap(results);
          setLoading(false);
        }
      } catch (err) {
        // failed to load real data, will show loading state
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAllData();

    return () => {
      cancelled = true;
    };
  }, []);

  // Compute sector-level aggregates from loaded REIT data
  const sectorData = useMemo(() => {
    if (reitDataMap.length === 0) return [];

    const sectors = Object.values(Sector);

    return sectors.map(s => {
      const sectorReits = reitDataMap.filter(d => d.sector === s);
      if (sectorReits.length === 0) return null;

      const metrics = sectorReits.map(d => {
        const fin = d.financials;
        const mkt = d.market;
        const kpi = d.kpis[d.kpis.length - 1];

        const latestFin = fin[fin.length - 1];
        const ttmNoi = fin.slice(-4).reduce((acc, f) => acc + f.noi, 0);
        const ev = mkt.marketCap + latestFin.totalDebt;

        return {
          evNoi: ttmNoi > 0 ? ev / ttmNoi : 0,
          impliedCap: ev > 0 ? (ttmNoi / ev) * 100 : 0,
          divYield: mkt.dividendYield,
          ssNoi: kpi.sameStoreNOIGrowth,
          returns: {
            '1M': getPerformanceFactor(s, '1M'),
            'CYTD': getPerformanceFactor(s, 'CYTD'),
            '1Y': getPerformanceFactor(s, '1Y'),
            '3Y': getPerformanceFactor(s, '3Y'),
            '5Y': getPerformanceFactor(s, '5Y'),
            '10Y': getPerformanceFactor(s, '10Y'),
          }
        };
      });

      const median = (arr: number[]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = sorted.length / 2;
        return sorted.length % 2 !== 0 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      return {
        sector: s,
        count: sectorReits.length,
        medEvNoi: median(metrics.map(m => m.evNoi)),
        medImpliedCap: median(metrics.map(m => m.impliedCap)),
        medDivYield: median(metrics.map(m => m.divYield)),
        medSsNoi: median(metrics.map(m => m.ssNoi)),
        medReturn: median(metrics.map(m => m.returns[selectedPeriod]))
      } as SectorMetrics;
    }).filter((s): s is SectorMetrics => s !== null);
  }, [reitDataMap, selectedPeriod, sectorReturnProfiles]);

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-4"></div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Loading Sector Data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="header-institutional text-xl font-black text-white uppercase tracking-institutional">Sector Relative Value</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Cross-Sector Median Comparison & Performance Benchmarks</p>
        </div>

        <div className="flex bg-obsidian/60 p-1 rounded-lg border border-royal/10 glass-modal">
          {periodOptions.map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-1.5 text-[9px] font-black rounded transition-all duration-300 uppercase tracking-widest ${
                selectedPeriod === period
                  ? 'bg-royal text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </header>

      <div className="aegis-card gold-braiding p-10">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">
            Sector Total Returns: <span className="text-gold">{selectedPeriod}</span> Horizon
          </h3>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Outperform</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Underperform</span>
             </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={sectorData} layout="vertical" margin={{ left: 60, right: 60, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(147, 51, 234, 0.05)" horizontal={true} vertical={false} />
              <XAxis type="number" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontWeight: 800 }} />
              <YAxis dataKey="sector" type="category" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} tick={{ fontWeight: 900 }} />
              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.03)', opacity: 0.4 }}
                contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.98)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '4px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                formatter={(val: number | undefined) => [`${(val ?? 0).toFixed(2)}%`]}
              />
              <Bar dataKey="medReturn" radius={[0, 4, 4, 0]} barSize={24}>
                {sectorData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.medReturn > 0 ? '#10b981' : '#f43f5e'}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="aegis-card gold-braiding overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-obsidian/80 border-b border-royal/10">
            <tr>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-widest">Sector Performance Cluster</th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-widest text-center">Names</th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-widest text-right">
                <div className="flex items-center justify-end gap-1">
                  Med. EV/NOI
                  <InfoTooltip content="Median Enterprise Value / TTM NOI for the sector." />
                </div>
              </th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-widest text-right">
                <div className="flex items-center justify-end gap-1">
                  Med. Imp. Cap
                  <InfoTooltip content="Median Implied Cap Rate (TTM NOI / EV) for the sector." />
                </div>
              </th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-widest text-right">
                <div className="flex items-center justify-end gap-1">
                  Med. SS NOI
                  <InfoTooltip content="Median Same-Store NOI growth for the sector." />
                </div>
              </th>
              <th className="px-8 py-5 font-black text-slate-500 uppercase text-[10px] tracking-widest">Sector Nuance</th>
              <th className="px-8 py-5 font-black text-gold uppercase text-[10px] tracking-widest text-right">{selectedPeriod} Return</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-royal/5">
            {sectorData.map((m: any) => (
              <tr key={m.sector} className="hover:bg-royal/5 transition-all duration-300 group">
                <td className="px-8 py-5 font-black text-white group-hover:text-gold transition-colors uppercase tracking-tight">{m.sector}</td>
                <td className="px-8 py-5 text-center text-slate-500 font-bold mono">{m.count}</td>
                <td className="px-8 py-5 text-right mono text-slate-200">{m.medEvNoi.toFixed(1)}x</td>
                <td className="px-8 py-5 text-right mono text-amber-400">{m.medImpliedCap.toFixed(2)}%</td>
                <td className="px-8 py-5 text-right mono text-blue-400">{m.medSsNoi.toFixed(2)}%</td>
                <td className="px-8 py-5 text-[10px] text-slate-400 italic max-w-[200px] leading-tight">
                  {m.sector === Sector.INDUSTRIAL ? "MTM Rent Spreads & Logistics Supply" :
                   m.sector === Sector.RESIDENTIAL ? "Loss-to-Lease & 12mo Inflation Hedge" :
                   m.sector === Sector.OFFICE ? "TI/LC Leakage & Structural Shifts" :
                   m.sector === Sector.RETAIL ? "Sales PSF & Anchor Stability" :
                   m.sector === Sector.DATA_CENTERS ? "Power Capacity (MW) & AI Demand" :
                   m.sector === Sector.HEALTHCARE ? "EBITDAR Coverage & Operator Health" :
                   m.sector === Sector.TOWERS ? "5G/6G CapEx & Tenant Lease-up" :
                   m.sector === Sector.SFR ? "Bad Debt % & Turnover Cost" : "Standard Model"}
                </td>
                <td className={`px-8 py-5 text-right mono font-black ${m.medReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {m.medReturn > 0 ? '+' : ''}{m.medReturn.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HighlightCards sectorReturnProfiles={sectorReturnProfiles} />
    </div>
  );
};

export default SectorLens;
