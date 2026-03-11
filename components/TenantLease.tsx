/**
 * TenantLease.tsx
 * Tenant Concentration & Lease Expiration dashboard
 * Shows top tenants, revenue concentration (HHI), lease expiry schedule,
 * WALT, and peer comparison for the selected REIT.
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { REITS } from '../services/mockData';
import { getInstitutionalProfile, FULL_REGISTRY } from '../services/reitRegistry';
import { Sector } from '../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TenantLeaseProps {
  ticker: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantEntry {
  name: string;
  pctRevenue: number;
  creditRating: string;
}

interface LeaseExpiryYear {
  year: number;
  pctExpiring: number;
  cumulative: number;
}

type SectorCategory =
  | 'industrial'
  | 'retail_net'
  | 'retail_mall'
  | 'office'
  | 'residential'
  | 'self_storage'
  | 'sfr'
  | 'lodging'
  | 'other';

// ─── Theme colors ─────────────────────────────────────────────────────────────

const COLORS = {
  lightBlue: '#5eead4',
  pumpkin: '#FF9D3C',
  emerald: '#34d399',
  gold: '#fbbf24',
  rain: '#64748b',
  obsidian: '#0a1628',
  darkBlue: '#1e293b',
};

const PIE_COLORS = [
  '#5eead4', '#34d399', '#fbbf24', '#FF9D3C', '#f87171',
  '#a78bfa', '#38bdf8', '#fb923c', '#22d3ee', '#e879f9',
];

const OTHER_COLOR = 'rgba(100, 116, 139, 0.3)';

// ─── Sector classification ───────────────────────────────────────────────────

function classifySector(sector: Sector, propertyType: string): SectorCategory {
  switch (sector) {
    case Sector.INDUSTRIAL:
      return 'industrial';
    case Sector.RETAIL:
      return propertyType.toLowerCase().includes('mall') ? 'retail_mall' : 'retail_net';
    case Sector.OFFICE:
      return 'office';
    case Sector.RESIDENTIAL:
      return 'residential';
    case Sector.SELF_STORAGE:
      return 'self_storage';
    case Sector.SFR:
      return 'sfr';
    case Sector.LODGING:
      return 'lodging';
    default:
      return 'other';
  }
}

// ─── Tenant data by sector ────────────────────────────────────────────────────

const CREDIT_RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'B+', 'NR'];

function getTenantMix(category: SectorCategory): TenantEntry[] | null {
  switch (category) {
    case 'industrial':
      return [
        { name: 'Amazon', pctRevenue: 8.0, creditRating: 'AA' },
        { name: 'FedEx', pctRevenue: 5.0, creditRating: 'BBB' },
        { name: 'DHL', pctRevenue: 4.0, creditRating: 'A-' },
        { name: 'Walmart', pctRevenue: 3.0, creditRating: 'AA' },
        { name: 'Home Depot', pctRevenue: 3.0, creditRating: 'A' },
        { name: 'UPS', pctRevenue: 2.5, creditRating: 'A+' },
        { name: 'Target', pctRevenue: 2.0, creditRating: 'A' },
        { name: 'XPO Logistics', pctRevenue: 1.5, creditRating: 'BB+' },
        { name: 'Wayfair', pctRevenue: 1.5, creditRating: 'B+' },
        { name: 'Other', pctRevenue: 69.5, creditRating: 'NR' },
      ];
    case 'retail_net':
      return [
        { name: 'Walgreens', pctRevenue: 5.0, creditRating: 'BBB-' },
        { name: 'Dollar General', pctRevenue: 4.5, creditRating: 'BBB' },
        { name: 'Dollar Tree', pctRevenue: 4.0, creditRating: 'BBB' },
        { name: '7-Eleven', pctRevenue: 3.5, creditRating: 'AA-' },
        { name: 'FedEx', pctRevenue: 3.0, creditRating: 'BBB' },
        { name: 'Walmart', pctRevenue: 2.5, creditRating: 'AA' },
        { name: 'CVS', pctRevenue: 2.0, creditRating: 'BBB' },
        { name: 'Home Depot', pctRevenue: 2.0, creditRating: 'A' },
        { name: 'LA Fitness', pctRevenue: 1.5, creditRating: 'NR' },
        { name: 'Other', pctRevenue: 72.0, creditRating: 'NR' },
      ];
    case 'retail_mall':
      return [
        { name: 'Gap', pctRevenue: 3.0, creditRating: 'BB' },
        { name: 'Nike', pctRevenue: 2.5, creditRating: 'AA-' },
        { name: 'H&M', pctRevenue: 2.0, creditRating: 'A-' },
        { name: 'Apple', pctRevenue: 2.0, creditRating: 'AAA' },
        { name: 'Foot Locker', pctRevenue: 1.8, creditRating: 'BB+' },
        { name: 'Sephora', pctRevenue: 1.5, creditRating: 'A' },
        { name: 'Zara', pctRevenue: 1.5, creditRating: 'A+' },
        { name: 'Lululemon', pctRevenue: 1.2, creditRating: 'BBB+' },
        { name: "Victoria's Secret", pctRevenue: 1.0, creditRating: 'B+' },
        { name: 'Other', pctRevenue: 83.5, creditRating: 'NR' },
      ];
    case 'office':
      return [
        { name: 'Law Firms', pctRevenue: 8.0, creditRating: 'NR' },
        { name: 'Tech Co.', pctRevenue: 6.0, creditRating: 'A+' },
        { name: 'Financial Services', pctRevenue: 5.0, creditRating: 'A' },
        { name: 'Consulting', pctRevenue: 4.0, creditRating: 'A-' },
        { name: 'Insurance', pctRevenue: 3.0, creditRating: 'AA-' },
        { name: 'Government', pctRevenue: 3.0, creditRating: 'AAA' },
        { name: 'Healthcare', pctRevenue: 2.5, creditRating: 'A' },
        { name: 'Accounting', pctRevenue: 2.0, creditRating: 'A-' },
        { name: 'Media', pctRevenue: 1.5, creditRating: 'BBB' },
        { name: 'Other', pctRevenue: 65.0, creditRating: 'NR' },
      ];
    default:
      return null;
  }
}

// ─── Lease expiry schedule by sector ──────────────────────────────────────────

function getLeaseExpirySchedule(category: SectorCategory): number[] | null {
  // Returns % of revenue expiring for years 1-10
  switch (category) {
    case 'industrial':
      return [8, 8, 9, 10, 10, 11, 10, 6, 6, 6]; // remainder ~16% beyond yr 10
    case 'office':
      return [5, 5, 15, 15, 14, 7, 7, 6, 6, 6]; // heavy in years 3-5
    case 'retail_net':
      return [9, 10, 10, 10, 10, 10, 10, 10, 10, 11];
    case 'retail_mall':
      return [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    default:
      return null;
  }
}

// ─── N/A messages ─────────────────────────────────────────────────────────────

function getNAMessage(category: SectorCategory): string | null {
  switch (category) {
    case 'residential':
      return 'Not applicable for residential REITs. Apartment leases are typically 12 months with high turnover and no single-tenant concentration risk.';
    case 'self_storage':
      return 'Self-storage has no tenant concentration risk. Facilities serve thousands of individual renters on month-to-month contracts.';
    case 'sfr':
      return 'Diversified across thousands of individual tenants. Single-family rental portfolios have no meaningful single-tenant concentration.';
    case 'lodging':
      return 'Hotel occupancy varies daily with no fixed tenants. Revenue depends on ADR, RevPAR, and occupancy rates rather than lease terms.';
    default:
      return null;
  }
}

// ─── HHI calculation ──────────────────────────────────────────────────────────

function calculateHHI(tenants: TenantEntry[]): number {
  return tenants.reduce((sum, t) => sum + t.pctRevenue * t.pctRevenue, 0);
}

function getHHILabel(hhi: number): { label: string; color: string } {
  if (hhi < 500) return { label: 'Well Diversified', color: COLORS.emerald };
  if (hhi < 1000) return { label: 'Moderate', color: COLORS.gold };
  return { label: 'Concentrated', color: '#f87171' };
}

// ─── WALT estimation ──────────────────────────────────────────────────────────

function estimateWALT(category: SectorCategory): number {
  switch (category) {
    case 'industrial': return 5.2;
    case 'retail_net': return 9.8;
    case 'retail_mall': return 6.5;
    case 'office': return 7.1;
    case 'residential': return 0.9;
    case 'self_storage': return 0.1;
    case 'sfr': return 1.6;
    case 'lodging': return 0.0;
    default: return 5.0;
  }
}

// ─── Lease spread estimation ──────────────────────────────────────────────────

function estimateLeaseSpread(category: SectorCategory): number {
  switch (category) {
    case 'industrial': return 35;
    case 'retail_net': return 15;
    case 'retail_mall': return 10;
    case 'office': return -5;
    default: return 20;
  }
}

// ─── Investment grade % ───────────────────────────────────────────────────────

function getIGPercent(tenants: TenantEntry[]): number {
  const igRatings = new Set(['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-']);
  const named = tenants.filter(t => t.name !== 'Other');
  const namedRevenue = named.reduce((s, t) => s + t.pctRevenue, 0);
  if (namedRevenue === 0) return 0;
  const igRevenue = named
    .filter(t => igRatings.has(t.creditRating))
    .reduce((s, t) => s + t.pctRevenue, 0);
  return Math.round((igRevenue / namedRevenue) * 100);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const CustomBarTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ value: number; payload: LeaseExpiryYear }>;
  label?: string;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-obsidian/95 border border-rain/20 rounded-lg px-3 py-2 shadow-xl text-xs font-secondary">
      <p className="text-slate-200 font-semibold">{d.year}</p>
      <p className="text-lightBlue">Expiring: {d.pctExpiring.toFixed(1)}%</p>
      <p className="text-slate-400">Cumulative: {d.cumulative.toFixed(1)}%</p>
    </div>
  );
};

const CustomPieTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-obsidian/95 border border-rain/20 rounded-lg px-3 py-2 shadow-xl text-xs font-secondary">
      <p className="text-slate-200 font-semibold">{payload[0].name}</p>
      <p className="text-lightBlue">{(payload[0].value as number).toFixed(1)}% of Revenue</p>
    </div>
  );
};

// ─── Metric Card ──────────────────────────────────────────────────────────────

const MetricCard: React.FC<{
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
}> = ({ label, value, sublabel, accent = COLORS.lightBlue }) => (
  <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-4 flex flex-col gap-1">
    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-secondary">{label}</span>
    <span className="text-2xl font-bold font-primary" style={{ color: accent }}>{value}</span>
    {sublabel && <span className="text-[11px] text-slate-500 font-secondary">{sublabel}</span>}
  </div>
);

// ─── N/A Card ─────────────────────────────────────────────────────────────────

const NACard: React.FC<{ message: string; sectorLabel: string }> = ({ message, sectorLabel }) => (
  <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
    <div className="w-16 h-16 rounded-full bg-rain/10 flex items-center justify-center mb-4">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-slate-300 font-primary mb-2">{sectorLabel}</h3>
    <p className="text-sm text-slate-400 font-secondary max-w-md leading-relaxed">{message}</p>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

const TenantLease: React.FC<TenantLeaseProps> = ({ ticker }) => {
  const reit = useMemo(() => REITS.find(r => r.ticker === ticker), [ticker]);
  const registryEntry = useMemo(
    () => FULL_REGISTRY.find(r => r.ticker === ticker),
    [ticker],
  );

  const sector = reit?.sector ?? Sector.INDUSTRIAL;
  const propertyType = registryEntry?.propertyType ?? '';
  const category = useMemo(() => classifySector(sector, propertyType), [sector, propertyType]);

  const tenants = useMemo(() => getTenantMix(category), [category]);
  const leaseScheduleRaw = useMemo(() => getLeaseExpirySchedule(category), [category]);
  const naMessage = useMemo(() => getNAMessage(category), [category]);

  const currentYear = 2026;

  // Build lease expiry data with cumulative
  const leaseData: LeaseExpiryYear[] = useMemo(() => {
    if (!leaseScheduleRaw) return [];
    let cumulative = 0;
    return leaseScheduleRaw.map((pct, i) => {
      cumulative += pct;
      return { year: currentYear + i, pctExpiring: pct, cumulative };
    });
  }, [leaseScheduleRaw]);

  // HHI
  const hhi = useMemo(() => (tenants ? calculateHHI(tenants) : 0), [tenants]);
  const hhiInfo = useMemo(() => getHHILabel(hhi), [hhi]);

  // WALT
  const walt = useMemo(() => estimateWALT(category), [category]);

  // Top tenant %
  const topTenantPct = useMemo(() => {
    if (!tenants) return 0;
    const named = tenants.filter(t => t.name !== 'Other');
    return named.length > 0 ? named[0].pctRevenue : 0;
  }, [tenants]);

  // IG %
  const igPct = useMemo(() => (tenants ? getIGPercent(tenants) : 0), [tenants]);

  // Lease spread
  const leaseSpread = useMemo(() => estimateLeaseSpread(category), [category]);

  // Peer comparison
  const peers = useMemo(() => {
    if (!reit) return [];
    const sameSector = REITS.filter(r => r.sector === reit.sector && r.isActive);
    return sameSector
      .map(peer => {
        const pEntry = FULL_REGISTRY.find(re => re.ticker === peer.ticker);
        const pCat = classifySector(peer.sector, pEntry?.propertyType ?? '');
        const pTenants = getTenantMix(pCat);
        const pHHI = pTenants ? calculateHHI(pTenants) : 0;
        const pIG = pTenants ? getIGPercent(pTenants) : 0;
        const pTop = pTenants ? pTenants.filter(t => t.name !== 'Other')[0]?.pctRevenue ?? 0 : 0;
        const pWALT = estimateWALT(pCat);
        return {
          ticker: peer.ticker,
          name: peer.name,
          walt: pWALT,
          topTenantPct: pTop,
          hhi: pHHI,
          igPct: pIG,
          isCurrent: peer.ticker === ticker,
        };
      })
      .sort((a, b) => b.walt - a.walt);
  }, [reit, ticker]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!tenants) return [];
    return tenants.map(t => ({ name: t.name, value: t.pctRevenue }));
  }, [tenants]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!reit) {
    return (
      <div className="p-8 text-center text-slate-400 font-secondary">
        REIT not found: {ticker}
      </div>
    );
  }

  const sectorLabel = `${reit.sector} - ${propertyType}`;

  return (
    <div className="space-y-6">
      {/* A) Header */}
      <div className="flex items-center gap-3">
        <h1 className="header-noe text-2xl text-slate-200">
          Tenant & Lease Profile &mdash; {ticker}
        </h1>
        <span className="text-xs font-secondary px-2 py-0.5 rounded-full bg-rain/10 text-slate-400 border border-rain/10">
          {sectorLabel}
        </span>
      </div>

      {/* N/A sectors */}
      {naMessage ? (
        <div className="space-y-6">
          <NACard message={naMessage} sectorLabel={sectorLabel} />

          {/* Still show some basic stats for N/A sectors */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Avg. Lease Term"
              value={walt > 0 ? `${walt.toFixed(1)} yr` : 'N/A'}
              sublabel={category === 'lodging' ? 'Daily rates' : category === 'self_storage' ? 'Month-to-month' : undefined}
            />
            <MetricCard
              label="Top Tenant %"
              value="< 0.1%"
              sublabel="Highly diversified"
              accent={COLORS.emerald}
            />
            <MetricCard
              label="Concentration (HHI)"
              value="< 10"
              sublabel="Well Diversified"
              accent={COLORS.emerald}
            />
            <MetricCard
              label="Lease Spread"
              value="N/A"
              sublabel="Not applicable"
              accent={COLORS.rain}
            />
          </div>
        </div>
      ) : (
        <>
          {/* B & C) Main charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* B) Tenant Concentration */}
            <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300 font-primary uppercase tracking-wider">
                Tenant Concentration
              </h2>

              <div className="flex flex-col xl:flex-row gap-4">
                {/* Pie chart */}
                <div className="flex-shrink-0 w-full xl:w-[220px] h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={40}
                        stroke="#fff"
                        strokeWidth={1}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === 'Other' ? OTHER_COLOR : PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs font-secondary">
                    <thead>
                      <tr className="text-slate-500 border-b border-rain/10">
                        <th className="text-left py-1 pr-2">Tenant</th>
                        <th className="text-right py-1 px-2">% Rev</th>
                        <th className="text-right py-1 pl-2">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants?.map((t, i) => (
                        <tr
                          key={t.name}
                          className={`border-b border-rain/5 ${t.name === 'Other' ? 'text-slate-500' : 'text-slate-300'}`}
                        >
                          <td className="py-1 pr-2 flex items-center gap-1.5">
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor: t.name === 'Other' ? OTHER_COLOR : PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                            {t.name}
                          </td>
                          <td className="text-right py-1 px-2 tabular-nums">{t.pctRevenue.toFixed(1)}%</td>
                          <td className="text-right py-1 pl-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                t.creditRating === 'NR'
                                  ? 'bg-rain/10 text-slate-500'
                                  : t.creditRating.startsWith('A') || t.creditRating === 'AAA'
                                    ? 'bg-emerald/10 text-emerald'
                                    : t.creditRating.startsWith('BBB')
                                      ? 'bg-gold/10 text-gold'
                                      : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {t.creditRating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HHI metric */}
              <div className="flex items-center gap-4 pt-2 border-t border-rain/10">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-secondary">
                    Herfindahl Index (HHI)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-primary text-slate-200 tabular-nums">
                      {Math.round(hhi).toLocaleString()}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: `${hhiInfo.color}20`, color: hhiInfo.color }}
                    >
                      {hhiInfo.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* C) Lease Expiration Schedule */}
            <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300 font-primary uppercase tracking-wider">
                  Lease Expiration Schedule
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-secondary">WALT</span>
                  <span className="text-lg font-bold font-primary" style={{ color: COLORS.pumpkin }}>
                    {walt.toFixed(1)} yr
                  </span>
                </div>
              </div>

              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaseData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(100,116,139,0.2)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number | undefined) => `${v ?? 0}%`}
                    />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Bar dataKey="pctExpiring" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {leaseData.map((entry) => (
                        <Cell
                          key={entry.year}
                          fill={entry.year === currentYear ? COLORS.pumpkin : COLORS.lightBlue}
                          fillOpacity={entry.year === currentYear ? 1 : 0.75}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cumulative row */}
              <div className="flex items-center gap-2 pt-1 border-t border-rain/10 overflow-x-auto">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-secondary whitespace-nowrap mr-1">
                  Cumulative:
                </span>
                {leaseData.map((d) => (
                  <span
                    key={d.year}
                    className={`text-[10px] tabular-nums font-secondary px-1.5 py-0.5 rounded ${
                      d.year === currentYear
                        ? 'bg-pumpkin/10 text-pumpkin font-semibold'
                        : 'text-slate-500'
                    }`}
                  >
                    {d.cumulative.toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* D) Lease Profile Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="WALT"
              value={`${walt.toFixed(1)} yr`}
              sublabel="Weighted Avg. Lease Term"
              accent={COLORS.pumpkin}
            />
            <MetricCard
              label="Top Tenant %"
              value={`${topTenantPct.toFixed(1)}%`}
              sublabel={tenants?.filter(t => t.name !== 'Other')[0]?.name}
              accent={topTenantPct > 10 ? '#f87171' : COLORS.emerald}
            />
            <MetricCard
              label="Investment Grade %"
              value={`${igPct}%`}
              sublabel="Of named tenants (BBB- or better)"
              accent={igPct >= 70 ? COLORS.emerald : igPct >= 50 ? COLORS.gold : '#f87171'}
            />
            <MetricCard
              label="Lease Spread"
              value={`${leaseSpread > 0 ? '+' : ''}${leaseSpread} bps`}
              sublabel="New vs. expiring rents"
              accent={leaseSpread > 0 ? COLORS.emerald : '#f87171'}
            />
          </div>

          {/* E) Peer Comparison */}
          {peers.length > 1 && (
            <div className="bg-darkBlue/30 border border-rain/10 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 font-primary uppercase tracking-wider">
                Peer Comparison &mdash; {reit.sector}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-secondary">
                  <thead>
                    <tr className="text-slate-500 border-b border-rain/10">
                      <th className="text-left py-2 pr-4">Ticker</th>
                      <th className="text-right py-2 px-3">WALT (yr)</th>
                      <th className="text-right py-2 px-3">Top Tenant %</th>
                      <th className="text-right py-2 px-3">HHI</th>
                      <th className="text-right py-2 pl-3">IG %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peers.map((peer) => (
                      <tr
                        key={peer.ticker}
                        className={`border-b border-rain/5 transition-colors ${
                          peer.isCurrent
                            ? 'bg-lightBlue/5 text-lightBlue'
                            : 'text-slate-300 hover:bg-rain/5'
                        }`}
                      >
                        <td className="py-2 pr-4 font-semibold">
                          {peer.ticker}
                          {peer.isCurrent && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-lightBlue/10 text-lightBlue">
                              current
                            </span>
                          )}
                        </td>
                        <td className="text-right py-2 px-3 tabular-nums">{peer.walt.toFixed(1)}</td>
                        <td className="text-right py-2 px-3 tabular-nums">{peer.topTenantPct.toFixed(1)}%</td>
                        <td className="text-right py-2 px-3 tabular-nums">{Math.round(peer.hhi).toLocaleString()}</td>
                        <td className="text-right py-2 pl-3 tabular-nums">{peer.igPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TenantLease;
