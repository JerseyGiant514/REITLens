/**
 * GeoExposure.tsx
 * Geographic Exposure dashboard — where a REIT's properties are located by MSA/region.
 * Treemap, regional breakdown table, concentration metrics, sunbelt/gateway analysis, peer comparison.
 */

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getInstitutionalProfile, FULL_REGISTRY } from '../services/reitRegistry';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GeoEntry {
  region: string;
  pct: number;
  properties: number;
  sqft: number; // millions
}

interface GeoExposureProps {
  ticker: string;
}

// ─── Gateway / Sunbelt Classification ────────────────────────────────────────

const GATEWAY_REGIONS = new Set([
  'New York City', 'NYC', 'Manhattan', 'New Jersey / NYC', 'NYC Metro',
  'San Francisco', 'Northern California', 'Bay Area',
  'Boston', 'Boston Metro',
  'Los Angeles', 'Southern California',
  'Washington DC', 'Washington D.C.',
  'Seattle',
  'Chicago',
]);

const SUNBELT_REGIONS = new Set([
  'Dallas-Fort Worth', 'Dallas', 'DFW',
  'Atlanta',
  'Phoenix', 'Phoenix Metro',
  'Tampa', 'Tampa Bay',
  'Austin',
  'Nashville',
  'Charlotte',
  'Houston',
  'Orlando',
  'Raleigh',
  'Jacksonville',
  'San Antonio',
  'Denver',
]);

function classifyRegion(region: string): 'Gateway' | 'Sunbelt' | 'International' | 'Other' {
  if (region === 'International') return 'International';
  for (const g of GATEWAY_REGIONS) {
    if (region.toLowerCase().includes(g.toLowerCase())) return 'Gateway';
  }
  for (const s of SUNBELT_REGIONS) {
    if (region.toLowerCase().includes(s.toLowerCase())) return 'Sunbelt';
  }
  return 'Other';
}

// ─── Realistic Geographic Data ───────────────────────────────────────────────

