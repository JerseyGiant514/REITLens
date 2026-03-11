# REITLens V1.0 - Data Source Audit

## Current Data Provenance Map

### GOLD - Real, Verified Data
| Metric | Source | Freshness | Coverage | File |
|--------|--------|-----------|----------|------|
| Revenue | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs, ~20 qtrs each | edgarService.ts |
| Operating Income | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs | edgarService.ts |
| Net Income | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs | edgarService.ts |
| Total Assets | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs | edgarService.ts |
| Total Debt | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs | edgarService.ts |
| Total Equity | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs | edgarService.ts |
| CapEx | SEC EDGAR XBRL | ~45 day lag | 17/17 REITs | edgarService.ts |
| Stock Prices (EOD) | Yahoo Finance | Daily | All tickers | marketDataService.ts |

### SILVER - Computed/Approximated
| Metric | Method | Accuracy | Issue | File |
|--------|--------|----------|-------|------|
| Market Cap | Price × Shares Outstanding | Good (daily) | Shares may be stale | marketDataService.ts |
| NOI | Revenue × sectorMargin (hardcoded) | Rough (~70%) | Should use actual OpIncome - G&A | realDataService.ts |
| FFO | NOI - Interest - G&A | Rough (~65%) | Missing: depreciation add-back, gain/loss exclusion | realDataService.ts |
| AFFO | FFO - Maintenance CapEx | Rough (~60%) | Maintenance vs growth capex split is assumed | realDataService.ts |
| Interest Expense | totalDebt × 4.5% / 4 | Poor | Hardcoded rate, should use actual from XBRL | realDataService.ts:100 |

### BRONZE - Mocked/Hardcoded
| Metric | Current Value | Reality | Priority to Fix | File |
|--------|--------------|---------|-----------------|------|
| Dividend Yield | 4.2% for ALL REITs | Varies 2.5-7.1% by REIT | HIGH | marketDataService.ts:129 |
| Same-Store NOI Growth | opMargin × formula | Requires 10-K supplemental | MEDIUM | realDataService.ts |
| Occupancy | opMargin × 5 + 94.5 | Requires 10-K supplemental | MEDIUM | realDataService.ts |
| WALT | opMargin × 2 + 4.5 | Requires 10-K supplemental | MEDIUM | realDataService.ts |
| Leasing Spreads | growthAlpha × 4 + 5.0 | Requires 10-K supplemental | MEDIUM | realDataService.ts |
| Debt Maturity Schedule | Uniform 6-year distribution | Requires 10-K footnotes | MEDIUM | BalanceSheet.tsx |
| 10Y Treasury History | sin() + random() | Should use FRED DGS10 | HIGH | Macro.tsx |
| HY Spread | Synthetic | Should use FRED BAMLH0A0HYM2 | HIGH | Macro.tsx |
| Sector Returns (SectorLens) | Hardcoded + random noise | Should compute from Yahoo data | MEDIUM | SectorLens.tsx |
| Return Decomposition | priceReturn × 0.6 split | Should use AFFO + price + div | HIGH | calculateRealReturns.ts |
| Multiple Rerating | Always 0 | Needs historical P/FFO data | HIGH | historicalReturnsService.ts |
| Expectations Distributions | Sector-based hardcoded | Should compute from historical | MEDIUM | expectationsService.ts |
| Analyst Ratings | Gemini AI + search grounding | Potentially hallucinated | LOW (acceptable) | AnalystPerspectives.tsx |

## Institutional Profiles (Hardcoded in realDataService.ts)
These 20 parameters per REIT are calibrated assumptions with NO audit trail:

```
operatingMargin: 0.65-0.75
gaExpensePct: 0.02-0.07
dividendYield: 0.025-0.071
recurringCapexIntensity: 0.02-0.22
straightLineRentPct: 0.0-0.04
acqVolumePct, acqSpreadBps
devPipelinePct, ytcSpreadBps
growthAlpha: -0.4 to 1.9
```

These should be versioned in a database table with source attribution.

## XBRL Fields Used (edgarService.ts)
Revenue: Revenues, RevenueFromContractWithCustomerExcludingAssessedTax, RevenueFromContractWithCustomerIncludingAssessedTax
Operating Income: OperatingIncomeLoss
Net Income: NetIncomeLoss, ProfitLoss
Assets: Assets
Debt: LongTermDebt, LongTermDebtNoncurrent, DebtInstrumentCarryingAmount
Equity: StockholdersEquity, StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest
Cash Flow: NetCashProvidedByUsedInOperatingActivities
CapEx: PaymentsToAcquirePropertyPlantAndEquipment

## XBRL Fields NOT Currently Extracted (Needed)
- DepreciationDepletionAndAmortization (for real FFO)
- GainLossOnSaleOfProperties (for real FFO)
- CommonStockDividendsPerShareDeclared (for real dividend yield)
- DividendsCommonStock (aggregate dividends paid)
- InterestExpense (for actual, not estimated)
- PreferredStockDividendsAndOtherAdjustments

## API Endpoints
- SEC EDGAR: `https://data.sec.gov/api/xbrl/companyfacts/CIK{PADDED_CIK}.json` (free, 5 req/sec)
- Yahoo Finance: `/yahoo-api/v8/finance/chart/{ticker}` (Vite proxy only - BREAKS in production)
- FRED API: `https://api.stlouisfed.org/fred/series/observations` (free with key, needed)
- Gemini AI: `generativelanguage.googleapis.com` (API key exposed in client bundle - SECURITY ISSUE)
