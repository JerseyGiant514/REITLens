import React, { useMemo } from 'react';
import { REITS } from '../services/mockData';
import { getFinancials, getDebtMaturitySchedule } from '../services/dataService';
import { getInstitutionalProfile, FULL_REGISTRY } from '../services/reitRegistry';
import type { REIT, DebtMaturity } from '../types';
import TickerLink from './TickerLink';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType = 'EARNINGS' | 'EX-DIV' | 'DEBT_MATURITY';

interface CalendarEvent {
  date: Date;
  type: EventType;
  ticker: string;
  companyName: string;
  label: string;
  detail: string;
  /** Colour class for the left-border accent */
  accentClass: string;
  /** Badge background */
  badgeBg: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtShort = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const fmtWeek = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO week-year key for grouping */
function weekKey(d: Date): string {
  const sun = new Date(d);
  sun.setDate(sun.getDate() - sun.getDay());
  return isoDate(sun);
}

function relativeLabel(now: Date, target: Date): string {
  const diffMs = target.getTime() - now.getTime();
  const days = Math.round(diffMs / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 6) return `in ${days} days`;
  if (days <= 13) return 'next week';
  if (days <= 29) return `in ${Math.ceil(days / 7)} weeks`;
  if (days <= 59) return 'next month';
  return `in ${Math.round(days / 30)} months`;
}

function quarterLabel(month: number, year: number): string {
  if (month <= 2) return `Q4 ${year - 1}`;
  if (month <= 5) return `Q1 ${year}`;
  if (month <= 8) return `Q2 ${year}`;
  return `Q3 ${year}`;
}

function nextQuarterLabel(now: Date): { quarter: string; estimated: Date } {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  // Earnings reporting windows (month index, typical day)
  const windows: Array<[number, number, string]> = [
    [0, 28, `Q4 ${y - 1}`],   // Late Jan
    [1, 5, `Q4 ${y - 1}`],    // Early Feb
    [3, 28, `Q1 ${y}`],       // Late Apr
    [4, 5, `Q1 ${y}`],        // Early May
    [6, 28, `Q2 ${y}`],       // Late Jul
    [7, 5, `Q2 ${y}`],        // Early Aug
    [9, 28, `Q3 ${y}`],       // Late Oct
    [10, 5, `Q3 ${y}`],       // Early Nov
  ];
  for (const [wm, wd, q] of windows) {
    const d = new Date(y, wm, wd);
    if (d > now) return { quarter: q, estimated: d };
  }
  // Wrap to next year
  return { quarter: `Q4 ${y}`, estimated: new Date(y + 1, 0, 28) };
}

/**
 * Generate estimated earnings dates for a REIT.
 * Spreads tickers across the reporting window so they don't all land on the same day.
 */
function earningsDates(reit: REIT, tickerIndex: number, year: number): CalendarEvent[] {
  const offset = (tickerIndex % 10) + 1; // 1-10 day spread
  const events: CalendarEvent[] = [];

  // Q4 of prior year -> reported late Jan / early Feb
  events.push(makeEarnings(reit, new Date(year, 0, 25 + offset), `Q4 ${year - 1}`));
  // Q1 -> reported late Apr / early May
  events.push(makeEarnings(reit, new Date(year, 3, 24 + offset), `Q1 ${year}`));
  // Q2 -> reported late Jul / early Aug
  events.push(makeEarnings(reit, new Date(year, 6, 25 + offset), `Q2 ${year}`));
  // Q3 -> reported late Oct / early Nov
  events.push(makeEarnings(reit, new Date(year, 9, 24 + offset), `Q3 ${year}`));

  return events;
}

function makeEarnings(reit: REIT, date: Date, quarter: string): CalendarEvent {
  return {
    date,
    type: 'EARNINGS',
    ticker: reit.ticker,
    companyName: reit.name,
    label: `${quarter} Results`,
    detail: `Estimated earnings release`,
    accentClass: 'border-lightBlue',
    badgeBg: 'bg-lightBlue/20 text-lightBlue',
  };
}

/**
 * Generate ex-dividend dates (~2 weeks before quarter end).
 */
function exDivDates(reit: REIT, tickerIndex: number, year: number): CalendarEvent[] {
  const profile = getInstitutionalProfile(reit.ticker);
  const qtrDiv = ((reit.nominalPrice * profile.dividendYield) / 4).toFixed(2);
  const offset = (tickerIndex % 5);
  const months = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec

  return months.map(m => ({
    date: new Date(year, m, 14 + offset),
    type: 'EX-DIV' as EventType,
    ticker: reit.ticker,
    companyName: reit.name,
    label: `Ex-Dividend Date`,
    detail: `Est. $${qtrDiv}/share`,
    accentClass: 'border-emerald',
    badgeBg: 'bg-emerald/20 text-emerald',
  }));
}

function dollarM(v: number): string {
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EarningsCalendar: React.FC = () => {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();

  // ── Build all calendar events ────────────────────────────────────────
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    REITS.forEach((reit, idx) => {
      // Earnings (current year + next year for wrap-around)
      events.push(...earningsDates(reit, idx, currentYear));
      events.push(...earningsDates(reit, idx, currentYear + 1));

      // Ex-div dates
      events.push(...exDivDates(reit, idx, currentYear));
      events.push(...exDivDates(reit, idx, currentYear + 1));

      // Debt maturity events (only current-year maturities)
      const maturities = getDebtMaturitySchedule(reit.ticker);
      maturities
        .filter(m => m.year === currentYear || m.year === currentYear + 1)
        .forEach(m => {
          events.push({
            date: new Date(m.year, 5, 15), // approximate mid-year
            type: 'DEBT_MATURITY',
            ticker: reit.ticker,
            companyName: reit.name,
            label: `Debt Maturity`,
            detail: `${dollarM(m.amount / 1_000_000)} maturing — est. coupon`,
            accentClass: 'border-pumpkin',
            badgeBg: 'bg-pumpkin/20 text-pumpkin',
          });
        });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [currentYear]);

  // ── Debt maturities by REIT for bottom section ───────────────────────
  const debtByYear = useMemo(() => {
    const map = new Map<number, number>();
    REITS.forEach(reit => {
      const mats = getDebtMaturitySchedule(reit.ticker);
      mats.forEach(m => {
        map.set(m.year, (map.get(m.year) ?? 0) + m.amount);
      });
    });
    return Array.from(map.entries())
      .map(([year, amount]) => ({ year, amount }))
      .sort((a, b) => a.year - b.year);
  }, []);

  // ── Timeline events (next 90 days) ──────────────────────────────────
  const end90 = useMemo(() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 90);
    return d;
  }, [now]);

  const timelineEvents = useMemo(
    () => allEvents.filter(e => e.date >= now && e.date <= end90),
    [allEvents, now, end90],
  );

  const groupedByWeek = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    timelineEvents.forEach(e => {
      const key = weekKey(e.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [timelineEvents]);

  // ── Summary stats ───────────────────────────────────────────────────
  const earningsThisMonth = useMemo(() => {
    const m = now.getMonth();
    const y = now.getFullYear();
    return allEvents.filter(
      e => e.type === 'EARNINGS' && e.date.getMonth() === m && e.date.getFullYear() === y,
    ).length;
  }, [allEvents, now]);

  const exDivNext30 = useMemo(() => {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + 30);
    return allEvents.filter(e => e.type === 'EX-DIV' && e.date >= now && e.date <= cutoff).length;
  }, [allEvents, now]);

  const debtMatThisYear = useMemo(() => {
    const entry = debtByYear.find(d => d.year === currentYear);
    return entry ? entry.amount : 0;
  }, [debtByYear, currentYear]);

  const avgRefiRate = useMemo(() => {
    // Weighted-average interest cost from financials
    let totalInterest = 0;
    let totalDebt = 0;
    REITS.forEach(reit => {
      const fins = getFinancials(reit.id);
      const last = fins[fins.length - 1];
      totalInterest += last.interestExpense * 4; // annualize
      totalDebt += last.totalDebt;
    });
    return totalDebt > 0 ? (totalInterest / totalDebt) * 100 : 0;
  }, []);

  // ── Sector earnings grid ────────────────────────────────────────────
  const sectorGrid = useMemo(() => {
    const sectors = new Map<string, Array<{
      ticker: string;
      name: string;
      lastReported: string;
      nextEarnings: Date;
      daysUntil: number;
    }>>();

    REITS.forEach((reit, idx) => {
      const sectorName = reit.sector;
      if (!sectors.has(sectorName)) sectors.set(sectorName, []);

      // Find next upcoming earnings
      const upcoming = allEvents
        .filter(e => e.type === 'EARNINGS' && e.ticker === reit.ticker && e.date > now)
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      const past = allEvents
        .filter(e => e.type === 'EARNINGS' && e.ticker === reit.ticker && e.date <= now)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      const nextE = upcoming[0]?.date ?? new Date(currentYear + 1, 0, 28);
      const lastQ = past[0] ? past[0].label.replace(' Results', '') : 'N/A';
      const daysUntil = Math.round((nextE.getTime() - now.getTime()) / 86_400_000);

      sectors.get(sectorName)!.push({
        ticker: reit.ticker,
        name: reit.name,
        lastReported: lastQ,
        nextEarnings: nextE,
        daysUntil,
      });
    });

    return Array.from(sectors.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allEvents, now, currentYear]);

  // ── Debt maturity bar max for scaling ────────────────────────────────
  const debtMax = useMemo(() => Math.max(...debtByYear.map(d => d.amount), 1), [debtByYear]);

  // ── Badge component ─────────────────────────────────────────────────
  const TypeBadge: React.FC<{ type: EventType; badgeBg: string }> = ({ type, badgeBg }) => {
    const label = type === 'DEBT_MATURITY' ? 'DEBT MATURITY' : type === 'EX-DIV' ? 'EX-DIV' : 'EARNINGS';
    return (
      <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${badgeBg}`}>
        {label}
      </span>
    );
  };

  // ── Urgency color helper ────────────────────────────────────────────
  function urgencyColor(days: number): string {
    if (days < 7) return 'text-pumpkin';
    if (days <= 30) return 'text-gold';
    return 'text-emerald';
  }

  // ═══════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="header-noe text-2xl text-slate-100">Earnings Calendar & Catalyst Tracker</h1>
        <p className="font-secondary text-sm text-slate-400 mt-1">
          Upcoming earnings releases, ex-dividend dates, and debt maturity milestones across all {REITS.length} tracked REITs.
        </p>
      </div>

      {/* ── B) Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Earnings This Month"
          value={String(earningsThisMonth)}
          sub={now.toLocaleString('default', { month: 'long' })}
          accent="text-lightBlue"
        />
        <SummaryCard
          title="Upcoming Ex-Div Dates"
          value={String(exDivNext30)}
          sub="next 30 days"
          accent="text-emerald"
        />
        <SummaryCard
          title="Debt Maturities This Year"
          value={dollarM(debtMatThisYear / 1_000_000)}
          sub={String(currentYear)}
          accent="text-pumpkin"
        />
        <SummaryCard
          title="Avg Refi Rate Risk"
          value={`${avgRefiRate.toFixed(1)}%`}
          sub={avgRefiRate > 5 ? 'Above 5% benchmark' : 'Below 5% benchmark'}
          accent={avgRefiRate > 5 ? 'text-pumpkin' : 'text-emerald'}
        />
      </div>

      {/* ── Main content: Timeline + Debt sidebar ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── A) Timeline View ────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="header-noe text-lg text-slate-200">Next 90 Days</h2>

          {groupedByWeek.length === 0 && (
            <p className="text-slate-500 font-secondary text-sm italic">No events in the next 90 days.</p>
          )}

          {groupedByWeek.map(([wk, events]) => {
            const weekStart = new Date(wk + 'T00:00:00');
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return (
              <div key={wk}>
                {/* Week separator */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] uppercase tracking-widest text-slate-500 font-primary font-semibold whitespace-nowrap">
                    Week of {fmtWeek.format(weekStart)}
                  </span>
                  <div className="flex-1 border-t border-rain/10" />
                  <span className="text-[11px] text-slate-600 font-primary">
                    {events.length} event{events.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {events.map((ev, i) => (
                    <div
                      key={`${ev.ticker}-${ev.type}-${isoDate(ev.date)}-${i}`}
                      className={`flex items-start gap-4 bg-darkBlue/30 border-l-4 ${ev.accentClass} rounded-r-lg px-4 py-3 hover:bg-darkBlue/50 transition-colors`}
                    >
                      {/* Date column */}
                      <div className="flex-shrink-0 w-20 text-center">
                        <div className="bg-black/20 rounded px-2 py-1">
                          <div className="font-mono text-xs text-slate-300">{fmtShort.format(ev.date)}</div>
                          <div className="text-[10px] text-slate-500">{relativeLabel(now, ev.date)}</div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeBadge type={ev.type} badgeBg={ev.badgeBg} />
                          <TickerLink ticker={ev.ticker} className="font-primary font-semibold text-sm text-lightBlue hover:text-white underline decoration-dotted cursor-pointer transition-colors" />
                          <span className="text-slate-400 text-xs truncate">{ev.companyName}</span>
                        </div>
                        <p className="font-secondary text-sm text-slate-300">
                          {ev.label} {ev.detail ? `— ${ev.detail}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── D) Debt Maturity Sidebar ─────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="header-noe text-lg text-slate-200">Debt Maturity Wall</h2>
          <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 space-y-3">
            <p className="text-xs text-slate-500 font-secondary">Aggregate maturities across all REITs</p>
            {debtByYear.map(({ year, amount }) => {
              const pct = (amount / debtMax) * 100;
              const isCurrentYear = year === currentYear;
              return (
                <div key={year} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`font-primary font-semibold ${isCurrentYear ? 'text-pumpkin' : 'text-slate-300'}`}>
                      {year}
                    </span>
                    <span className={`font-mono ${isCurrentYear ? 'text-pumpkin' : 'text-slate-400'}`}>
                      {dollarM(amount / 1_000_000)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isCurrentYear ? 'bg-pumpkin' : 'bg-lightBlue/60'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick stats */}
          <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4 space-y-2">
            <h3 className="text-xs text-slate-500 font-secondary uppercase tracking-wider">Quick Stats</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-secondary">Total REITs Tracked</span>
              <span className="text-slate-200 font-primary font-semibold">{REITS.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-secondary">Sectors Covered</span>
              <span className="text-slate-200 font-primary font-semibold">
                {new Set(REITS.map(r => r.sector)).size}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-secondary">Events Next 90d</span>
              <span className="text-slate-200 font-primary font-semibold">{timelineEvents.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── C) Sector Earnings Grid ────────────────────────────────── */}
      <div>
        <h2 className="header-noe text-lg text-slate-200 mb-3">Sector Earnings Grid</h2>
        <div className="bg-darkBlue/30 border border-rain/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rain/10">
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-primary">Ticker</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-primary">Company</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-primary">Sector</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-primary">Last Reported</th>
                  <th className="text-left px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-primary">Next Est. Earnings</th>
                  <th className="text-right px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500 font-primary">Days Until</th>
                </tr>
              </thead>
              <tbody>
                {sectorGrid.map(([sector, reits]) => (
                  <React.Fragment key={sector}>
                    {/* Sector header row */}
                    <tr className="bg-black/20">
                      <td colSpan={6} className="px-4 py-1.5 text-xs font-primary font-semibold text-slate-400 uppercase tracking-wider">
                        {sector}
                      </td>
                    </tr>
                    {reits.map(r => (
                      <tr key={r.ticker} className="border-b border-rain/5 hover:bg-darkBlue/40 transition-colors">
                        <td className="px-4 py-2 font-primary font-semibold"><TickerLink ticker={r.ticker} className="text-lightBlue hover:text-white font-semibold underline decoration-dotted cursor-pointer transition-colors" /></td>
                        <td className="px-4 py-2 text-slate-300 font-secondary truncate max-w-[200px]">{r.name}</td>
                        <td className="px-4 py-2 text-slate-500 font-secondary text-xs">{sector}</td>
                        <td className="px-4 py-2 text-slate-400 font-secondary">{r.lastReported}</td>
                        <td className="px-4 py-2 text-slate-300 font-secondary">{fmt.format(r.nextEarnings)}</td>
                        <td className={`px-4 py-2 text-right font-mono font-semibold ${urgencyColor(r.daysUntil)}`}>
                          {r.daysUntil}d
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  title: string;
  value: string;
  sub: string;
  accent: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, sub, accent }) => (
  <div className="bg-darkBlue/30 border border-rain/10 rounded-lg p-4">
    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-primary mb-2">{title}</p>
    <p className={`text-2xl font-primary font-bold ${accent}`}>{value}</p>
    <p className="text-xs text-slate-500 font-secondary mt-1">{sub}</p>
  </div>
);

export default EarningsCalendar;
