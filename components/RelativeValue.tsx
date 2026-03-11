
import React, { useMemo } from 'react';
import { Sector, Portfolio, FinancialsQuarterly } from '../types';
import { REITS } from '../services/mockData';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label } from 'recharts';
import { getFinancials, getKPIs, getMarketDataSync } from '../services/dataService';

interface RelativeValueProps {
  ticker: string;
  sector: Sector | null;
  portfolio: Portfolio | null;
  liveFinancials?: FinancialsQuarterly[];
}

const RelativeValue: React.FC<RelativeValueProps> = ({ ticker, sector, portfolio, liveFinancials }) => {
  const plotData = useMemo(() => {
    // Generate data for the entire sector or a selection of peers
    const targetSector = sector || (REITS.find(r => r.ticker === ticker)?.sector) || Sector.INDUSTRIAL;
    const peers = REITS.filter(r => r.sector === targetSector);

    return peers.map(reit => {
      const market = getMarketDataSync(reit.id)[0];
      const financials = getFinancials(reit.id, liveFinancials);
      const kpis = getKPIs(reit.id, liveFinancials);

      const latestFin = financials[financials.length - 1];
      const ttmNOI = financials.slice(-4).reduce((acc, f) => acc + f.noi, 0);
      const ev = market.marketCap + latestFin.totalDebt;

      const impliedCap = (ttmNOI / ev) * 100;
      const sustainableG = kpis[kpis.length - 1].growthDecomp?.netAffoGrowth || 3.0;

      return {
        ticker: reit.ticker,
        x: sustainableG,
        y: impliedCap,
        z: market.marketCap,
        isTarget: reit.ticker === ticker
      };
    });
  }, [ticker, sector]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-darkBlue/95 border border-lightBlue/30 p-4 rounded shadow-2xl backdrop-blur-md">
          <div className="text-xs font-black text-white uppercase tracking-widest border-b border-white/10 pb-2 mb-2">
            {data.ticker} Metrics
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-6 text-[10px]">
              <span className="text-rain font-bold">Sustainable g:</span>
              <span className="text-pumpkin font-black">{data.x.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-6 text-[10px]">
              <span className="text-rain font-bold">Implied Cap:</span>
              <span className="text-lightBlue font-black">{data.y.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between gap-6 text-[10px]">
              <span className="text-rain font-bold">Market Cap:</span>
              <span className="text-white font-black">${(data.z / 1000).toFixed(1)}B</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-institutional text-2xl font-black text-white tracking-institutional uppercase">Relative Value Quadrants</h2>
          <p className="text-[10px] text-rain uppercase tracking-[0.4em] mt-2">Sustainable g vs. Implied Cap Rate Analysis</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 aegis-card p-10 bg-black/30 relative overflow-hidden">
          {/* Quadrant Labels */}
          <div className="absolute top-12 left-12 text-[9px] font-black text-rose-500/40 uppercase tracking-widest z-0">Value Trap</div>
          <div className="absolute top-12 right-12 text-[9px] font-black text-emerald-500/40 uppercase tracking-widest z-0">GARP Leader</div>
          <div className="absolute bottom-24 left-12 text-[9px] font-black text-slate-500/40 uppercase tracking-widest z-0">Quality at a Price</div>
          <div className="absolute bottom-24 right-12 text-[9px] font-black text-pumpkin/40 uppercase tracking-widest z-0">Overvalued Spec</div>

          <div style={{ width: '100%', height: 500 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(95, 154, 174, 0.1)" />
                <XAxis type="number" dataKey="x" name="Sustainable g" stroke="#94a3b8" fontSize={11} tick={{ fontWeight: 800 }}>
                  <Label value="Sustainable Growth (g) %" position="bottom" offset={20} fill="#5F9AAE" fontSize={10} fontWeight={900} />
                </XAxis>
                <YAxis type="number" dataKey="y" name="Implied Cap" stroke="#94a3b8" fontSize={11} tick={{ fontWeight: 800 }}>
                  <Label value="Implied Cap Rate %" angle={-90} position="left" offset={-10} fill="#5F9AAE" fontSize={10} fontWeight={900} />
                </YAxis>
                <ZAxis type="number" dataKey="z" range={[100, 2000]} />
                <Tooltip content={<CustomTooltip />} />
                <Scatter data={plotData}>
                  {plotData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isTarget ? '#FF9D3C' : '#48A3CC'}
                      stroke={entry.isTarget ? '#fff' : 'none'}
                      strokeWidth={entry.isTarget ? 2 : 0}
                      fillOpacity={0.8}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="aegis-card p-8 bg-darkBlue/40">
            <h3 className="text-[11px] font-black text-gold uppercase tracking-[0.4em] mb-6">Strategic Positioning</h3>
            <div className="space-y-4 text-[11px] text-slate-400 leading-relaxed italic">
              The RV Quadrant highlights disconnects between growth prospects and market pricing.
              <br /><br />
              <span className="text-emerald-400 font-black">Top-Right:</span> Assets yielding high current income (high cap) with superior growth. Highly attractive.
              <br /><br />
              <span className="text-rose-400 font-black">Bottom-Left:</span> Expensive assets with limited growth runway. Requires high-conviction "quality" narrative.
            </div>
          </div>

          <div className="aegis-card p-8 border-lightBlue/30 bg-lightBlue/5">
            <span className="text-[9px] font-black text-lightBlue uppercase tracking-widest">Selected Sector</span>
            <div className="text-lg font-black text-white mt-1 uppercase tracking-tighter">
              {sector || (REITS.find(r => r.ticker === ticker)?.sector) || "Multi-Sector"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default RelativeValue;