const GEO_DATA: Record<string, GeoEntry[]> = {
  'PLD': [
    { region: 'Southern California', pct: 18, properties: 85, sqft: 42 },
    { region: 'Northern California', pct: 12, properties: 45, sqft: 28 },
    { region: 'Chicago', pct: 10, properties: 52, sqft: 35 },
    { region: 'Dallas-Fort Worth', pct: 9, properties: 48, sqft: 30 },
    { region: 'New Jersey / NYC', pct: 8, properties: 35, sqft: 22 },
    { region: 'Atlanta', pct: 7, properties: 38, sqft: 24 },
    { region: 'Houston', pct: 6, properties: 30, sqft: 18 },
    { region: 'Pennsylvania', pct: 5, properties: 25, sqft: 15 },
    { region: 'International', pct: 15, properties: 120, sqft: 90 },
    { region: 'Other US', pct: 10, properties: 65, sqft: 40 },
  ],
  'REXR': [
    { region: 'Southern California', pct: 100, properties: 305, sqft: 48 },
  ],
  'EQR': [
    { region: 'Boston', pct: 18, properties: 42, sqft: 8.2 },
    { region: 'New York City', pct: 17, properties: 38, sqft: 7.5 },
    { region: 'San Francisco', pct: 16, properties: 35, sqft: 6.8 },
    { region: 'Washington DC', pct: 14, properties: 30, sqft: 6.0 },
    { region: 'Southern California', pct: 13, properties: 28, sqft: 5.5 },
    { region: 'Seattle', pct: 10, properties: 22, sqft: 4.2 },
    { region: 'Denver', pct: 7, properties: 18, sqft: 3.5 },
    { region: 'Other US', pct: 5, properties: 12, sqft: 2.4 },
  ],
  'AVB': [
    { region: 'New York City', pct: 20, properties: 45, sqft: 9.0 },
    { region: 'Washington DC', pct: 16, properties: 35, sqft: 7.2 },
    { region: 'Northern California', pct: 14, properties: 28, sqft: 5.8 },
    { region: 'Southern California', pct: 12, properties: 25, sqft: 5.0 },
    { region: 'Boston', pct: 11, properties: 22, sqft: 4.5 },
    { region: 'Seattle', pct: 9, properties: 18, sqft: 3.6 },
    { region: 'Denver', pct: 6, properties: 14, sqft: 2.8 },
    { region: 'Austin', pct: 5, properties: 10, sqft: 2.0 },
    { region: 'Charlotte', pct: 4, properties: 8, sqft: 1.5 },
    { region: 'Other US', pct: 3, properties: 6, sqft: 1.2 },
  ],
  'ESS': [
    { region: 'Southern California', pct: 42, properties: 95, sqft: 18.5 },
    { region: 'Northern California', pct: 32, properties: 72, sqft: 14.0 },
    { region: 'Seattle', pct: 16, properties: 36, sqft: 7.0 },
    { region: 'Other US', pct: 10, properties: 22, sqft: 4.5 },
  ],
  'MAA': [
    { region: 'Dallas-Fort Worth', pct: 14, properties: 32, sqft: 6.5 },
    { region: 'Atlanta', pct: 13, properties: 30, sqft: 6.0 },
    { region: 'Charlotte', pct: 10, properties: 22, sqft: 4.5 },
    { region: 'Tampa', pct: 10, properties: 21, sqft: 4.3 },
    { region: 'Austin', pct: 9, properties: 18, sqft: 3.8 },
    { region: 'Nashville', pct: 8, properties: 16, sqft: 3.2 },
    { region: 'Raleigh', pct: 7, properties: 15, sqft: 3.0 },
    { region: 'Orlando', pct: 6, properties: 12, sqft: 2.5 },
    { region: 'Phoenix', pct: 6, properties: 11, sqft: 2.2 },
    { region: 'Jacksonville', pct: 5, properties: 10, sqft: 2.0 },
    { region: 'Houston', pct: 5, properties: 10, sqft: 2.0 },
    { region: 'Other Sunbelt', pct: 7, properties: 14, sqft: 2.8 },
  ],
  'O': [
    { region: 'Texas', pct: 14, properties: 1150, sqft: 22 },
    { region: 'Southern California', pct: 9, properties: 720, sqft: 14 },
    { region: 'Florida', pct: 8, properties: 650, sqft: 12 },
    { region: 'Ohio', pct: 6, properties: 480, sqft: 9 },
    { region: 'Illinois', pct: 5, properties: 400, sqft: 8 },
    { region: 'Georgia', pct: 5, properties: 380, sqft: 7 },
    { region: 'New York', pct: 4, properties: 320, sqft: 6 },
    { region: 'North Carolina', pct: 4, properties: 310, sqft: 5.5 },
    { region: 'International', pct: 15, properties: 1200, sqft: 24 },
    { region: 'Other US', pct: 30, properties: 2400, sqft: 48 },
  ],
  'SPG': [
    { region: 'Florida', pct: 12, properties: 18, sqft: 22 },
    { region: 'Texas', pct: 10, properties: 14, sqft: 18 },
    { region: 'Southern California', pct: 9, properties: 12, sqft: 15 },
    { region: 'New York', pct: 8, properties: 10, sqft: 14 },
    { region: 'Indiana', pct: 7, properties: 8, sqft: 10 },
    { region: 'New Jersey', pct: 6, properties: 7, sqft: 9 },
    { region: 'Georgia', pct: 5, properties: 6, sqft: 8 },
    { region: 'Virginia', pct: 5, properties: 6, sqft: 7 },
    { region: 'International', pct: 18, properties: 35, sqft: 42 },
    { region: 'Other US', pct: 20, properties: 30, sqft: 38 },
  ],
  'BXP': [
    { region: 'Boston', pct: 30, properties: 28, sqft: 14.5 },
    { region: 'New York City', pct: 25, properties: 18, sqft: 12.0 },
    { region: 'San Francisco', pct: 18, properties: 14, sqft: 8.5 },
    { region: 'Washington DC', pct: 14, properties: 12, sqft: 6.8 },
    { region: 'Los Angeles', pct: 8, properties: 6, sqft: 3.8 },
    { region: 'Seattle', pct: 5, properties: 4, sqft: 2.4 },
  ],
  'VNO': [
    { region: 'New York City', pct: 72, properties: 35, sqft: 20.5 },
    { region: 'Chicago', pct: 15, properties: 8, sqft: 4.2 },
    { region: 'San Francisco', pct: 13, properties: 6, sqft: 3.5 },
  ],
  'INVH': [
    { region: 'Atlanta', pct: 14, properties: 8500, sqft: 14.5 },
    { region: 'Phoenix', pct: 12, properties: 7200, sqft: 12.0 },
    { region: 'Tampa', pct: 10, properties: 6000, sqft: 10.0 },
    { region: 'Dallas-Fort Worth', pct: 9, properties: 5400, sqft: 9.0 },
    { region: 'Charlotte', pct: 8, properties: 4800, sqft: 8.0 },
    { region: 'Orlando', pct: 7, properties: 4200, sqft: 7.0 },
    { region: 'Jacksonville', pct: 6, properties: 3600, sqft: 6.0 },
    { region: 'Houston', pct: 6, properties: 3600, sqft: 6.0 },
    { region: 'Southern California', pct: 5, properties: 3000, sqft: 5.0 },
    { region: 'Denver', pct: 5, properties: 3000, sqft: 5.0 },
    { region: 'Nashville', pct: 4, properties: 2400, sqft: 4.0 },
    { region: 'Other US', pct: 14, properties: 8400, sqft: 14.0 },
  ],
  'AMH': [
    { region: 'Atlanta', pct: 12, properties: 6800, sqft: 11.5 },
    { region: 'Dallas-Fort Worth', pct: 11, properties: 6200, sqft: 10.5 },
    { region: 'Phoenix', pct: 10, properties: 5600, sqft: 9.5 },
    { region: 'Charlotte', pct: 9, properties: 5100, sqft: 8.5 },
    { region: 'Nashville', pct: 8, properties: 4500, sqft: 7.5 },
    { region: 'Tampa', pct: 8, properties: 4500, sqft: 7.5 },
    { region: 'Jacksonville', pct: 7, properties: 3900, sqft: 6.5 },
    { region: 'Houston', pct: 6, properties: 3400, sqft: 5.5 },
    { region: 'Indianapolis', pct: 5, properties: 2800, sqft: 4.5 },
    { region: 'Raleigh', pct: 5, properties: 2800, sqft: 4.5 },
    { region: 'Orlando', pct: 5, properties: 2800, sqft: 4.5 },
    { region: 'Other US', pct: 14, properties: 7900, sqft: 13.0 },
  ],
  'PSA': [
    { region: 'Southern California', pct: 14, properties: 380, sqft: 18 },
    { region: 'Texas', pct: 12, properties: 320, sqft: 15 },
    { region: 'Florida', pct: 11, properties: 290, sqft: 14 },
    { region: 'New York', pct: 7, properties: 180, sqft: 9 },
    { region: 'Northern California', pct: 6, properties: 160, sqft: 8 },
    { region: 'Illinois', pct: 5, properties: 130, sqft: 6 },
    { region: 'Georgia', pct: 5, properties: 120, sqft: 6 },
    { region: 'Virginia', pct: 4, properties: 100, sqft: 5 },
    { region: 'Washington', pct: 4, properties: 95, sqft: 4.5 },
    { region: 'Other US', pct: 32, properties: 850, sqft: 42 },
  ],
  'EXR': [
    { region: 'Texas', pct: 13, properties: 300, sqft: 14 },
    { region: 'Florida', pct: 12, properties: 280, sqft: 13 },
    { region: 'Southern California', pct: 11, properties: 250, sqft: 12 },
    { region: 'New York / NJ', pct: 8, properties: 185, sqft: 9 },
    { region: 'Georgia', pct: 6, properties: 140, sqft: 6.5 },
    { region: 'Illinois', pct: 5, properties: 115, sqft: 5.5 },
    { region: 'Northern California', pct: 5, properties: 110, sqft: 5 },
    { region: 'North Carolina', pct: 4, properties: 95, sqft: 4.5 },
    { region: 'Colorado', pct: 4, properties: 90, sqft: 4 },
    { region: 'Other US', pct: 32, properties: 740, sqft: 35 },
  ],
  'CUBE': [
    { region: 'New York / NJ / CT', pct: 20, properties: 155, sqft: 10 },
    { region: 'Florida', pct: 14, properties: 110, sqft: 7 },
    { region: 'Texas', pct: 10, properties: 78, sqft: 5 },
    { region: 'Massachusetts', pct: 8, properties: 62, sqft: 4 },
    { region: 'Pennsylvania', pct: 7, properties: 55, sqft: 3.5 },
    { region: 'Southern California', pct: 6, properties: 45, sqft: 3 },
    { region: 'Illinois', pct: 5, properties: 38, sqft: 2.5 },
    { region: 'Georgia', pct: 5, properties: 38, sqft: 2.5 },
    { region: 'Virginia', pct: 4, properties: 30, sqft: 2 },
    { region: 'Other US', pct: 21, properties: 165, sqft: 10.5 },
  ],
  'HST': [
    { region: 'Southern California', pct: 14, properties: 8, sqft: 3.5 },
    { region: 'New York City', pct: 12, properties: 5, sqft: 2.8 },
    { region: 'San Francisco', pct: 10, properties: 4, sqft: 2.2 },
    { region: 'Florida', pct: 10, properties: 6, sqft: 2.5 },
    { region: 'Washington DC', pct: 8, properties: 4, sqft: 1.8 },
    { region: 'Boston', pct: 7, properties: 3, sqft: 1.5 },
    { region: 'Phoenix', pct: 6, properties: 3, sqft: 1.3 },
    { region: 'Houston', pct: 5, properties: 3, sqft: 1.0 },
    { region: 'Atlanta', pct: 4, properties: 2, sqft: 0.8 },
    { region: 'International', pct: 8, properties: 5, sqft: 2.0 },
    { region: 'Other US', pct: 16, properties: 10, sqft: 3.5 },
  ],
  'RHP': [
    { region: 'Nashville', pct: 38, properties: 2, sqft: 2.9 },
    { region: 'Orlando', pct: 22, properties: 1, sqft: 1.5 },
    { region: 'Washington DC', pct: 18, properties: 1, sqft: 1.2 },
    { region: 'Denver', pct: 14, properties: 1, sqft: 1.0 },
    { region: 'Other US', pct: 8, properties: 1, sqft: 0.5 },
  ],
};

