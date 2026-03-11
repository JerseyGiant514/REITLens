
import { REIT, Sector, FinancialsQuarterly, MarketDaily, REITKPIs, DebtMaturity, MacroDaily } from '../types';
import {
  REITS as REGISTRY_REITS,
  INSTITUTIONAL_PROFILES,
  DEFAULT_PROFILE,
  getInstitutionalProfile,
} from './reitRegistry';

// Re-export REITS from the canonical registry so all existing imports continue to work
export const REITS: REIT[] = REGISTRY_REITS;

export const generateFinancials = (reitId: string): FinancialsQuarterly[] => {
  const reit = REITS.find(r => r.id === reitId)!;
  const profile = getInstitutionalProfile(reit.ticker);
  const quarters = ['2023-03-31', '2023-06-30', '2023-09-30', '2023-12-31', '2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31'];

  const mktCapBaseline = reit.sharesOutstanding * reit.nominalPrice;
  const estimatedAssets = mktCapBaseline / (1 - profile.targetLTV);
  const estimatedDebt = estimatedAssets * profile.targetLTV;
  const qtrNoiBase = (estimatedAssets * profile.baselineCapRate) / 4;
  const qtrRevBase = qtrNoiBase / profile.operatingMargin;

  return quarters.map((date, i) => {
    const revenue = Math.round(qtrRevBase * (1 + i * 0.01));
    const noi = Math.round(qtrNoiBase * (1 + i * 0.012));
    const gaExpense = Math.round(revenue * profile.gaExpensePct);
    const maintenanceCapex = Math.round(noi * profile.recurringCapexIntensity);
    const growthCapex = Math.round(noi * (profile.devPipelinePct / 4));
    const straightLineRent = Math.round(revenue * profile.straightLineRentPct);
    const interestExpense = Math.round(estimatedDebt * 0.045 / 4);
    const ebitdare = noi - gaExpense;
    const ffo = noi - interestExpense - gaExpense; // FFO = NOI - Interest - G&A

    return {
      periodEndDate: date,
      reitId,
      revenue,
      netIncome: Math.round(revenue * 0.22),
      operatingCashFlow: Math.round(revenue * 0.55),
      totalAssets: Math.round(estimatedAssets),
      totalDebt: Math.round(estimatedDebt),
      equity: Math.round(estimatedAssets - estimatedDebt),
      dilutedShares: reit.sharesOutstanding,
      dividendsPaid: (reit.nominalPrice * profile.dividendYield) / 4, // Use ticker-specific yield
      noi,
      ffo,
      straightLineRent,
      maintenanceCapex,
      growthCapex,
      gaExpense,
      ebitdare,
      interestExpense
    };
  });
};

export const generateMarketData = (reitId: string): MarketDaily[] => {
  const reit = REITS.find(r => r.id === reitId)!;
  const financials = generateFinancials(reitId);
  const data: MarketDaily[] = [];
  const basePrice = reit.nominalPrice;

  for (let i = 0; i < 60; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const applicableFinancials = [...financials].filter(f => f.periodEndDate <= dateStr).sort((a, b) => b.periodEndDate.localeCompare(a.periodEndDate))[0] || financials[0];
    const price = basePrice * (1 + (Math.sin(i * 0.12) * 0.04));
    data.push({
      date: dateStr,
      reitId,
      closePrice: price,
      marketCap: price * applicableFinancials.dilutedShares,
      dividendYield: 4.2 * (basePrice / price)
    });
  }
  return data;
};

export const generateKPIs = (reitId: string): REITKPIs[] => {
  const reit = REITS.find(r => r.id === reitId)!;
  const profile = getInstitutionalProfile(reit.ticker);
  const quarters = ['2023-12-31', '2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31'];
  const financials = generateFinancials(reitId);

  return quarters.map(date => {
    const fin = financials.find(f => f.periodEndDate === date) || financials[financials.length - 1];
    const ssNoi = 2.5 + profile.growthAlpha;
    const acqAccretion = (profile.acqVolumePct * profile.acqSpreadBps) / 100;
    const devAlpha = (profile.devPipelinePct * profile.ytcSpreadBps) / 100;
    const structuralLeakage = -(profile.recurringCapexIntensity * 10);
    const capImpact = (Math.random() * 0.4) - 0.2;

    const affo = fin.noi - fin.straightLineRent - fin.maintenanceCapex;
    const payoutAffo = (fin.dividendsPaid / (affo / fin.dilutedShares)) * 100;
    const interestCoverage = fin.ebitdare / fin.interestExpense;
    const gaToGav = (fin.gaExpense * 4) / fin.totalAssets * 100;

    return {
      periodEndDate: date,
      reitId,
      sameStoreNOIGrowth: ssNoi,
      occupancy: 94.5 + (profile.operatingMargin * 5),
      leasingSpread: 5.0 + (profile.growthAlpha * 4),
      walt: 4.5 + (profile.operatingMargin * 2),
      growthDecomp: {
        ssNoi,
        acquisitionAccretion: acqAccretion,
        devAlpha,
        structuralLeakage,
        capImpact,
        netAffoGrowth: ssNoi + acqAccretion + devAlpha + structuralLeakage + capImpact
      },
      cashNoiGrowth: ssNoi - 0.5, // Slightly lower than GAAP NOI growth usually
      gaToGav,
      interestCoverage,
      payoutAffo
    };
  });
};

export const generateDebtMaturity = (reitId: string): DebtMaturity[] => {
  const reit = REITS.find(r => r.id === reitId)!;
  const financials = generateFinancials(reitId);
  const totalDebt = financials[financials.length - 1].totalDebt;
  return [2025, 2026, 2027, 2028, 2029, 2030].map(year => ({
    year, reitId, amount: (totalDebt / 6) * (0.8 + Math.random() * 0.4)
  }));
};

export const MACRO_DATA: MacroDaily[] = [
  { date: '2024-12-31', seriesId: 'DGS10', value: 4.25, seriesName: '10-Year Treasury' },
  { date: '2024-12-31', seriesId: 'BAMLH0A0HYM2', value: 3.80, seriesName: 'HY Spread' },
];
