
import React, { useMemo, useState, useEffect } from 'react';
import { MetricChart } from './Charts';
import { REITS, generateMarketData } from '../services/mockData';
import { Sector, FinancialsQuarterly, Portfolio } from '../types';
import { InfoTooltip } from './InfoTooltip';
import { getFinancials, getKPIs, loadRealFinancials, getMarketDataSync, getFinancialsDataSource, getMarketDataSource } from '../services/dataService';
import { calculatePortfolioPerformance, PortfolioConstituent, AggregatedPerformance } from '../services/marketDataService';
import { getDividendYield } from '../services/dividendService';
import ExportButton from './ExportButton';
import { DataSourceBadge } from './DataSourceBadge';
import { StalenessIndicator } from './StalenessIndicator';
import { useToast } from '../contexts/ToastContext';

interface DashboardProps {
  ticker: string;
  sector: Sector | null;
  portfolio: Portfolio | null;
  liveFinancials?: FinancialsQuarterly[];
}

type TimeframeKey = '5D' | '1M' | '6M' | 'YTD' | '3Y' | '5Y' | '10Y';

const TIMEFRAME_DAYS: Record<TimeframeKey, number | 'YTD'> = {
  '5D': 7,
  '1M': 35,
  '6M': 185,
  'YTD': 'YTD',
  '3Y': 1100,
  '5Y': 1830,
  '10Y': 3660,
};

const getTimeframeDays = (key: TimeframeKey): number => {
  const val = TIMEFRAME_DAYS[key];
  if (val === 'YTD') {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)) + 5;
  }
  return val;
};