const DEFAULT_GEO: GeoEntry[] = [
  { region: 'Top Market', pct: 25, properties: 40, sqft: 12 },
  { region: 'Second Market', pct: 18, properties: 28, sqft: 8 },
  { region: 'Third Market', pct: 12, properties: 20, sqft: 6 },
  { region: 'Fourth Market', pct: 10, properties: 15, sqft: 4 },
  { region: 'Fifth Market', pct: 8, properties: 12, sqft: 3 },
  { region: 'Other US', pct: 27, properties: 45, sqft: 15 },
];

function getGeoData(ticker: string): GeoEntry[] {
  return GEO_DATA[ticker] ?? DEFAULT_GEO;
}

// ─── Treemap Color Palette ───────────────────────────────────────────────────

const TREEMAP_COLORS = [
  '#38bdf8', // lightBlue
  '#2dd4bf', // teal
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal-dark
  '#22d3ee', // cyan-light
  '#0284c7', // blue
  '#0d9488', // teal-deeper
  '#0891b2', // cyan-dark
  '#0369a1', // blue-deep
  '#155e75', // darkest
  '#164e63', // abyss
];

// ─── Sunbelt Bar Colors ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Gateway: '#38bdf8',
  Sunbelt: '#34d399',
  International: '#FF9D3C',
  Other: '#64748b',
};