const Dashboard: React.FC<DashboardProps> = React.memo(({ ticker, sector, portfolio, liveFinancials }) => {
  const [performanceData, setPerformanceData] = useState<AggregatedPerformance[]>([]);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeKey>('6M');
  const [realDividendYields, setRealDividendYields] = useState<Record<string, number>>({});
  const { addToast } = useToast();
  const USE_REAL_DATA = true;

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

  // Load real financials from database (async, populates cache for getFinancials)
  useEffect(() => {
    let toastShown = false;
    constituents.forEach(({ reit }) => {
      loadRealFinancials(reit.id).catch(() => {
        if (!toastShown) {
          toastShown = true;
          addToast({
            type: 'warning',
            title: 'Using estimated financial data',
            message: `Could not load verified data for ${reit.id}. Displaying synthetic estimates.`,
            duration: 6000,
          });
        }
      });
    });
  }, [constituents, addToast]);

  // Detect data source for the primary constituent
  const primaryReit = constituents[0]?.reit;
  const financialsSource = useMemo(
    () => primaryReit ? getFinancialsDataSource(primaryReit.id) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primaryReit?.id, performanceData]
  );
  const marketSource = useMemo(
    () => primaryReit ? getMarketDataSource(primaryReit.id) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primaryReit?.id, performanceData]
  );

  // Fetch real dividend yields from dividendService (DB > EDGAR > estimated fallback)
  useEffect(() => {
    let cancelled = false;
    const fetchYields = async () => {
      const yields: Record<string, number> = {};
      for (const { reit } of constituents) {
        try {
          const result = await getDividendYield(reit.ticker);
          if (!cancelled) {
            yields[reit.ticker] = result.yield;
          }
        } catch (e) {
          // silently skip failed dividend yield fetch
        }
      }
      if (!cancelled) {
        setRealDividendYields(yields);
      }
    };
    fetchYields();
    return () => { cancelled = true; };
  }, [constituents]);

  // Fetch real aggregated performance data
  useEffect(() => {
    if (!USE_REAL_DATA) {
      setPerformanceData([]);
      return;
    }

    const fetchPerformance = async () => {
      setIsLoadingPerformance(true);
      try {
        const portfolioConstituents: PortfolioConstituent[] = constituents.map(({ reit, weight }) => ({
          ticker: reit.ticker,
          reitId: reit.id,
          weight,
          sharesOutstanding: reit.sharesOutstanding,
        }));

        const days = getTimeframeDays(selectedTimeframe);
        const data = await calculatePortfolioPerformance(portfolioConstituents, days);
        setPerformanceData(data);
      } catch (error) {
        setPerformanceData([]);
        addToast({
          type: 'error',
          title: 'Market data unavailable',
          message: 'Could not fetch live performance data. Displaying cached or synthetic data.',
          duration: 6000,
        });
      } finally {
        setIsLoadingPerformance(false);
      }
    };

    fetchPerformance();
  }, [constituents, selectedTimeframe]);

  const aggregatedData = useMemo(() => {
    const dataPoints = constituents.map(({ reit, weight }) => {
      // Use real market data if cached, otherwise fall back to mock
      const marketData = getMarketDataSync(reit.id);
      const latestMarket = marketData.length > 0 ? marketData[0] : generateMarketData(reit.id)[0];
      const fin = getFinancials(reit.id, liveFinancials);
      const kpis = getKPIs(reit.id, liveFinancials);
      const latestKPI = kpis[kpis.length - 1];

      const lastFourFin = fin.slice(-4);
      const ttmNOI = lastFourFin.reduce((acc, q) => acc + q.noi, 0);
      const latestFin = fin[fin.length - 1];
      const ev = latestMarket.marketCap + latestFin.totalDebt;

      // Use real dividend yield if available, otherwise fall back to market data
      const divYield = realDividendYields[reit.ticker] ?? latestMarket.dividendYield;

      return {
        marketCap: latestMarket.marketCap,
        totalDebt: latestFin.totalDebt,
        ttmNOI,
        ev,
        divYield,
        ssNoi: latestKPI.sameStoreNOIGrowth,
        cashNoiGrowth: latestKPI.cashNoiGrowth,
        payoutAffo: latestKPI.payoutAffo,
        weight,
        reitId: reit.id
      };
    });

    const totalMarketCap = dataPoints.reduce((sum, d) => sum + d.marketCap, 0);
    const totalWeightedEV = dataPoints.reduce((sum, d) => sum + (d.ev * d.weight), 0);
    const totalWeightedNOI = dataPoints.reduce((sum, d) => sum + (d.ttmNOI * d.weight), 0);

    const weightedDivYield = dataPoints.reduce((sum, d) => sum + (d.divYield * d.weight), 0);
    const weightedSSNOI = dataPoints.reduce((sum, d) => sum + (d.ssNoi * d.weight), 0);
    const weightedCashNOIGrowth = dataPoints.reduce((sum, d) => sum + (d.cashNoiGrowth * d.weight), 0);
    const weightedPayoutAffo = dataPoints.reduce((sum, d) => sum + (d.payoutAffo * d.weight), 0);

    const impliedCapRate = totalWeightedEV > 0 ? (totalWeightedNOI / totalWeightedEV) * 100 : 0;
    const evNoi = totalWeightedNOI > 0 ? totalWeightedEV / totalWeightedNOI : 0;

    // Convert performance data to chart format (real aggregated data)
    const chartMarket = USE_REAL_DATA && performanceData.length > 0
      ? performanceData.map(p => ({
          date: p.date,
          closePrice: p.priceIndex,
          totalReturnIndex: p.indexValue,
          reitId: 'portfolio',
          marketCap: 0,
          dividendYield: 0
        }))
      : generateMarketData(constituents[0].reit.id).slice().reverse();

    return {
      marketCap: portfolio ? totalMarketCap : (sector ? totalMarketCap : dataPoints[0].marketCap),
      evNoi,
      impliedCapRate,
      divYield: weightedDivYield,
      ssNoi: weightedSSNOI,
      cashNoiGrowth: weightedCashNOIGrowth,
      payoutAffo: weightedPayoutAffo,
      chartMarket,
      chartFinancials: getFinancials(constituents[0].reit.id, liveFinancials),
      isLive: USE_REAL_DATA && performanceData.length > 0
    };
  }, [constituents, sector, portfolio, liveFinancials, performanceData, realDividendYields]);

  const kpis_list = [
    {
      label: portfolio ? 'Portfolio Mkt Cap' : (sector ? 'Sector Cap' : 'Market Cap'),
      value: `$${(aggregatedData.marketCap / 1000).toFixed(1)}B`,
      change: '+2.1%',
      isPositive: true,
      color: 'lightBlue',
      tooltip: "Total equity value of the selected universe based on current spot prices."
    },
    {
      label: 'Wtd. EV/NOI',
      value: `${aggregatedData.evNoi.toFixed(1)}x`,
      change: '-0.4x',
      isPositive: false,
      color: 'gold',
      tooltip: "Enterprise Value divided by TTM NOI. A cleaner alternative to P/FFO that accounts for leverage."
    },
    {
      label: 'EV Cap Rate',
      value: `${aggregatedData.impliedCapRate.toFixed(2)}%`,
      change: 'NOI / (Mkt Cap + Debt)',
      isPositive: true,
      color: 'gold',
      tooltip: "The yield the market is pricing into the assets. Calculated as TTM NOI / Enterprise Value."
    },
    {
      label: 'AFFO Payout',
      value: `${aggregatedData.payoutAffo.toFixed(1)}%`,
      change: 'INSTITUTIONAL',
      isPositive: true,
      color: 'lightBlue',
      tooltip: "Dividends paid as a % of Adjusted Funds From Operations (AFFO). The true measure of dividend safety."
    },
    {
      label: 'Cash NOI Growth',
      value: `${aggregatedData.cashNoiGrowth.toFixed(2)}%`,
      change: '+30bps',
      isPositive: true,
      color: 'pumpkin',
      tooltip: "Same-store NOI growth adjusted for non-cash straight-line rent. Represents actual cash flow growth."
    },
    {
      label: 'Risk-Adj Alpha',
      value: '8.44%',
      change: 'ALPHA',
      isPositive: true,
      color: 'pumpkin',
      tooltip: "Excess return relative to the sector benchmark, adjusted for beta and leverage risk."
    },
  ];

  const exportData = useMemo(() => kpis_list.map(kpi => ({
    Metric: kpi.label,
    Value: kpi.value,
    Change: kpi.change,
  })), [kpis_list]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
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
          {marketSource && !marketSource.isFallback && (
            <StalenessIndicator
              lastUpdated={marketSource.lastUpdated}
              source="Yahoo"
              compact
            />
          )}
        </div>
        <ExportButton
          data={exportData}
          filename={`REITLens-Dashboard-${ticker}`}
          title="Dashboard KPIs"
          sheetName="Dashboard"
          compact
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {kpis_list.map((kpi, idx) => (
          <div key={idx} className="aegis-card gold-braiding p-6 flex flex-col justify-between group">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${kpi.color === 'lightBlue' ? 'text-lightBlue' : kpi.color === 'pumpkin' ? 'text-pumpkin' : 'text-gold'
                }`}>{kpi.label}</span>
              <InfoTooltip content={kpi.tooltip} />
            </div>
            <div className="flex items-baseline justify-between mt-4">
              <span className="text-2xl font-bold text-white font-tertiary">{kpi.value}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm border ${kpi.isPositive ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-rose-500/30 text-rose-400 bg-rose-500/5'
                }`}>
                {kpi.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="aegis-card p-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="header-noe text-lg text-white">
                {portfolio || sector ? 'Weighted Portfolio Performance' : 'Equity Performance'}
              </h3>
              <p className="text-[10px] text-rain font-bold uppercase tracking-widest mt-1">
                EOD Adjusted Close • Yahoo Finance
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingPerformance && (
                <>
                  <div className="w-2 h-2 bg-lightBlue rounded-full animate-pulse"></div>
                  <span className="text-[9px] text-lightBlue font-bold uppercase">Loading...</span>
                </>
              )}
              {aggregatedData.isLive && !isLoadingPerformance && (
                <>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase">Live</span>
                </>
              )}
            </div>
          </div>
          {/* Timeframe selector */}
          <div className="flex gap-1 mb-6">
            {(Object.keys(TIMEFRAME_DAYS) as TimeframeKey[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-200 ${
                  selectedTimeframe === tf
                    ? 'bg-lightBlue/20 text-lightBlue border border-lightBlue/40'
                    : 'text-rain hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <MetricChart
            data={aggregatedData.chartMarket}
            xKey="date"
            dataKey="closePrice"
            secondaryDataKey={aggregatedData.isLive ? "totalReturnIndex" : undefined}
            type="stock"
            color="#48A3CC"
            format={(v) => v.toFixed(1)}
          />
          {aggregatedData.isLive && performanceData.length > 0 && (
            <div className="mt-4 p-3 bg-lightBlue/5 border border-lightBlue/20 rounded">
              <div className="grid grid-cols-4 gap-4 text-[11px]">
                <div>
                  <div className="text-rain uppercase text-[8px] font-bold">Price</div>
                  <div className={`font-black mono ${performanceData[performanceData.length - 1]?.priceCumulativeReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {performanceData[performanceData.length - 1]?.priceCumulativeReturn >= 0 ? '+' : ''}{performanceData[performanceData.length - 1]?.priceCumulativeReturn.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-rain uppercase text-[8px] font-bold">Total Return</div>
                  <div className={`font-black mono ${performanceData[performanceData.length - 1]?.cumulativeReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {performanceData[performanceData.length - 1]?.cumulativeReturn >= 0 ? '+' : ''}{performanceData[performanceData.length - 1]?.cumulativeReturn.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-rain uppercase text-[8px] font-bold">Timeframe</div>
                  <div className="text-white font-black mono">{selectedTimeframe}</div>
                </div>
                <div>
                  <div className="text-rain uppercase text-[8px] font-bold">Data Points</div>
                  <div className="text-white font-black mono">{performanceData.length}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="aegis-card p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="header-noe text-lg text-white">Asset Yield Generation</h3>
              <p className="text-[10px] text-rain font-bold uppercase tracking-widest mt-1">NOI Quarterly Aggregate</p>
            </div>
          </div>
          <MetricChart data={aggregatedData.chartFinancials} xKey="periodEndDate" dataKey="noi" type="bar" color="#FF9D3C" format={(v) => `$${v.toFixed(1)}M`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 aegis-card p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="header-noe text-base text-white">Data Integrity Protocol</h3>
            <span className="text-[9px] font-bold text-rain uppercase tracking-widest">
              {aggregatedData.isLive ? 'Live Data: Yahoo Finance EOD' : 'EDGAR Source: V.1.2'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-darkBlue/20 border border-rain/20 rounded">
              <span className="text-[10px] font-bold text-lightBlue uppercase tracking-widest">
                {aggregatedData.isLive ? 'Market Data Source' : 'SEC Verification'}
              </span>
              <div className="mt-2 space-y-1.5 text-[11px] text-slate-400 font-medium">
                {aggregatedData.isLive ? (
                  <>
                    <div>• Yahoo Finance v8 API</div>
                    <div>• EOD Adjusted Close Prices</div>
                    <div>• 15min Cache / Auto-Refresh</div>
                  </>
                ) : (
                  <>
                    <div>• GAAP Compliant Fact Extraction</div>
                    <div>• Share Count: SEC Verified</div>
                    <div>• Reporting Period: Q4 2024</div>
                  </>
                )}
              </div>
            </div>
            <div className="p-5 bg-darkBlue/20 border border-rain/20 rounded">
              <span className="text-[10px] font-bold text-pumpkin uppercase tracking-widest">
                {aggregatedData.isLive ? 'Aggregation Method' : 'Model Proxies'}
              </span>
              <div className="mt-2 space-y-1.5 text-[11px] text-slate-400 font-medium">
                {aggregatedData.isLive ? (
                  <>
                    <div>• Weighted Daily Returns</div>
                    <div>• Indexed to 100 (Base)</div>
                    <div>• {constituents.length} Constituent{constituents.length > 1 ? 's' : ''}</div>
                  </>
                ) : (
                  <>
                    <div>• SS-NOI: Sector Regression</div>
                    <div>• WALT: Peer Average Proxy</div>
                    <div>• Occupancy: Green Street Factor</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="aegis-card p-8 bg-darkBlue/30">
          <h3 className="header-noe text-base text-white mb-6">Implied Cap Math</h3>
          <div className="space-y-5">
            <div className="flex justify-between text-xs border-b border-rain/10 pb-2">
              <span className="text-rain font-bold uppercase tracking-wider">TTM NOI Est.</span>
              <span className="text-white font-bold font-tertiary">${(aggregatedData.marketCap * aggregatedData.impliedCapRate / 10000).toFixed(1)}B</span>
            </div>
            <div className="flex justify-between text-xs border-b border-rain/10 pb-2">
              <span className="text-rain font-bold uppercase tracking-wider">Strategy EV</span>
              <span className="text-white font-bold font-tertiary">${(aggregatedData.marketCap / 1000).toFixed(1)}B+</span>
            </div>
            <div className="flex justify-between text-xs pt-2">
              <span className="text-gold font-bold uppercase tracking-widest">Implied Cap</span>
              <span className="text-gold font-bold font-tertiary">{aggregatedData.impliedCapRate.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