// ─── Component ───────────────────────────────────────────────────────────────

const GeoExposure: React.FC<GeoExposureProps> = ({ ticker }) => {
  const geoData = useMemo(() => {
    const data = getGeoData(ticker).slice().sort((a, b) => b.pct - a.pct);
    return data;
  }, [ticker]);

  // Treemap data
  const treemapData = useMemo(() => {
    return geoData.map((g, i) => ({
      name: g.region,
      size: g.pct,
      fill: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
    }));
  }, [geoData]);

  // Concentration metrics
  const metrics = useMemo(() => {
    const sorted = [...geoData].sort((a, b) => b.pct - a.pct);
    const topMarket = sorted[0]?.pct ?? 0;
    const top3 = sorted.slice(0, 3).reduce((s, g) => s + g.pct, 0);
    const numMarkets = sorted.length;
    const hhi = sorted.reduce((s, g) => s + g.pct * g.pct, 0);
    const label = hhi < 1000 ? 'Diversified' : hhi < 2000 ? 'Moderate' : 'Concentrated';
    const labelColor = hhi < 1000 ? 'text-emerald' : hhi < 2000 ? 'text-gold' : 'text-pumpkin';
    return { topMarket, top3, numMarkets, hhi, label, labelColor };
  }, [geoData]);

  // Sunbelt vs Gateway breakdown
  const sunbeltGateway = useMemo(() => {
    const buckets = { Gateway: 0, Sunbelt: 0, International: 0, Other: 0 };
    for (const g of geoData) {
      const cat = classifyRegion(g.region);
      buckets[cat] += g.pct;
    }
    return buckets;
  }, [geoData]);

  const sunbeltBarData = useMemo(() => {
    return [
      {
        name: ticker,
        Gateway: sunbeltGateway.Gateway,
        Sunbelt: sunbeltGateway.Sunbelt,
        International: sunbeltGateway.International,
        Other: sunbeltGateway.Other,
      },
    ];
  }, [sunbeltGateway, ticker]);

  // Totals row
  const totals = useMemo(() => ({
    pct: geoData.reduce((s, g) => s + g.pct, 0),
    properties: geoData.reduce((s, g) => s + g.properties, 0),
    sqft: geoData.reduce((s, g) => s + g.sqft, 0),
  }), [geoData]);

  // Peer comparison — same sector
  const peerComparison = useMemo(() => {
    const currentEntry = FULL_REGISTRY.find(r => r.ticker === ticker);
    if (!currentEntry) return [];
    const sameSector = FULL_REGISTRY.filter(r => r.sector === currentEntry.sector && r.isActive);
    return sameSector.map(r => {
      const peerGeo = getGeoData(r.ticker).slice().sort((a, b) => b.pct - a.pct);
      const topMarket = peerGeo[0]?.region ?? '—';
      const top3Pct = peerGeo.slice(0, 3).reduce((s, g) => s + g.pct, 0);
      const numMarkets = peerGeo.length;
      const hhi = peerGeo.reduce((s, g) => s + g.pct * g.pct, 0);
      return {
        ticker: r.ticker,
        topMarket,
        top3Pct,
        numMarkets,
        hhi: Math.round(hhi),
        isCurrent: r.ticker === ticker,
      };
    });
  }, [ticker]);

  // ─── Custom Treemap Content ──────────────────────────────────────────────

  const TreemapContent: React.FC<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    size?: number;
    fill?: string;
  }> = ({ x = 0, y = 0, width = 0, height = 0, name = '', size = 0, fill = '#38bdf8' }) => {
    const showLabel = width > 50 && height > 30;
    const showPct = width > 40 && height > 20;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          stroke="rgba(100,116,139,0.2)"
          strokeWidth={2}
          rx={4}
        />
        {showLabel && (
          <text
            x={x + width / 2}
            y={y + height / 2 - (showPct ? 6 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={width > 90 ? 11 : 9}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {name}
          </text>
        )}
        {showPct && showLabel && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 12}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(255,255,255,0.8)"
            fontSize={10}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {size}%
          </text>
        )}
      </g>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 font-primary">
      {/* A) Header */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="header-noe text-xl text-slate-100 tracking-wide">
          Geographic Exposure — <span className="text-lightBlue">{ticker}</span>
        </h2>
      </div>

      {/* B) Geographic Treemap */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5">
        <h3 className="text-xs font-bold text-rain uppercase tracking-widest mb-3">
          Portfolio Allocation by Region
        </h3>
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="rgba(100,116,139,0.2)"
              content={<TreemapContent />}
            />
          </ResponsiveContainer>
        </div>
      </div>

      {/* C + D: Table + Concentration Metrics side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* C) Regional Breakdown Table */}
        <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5">
          <h3 className="text-xs font-bold text-rain uppercase tracking-widest mb-3">
            Regional Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-rain/20 text-rain/70">
                  <th className="text-left py-2 pr-2 font-semibold">Region</th>
                  <th className="text-right py-2 px-2 font-semibold">% of Portfolio</th>
                  <th className="text-right py-2 px-2 font-semibold">Properties</th>
                  <th className="text-right py-2 pl-2 font-semibold">Est. Sq Ft (M)</th>
                </tr>
              </thead>
              <tbody>
                {geoData.map((g, i) => {
                  const maxPct = geoData[0]?.pct ?? 1;
                  const barWidth = (g.pct / maxPct) * 100;
                  return (
                    <tr
                      key={g.region}
                      className={`border-b border-rain/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <td className="py-1.5 pr-2 text-slate-200 font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 rounded-full bg-lightBlue/60"
                            style={{ width: `${barWidth}%`, minWidth: 4, maxWidth: 80 }}
                          />
                          <span>{g.region}</span>
                        </div>
                      </td>
                      <td className="text-right py-1.5 px-2 text-lightBlue font-black tabular-nums">
                        {g.pct.toFixed(1)}%
                      </td>
                      <td className="text-right py-1.5 px-2 text-slate-300 tabular-nums">
                        {g.properties.toLocaleString()}
                      </td>
                      <td className="text-right py-1.5 pl-2 text-slate-300 tabular-nums">
                        {g.sqft.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                <tr className="border-t-2 border-rain/20 font-bold">
                  <td className="py-2 pr-2 text-slate-100">Total</td>
                  <td className="text-right py-2 px-2 text-lightBlue tabular-nums">
                    {totals.pct.toFixed(1)}%
                  </td>
                  <td className="text-right py-2 px-2 text-slate-100 tabular-nums">
                    {totals.properties.toLocaleString()}
                  </td>
                  <td className="text-right py-2 pl-2 text-slate-100 tabular-nums">
                    {totals.sqft.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* D) Concentration Metrics — 4 cards */}
        <div className="grid grid-cols-2 gap-3 content-start">
          {/* Top Market */}
          <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-rain uppercase tracking-widest font-semibold mb-1">
              Top Market %
            </span>
            <span className="text-2xl font-black text-lightBlue tabular-nums">
              {metrics.topMarket.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              {geoData[0]?.region}
            </span>
          </div>

          {/* Top 3 Markets */}
          <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-rain uppercase tracking-widest font-semibold mb-1">
              Top 3 Markets %
            </span>
            <span className="text-2xl font-black text-pumpkin tabular-nums">
              {metrics.top3.toFixed(1)}%
            </span>
          </div>

          {/* Number of Markets */}
          <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-rain uppercase tracking-widest font-semibold mb-1">
              # of Markets
            </span>
            <span className="text-2xl font-black text-emerald tabular-nums">
              {metrics.numMarkets}
            </span>
          </div>

          {/* Geographic HHI */}
          <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-rain uppercase tracking-widest font-semibold mb-1">
              Geographic HHI
            </span>
            <span className="text-2xl font-black text-gold tabular-nums">
              {Math.round(metrics.hhi).toLocaleString()}
            </span>
            <span className={`text-[10px] font-bold mt-0.5 ${metrics.labelColor}`}>
              {metrics.label}
            </span>
          </div>
        </div>
      </div>

      {/* E) Sunbelt vs. Gateway Analysis */}
      <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5">
        <h3 className="text-xs font-bold text-rain uppercase tracking-widest mb-3">
          Sunbelt vs. Gateway Exposure
        </h3>
        <div className="mb-3 flex flex-wrap gap-4 text-[10px]">
          {(Object.entries(CATEGORY_COLORS) as [string, string][]).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-slate-300 font-semibold">
                {cat}: {sunbeltGateway[cat as keyof typeof sunbeltGateway]}%
              </span>
            </div>
          ))}
        </div>
        <div style={{ width: '100%', height: 60 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sunbeltBarData}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            >
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(10, 22, 40, 0.95)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
                formatter={(value: number | undefined) => [`${value ?? 0}%`, '']}
                labelStyle={{ color: '#94a3b8', fontWeight: 700 }}
              />
              <Bar dataKey="Gateway" stackId="a" fill={CATEGORY_COLORS.Gateway} radius={[4, 0, 0, 4]} />
              <Bar dataKey="Sunbelt" stackId="a" fill={CATEGORY_COLORS.Sunbelt} />
              <Bar dataKey="International" stackId="a" fill={CATEGORY_COLORS.International} />
              <Bar dataKey="Other" stackId="a" fill={CATEGORY_COLORS.Other} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* F) Peer Geographic Comparison */}
      {peerComparison.length > 1 && (
        <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5">
          <h3 className="text-xs font-bold text-rain uppercase tracking-widest mb-3">
            Peer Geographic Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-rain/20 text-rain/70">
                  <th className="text-left py-2 pr-2 font-semibold">Ticker</th>
                  <th className="text-left py-2 px-2 font-semibold">Top Market</th>
                  <th className="text-right py-2 px-2 font-semibold">Top 3 %</th>
                  <th className="text-right py-2 px-2 font-semibold"># Markets</th>
                  <th className="text-right py-2 pl-2 font-semibold">HHI</th>
                </tr>
              </thead>
              <tbody>
                {peerComparison.map((p, i) => (
                  <tr
                    key={p.ticker}
                    className={`border-b border-rain/5 ${
                      p.isCurrent
                        ? 'bg-lightBlue/10 border-l-2 border-l-lightBlue'
                        : i % 2 === 0
                        ? 'bg-white/[0.02]'
                        : ''
                    }`}
                  >
                    <td className={`py-1.5 pr-2 font-black ${p.isCurrent ? 'text-lightBlue' : 'text-slate-200'}`}>
                      {p.ticker}
                    </td>
                    <td className="py-1.5 px-2 text-slate-300">{p.topMarket}</td>
                    <td className="text-right py-1.5 px-2 text-pumpkin font-bold tabular-nums">
                      {p.top3Pct.toFixed(1)}%
                    </td>
                    <td className="text-right py-1.5 px-2 text-slate-300 tabular-nums">
                      {p.numMarkets}
                    </td>
                    <td className="text-right py-1.5 pl-2 text-gold font-bold tabular-nums">
                      {p.hhi.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeoExposure;
