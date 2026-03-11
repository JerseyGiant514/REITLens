# REITLens V1.0 - Professional Features (Items 12-14)

## Dependencies Required

Before using the Excel export feature, install SheetJS:

```bash
npm install xlsx
```

> The export service gracefully falls back to CSV if `xlsx` is not installed.

---

## Item 12: Scenario Manager

### Overview
The Scenario Manager enables institutional users to save, load, and compare multiple P/AFFO model configurations. This supports the standard Bull/Base/Bear case analysis workflow used in REIT equity research.

### Files
- `services/scenarioService.ts` - CRUD operations, metric calculations, comparison logic
- `components/ScenarioManager.tsx` - Collapsible panel UI with save/load/compare sections

### How It Works

#### Saving Scenarios
1. Configure the P/AFFO model sliders in JustifiedPAFFO.tsx
2. Open the "Save Current" section in ScenarioManager
3. Enter a scenario name (e.g., "Base Case Q1 2026") and optional tags
4. Click "Save Scenario" to persist

Each saved scenario captures:
- **WACC Parameters**: Rf, ERP, Beta, AFFO Payout ratio
- **Growth Parameters**: SS-NOI, Acquisition Vol/Spread, Dev Vol/Spread, Leakage, Cap
- **Derived Metrics**: Cost of Equity, Sustainable g, Justified P/AFFO, Implied Price

#### Loading Scenarios
Click the folder icon on any saved scenario card to load its parameters back into the model. This instantly updates all WACC and growth sliders.

#### Comparing Scenarios
1. Click scenario cards to toggle selection (select 2-3 scenarios)
2. Open the "Compare" section
3. View a side-by-side delta table showing all output metrics and input parameters
4. Deltas are computed relative to the first selected scenario (the "base")

#### Preset Generation
Click the "+" button to auto-generate Bull/Base/Bear scenarios. The presets adjust:
- **Bull**: Lower Rf (-50bps), lower ERP (-30bps), higher SS-NOI (+100bps), wider spreads (+30bps)
- **Bear**: Higher Rf (+75bps), higher ERP (+50bps), lower SS-NOI (-150bps), reduced volume, tighter spreads

### Data Persistence
- **Primary**: localStorage with key prefix `reitlens_scenario_`
- **Secondary** (authenticated users): Synced to Supabase `scenarios` table
- Scenarios are ticker-specific - each REIT/portfolio has its own set

### Integration Point
Import `ScenarioManager` into `JustifiedPAFFO.tsx` and place it in the sidebar alongside the WACC Protocol panel:

```tsx
import ScenarioManager from './ScenarioManager';

// Inside the sidebar (lg:col-span-1):
<ScenarioManager
  ticker={ticker}
  model={model}
  onLoadScenario={onUpdateModel}
  impliedCapRate={impliedCap}
  currentAFFO={currentAFFO}
/>
```

### API: scenarioService.ts

| Function | Description |
|---|---|
| `saveScenario(scenario)` | Save a new scenario, returns full Scenario with ID |
| `getScenario(id)` | Get a single scenario by ID |
| `getAllScenarios(ticker?)` | Get all scenarios, optionally filtered by ticker |
| `updateScenario(id, updates)` | Update an existing scenario |
| `deleteScenario(id)` | Delete a scenario from localStorage |
| `compareScenarios(scenarios[])` | Compute delta table across N scenarios |
| `calculateScenarioMetrics(wacc, growth, capRate, affo)` | Calculate derived metrics |
| `generatePresetScenarios(ticker, wacc, growth)` | Generate Bull/Base/Bear presets |
| `syncScenarioToSupabase(scenario, userId)` | Sync to cloud (optional) |
| `loadScenariosFromSupabase(userId, ticker?)` | Load from cloud (optional) |

---

## Item 13: Export to Excel/PDF

### Overview
Institutional-grade data export supporting Excel (.xlsx), CSV, PDF (print), and JSON formats. Any tabular data in the application can be exported with a single click.

### Files
- `services/exportService.ts` - Export logic for all formats
- `components/ExportButton.tsx` - Dropdown button component

### Supported Formats

| Format | Method | Notes |
|---|---|---|
| **Excel (.xlsx)** | SheetJS library | Full spreadsheet with headers, formatting, column widths |
| **CSV (.csv)** | Native JS | Universal fallback, automatic if xlsx not installed |
| **PDF (Print)** | `window.print()` | Opens print dialog with styled HTML table |
| **JSON (.json)** | `JSON.stringify()` | Raw data export for API integration |

### ExportButton Usage

```tsx
import ExportButton from './ExportButton';

<ExportButton
  data={financialData}           // Array of objects
  filename="PLD_financials"      // Base filename (no extension)
  columns={[                     // Optional column definitions
    { key: 'periodEndDate', header: 'Period' },
    { key: 'revenue', header: 'Revenue ($M)', format: v => `$${v.toFixed(1)}M` },
    { key: 'noi', header: 'NOI ($M)', format: v => `$${v.toFixed(1)}M` },
  ]}
  sheetName="Financials"         // Excel sheet name
  title="PLD Financial Summary"  // PDF title
  pdfElementId="main-table"      // Optional: export specific DOM element as PDF
  compact={false}                // Icon-only mode for tight layouts
/>
```

### ExportButton Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `data` | `Record<string, any>[]` | Yes | Data to export |
| `filename` | `string` | Yes | Base filename |
| `columns` | `ColumnDef[]` | No | Column definitions with key, header, format |
| `sheetName` | `string` | No | Excel sheet name (default: "Sheet1") |
| `title` | `string` | No | Title for PDF header |
| `pdfElementId` | `string` | No | DOM element ID for visual PDF export |
| `compact` | `boolean` | No | Icon-only trigger button |
| `rawData` | `any` | No | Override data for JSON export |
| `onExport` | `(format: string) => void` | No | Callback after successful export |

### Integration Points
Add the ExportButton to any data view:

- **Dashboard**: Export performance data and KPI metrics
- **Operations**: Export quarterly financials
- **Balance Sheet**: Export debt maturity and leverage data
- **Correlation Matrix**: Already integrated - exports correlation matrix
- **Scenario Manager**: Export scenario comparison table

### Adding New Export Targets
To add a new format (e.g., PowerPoint):

1. Create the export function in `exportService.ts`
2. Add a new entry to the `formats` array in `ExportButton.tsx`
3. Each format needs: `id`, `label`, `sublabel`, `icon`, `action`, `color`

---

## Item 14: Correlation Matrix & Factor Exposure

### Overview
Portfolio-level risk analytics including pairwise correlation heatmap, factor exposure (beta) decomposition, and portfolio risk statistics. Essential for institutional PMs managing multi-REIT allocations.

### Files
- `services/correlationService.ts` - Correlation, OLS regression, portfolio math
- `components/CorrelationMatrix.tsx` - Heatmap visualization + factor table

### Methodology

#### Pearson Correlation
The pairwise correlation matrix uses the standard Pearson product-moment correlation coefficient:

```
r(X,Y) = Cov(X,Y) / (sigma_X * sigma_Y)
```

where X and Y are daily return series computed from adjusted close prices. The correlation ranges from -1 (perfect inverse movement) to +1 (perfect co-movement).

#### Factor Exposure (OLS Regression)
Each holding is regressed against three factor benchmarks using single-factor OLS:

```
R_REIT = alpha + beta * R_Factor + epsilon
```

**Factors:**
| Factor | Ticker | Description |
|---|---|---|
| Market | SPY | Broad equity market beta - measures systematic risk |
| Interest Rate | TLT | 20+ Year Treasury - measures rate sensitivity |
| Real Estate | VNQ | Vanguard Real Estate ETF - sector-relative exposure |

**Outputs per factor:**
- **Beta**: Sensitivity coefficient (beta > 1 = amplified, < 1 = dampened)
- **R-squared**: Proportion of return variance explained by the factor
- **Alpha**: Annualized intercept (excess return after factor adjustment)
- **Residual Vol**: Annualized volatility of unexplained returns (idiosyncratic risk)

#### Portfolio Statistics
Given weights and the correlation matrix:

- **Portfolio Variance**: `w' * Sigma * w` where `Sigma_ij = rho_ij * sigma_i * sigma_j`
- **Portfolio Vol**: Square root of variance, annualized (x sqrt(252))
- **Sharpe Ratio**: `(E[R] - Rf) / sigma` with Rf = 4.0%
- **Diversification Ratio**: `Sum(w_i * sigma_i) / sigma_portfolio` (> 1 means diversification benefit)
- **Max Drawdown**: Maximum peak-to-trough decline in cumulative return series

### Data Flow
1. User selects portfolio or single REIT (falls back to sector peers)
2. `runCorrelationAnalysis()` fetches Yahoo Finance EOD for all holdings + 3 factor ETFs
3. Daily returns are computed from adjusted close prices
4. Correlation matrix, factor betas, and portfolio stats are calculated
5. Results rendered as interactive heatmap + factor table

### Component Usage

```tsx
import CorrelationMatrix from './CorrelationMatrix';

<CorrelationMatrix
  portfolio={currentPortfolio}  // Portfolio object with holdings
  ticker={currentTicker}        // Fallback: uses sector peers
/>
```

### Heatmap Color Scale
| Correlation Range | Color | Interpretation |
|---|---|---|
| +0.8 to +1.0 | Strong Blue | Highly correlated - limited diversification |
| +0.5 to +0.8 | Medium Blue | Moderately correlated |
| +0.2 to +0.5 | Light Blue | Weakly correlated |
| -0.2 to +0.2 | Neutral Gray | Uncorrelated - good diversification |
| -0.5 to -0.2 | Light Red | Weakly inverse - excellent diversification |
| -0.8 to -0.5 | Medium Red | Moderately inverse |
| -1.0 to -0.8 | Strong Red | Highly inverse - natural hedge |

### Integration Point
Add to App.tsx as a new page or embed within Portfolio Manager:

```tsx
// Option A: New page route
case 'correlation':
  return <CorrelationMatrix portfolio={currentPortfolio} ticker={currentTicker} />;

// Option B: Embed in Portfolio Manager (below holdings table)
<CorrelationMatrix portfolio={currentPortfolio} />
```

### API: correlationService.ts

| Function | Description |
|---|---|
| `calculateDailyReturns(prices)` | Convert price series to return series |
| `pearsonCorrelation(x, y)` | Pearson correlation between two arrays |
| `calculateCorrelationMatrix(priceData)` | Full NxN correlation matrix |
| `calculateFactorExposure(reitReturns, factorReturns, name, ticker)` | Single-factor OLS regression |
| `calculatePortfolioStats(weights, corrMatrix, vols, returns)` | Portfolio-level risk stats |
| `calculateMaxDrawdown(cumulativeReturns)` | Maximum peak-to-trough drawdown |
| `runCorrelationAnalysis(tickers, weights, days)` | Full analysis pipeline |
| `getCorrelationColor(value)` | Heatmap color for correlation value |
| `getCorrelationTextColor(value)` | Text color for readability |

---

## Future Enhancements

### Monte Carlo Simulation
- Simulate portfolio returns using multivariate normal distribution with the computed correlation matrix
- Generate fan charts (5th/25th/50th/75th/95th percentile paths)
- Estimate VaR and CVaR at various confidence levels

### Stress Testing
- Apply historical stress scenarios (2008 GFC, 2020 COVID, 2022 Rate Shock)
- User-defined shock scenarios: "What if rates +200bps AND cap rates +100bps?"
- Integrate with Scenario Manager for combined fundamental + market stress

### Custom Factor Models
- Allow users to add custom factor ETFs beyond SPY/TLT/VNQ
- Multi-factor regression (Fama-French style with Size, Value, Momentum)
- Property-type factors: Industrial vs Office vs Residential beta decomposition

### Enhanced Exports
- PowerPoint deck generation with templated slides
- Bloomberg Terminal-compatible data formats
- Scheduled email reports (requires backend)

### Scenario Collaboration
- Share scenarios between team members via Supabase
- Version history and audit trail for scenario changes
- Scenario templates for common analysis patterns

---

## File Summary

| File | Type | Lines | Purpose |
|---|---|---|---|
| `services/scenarioService.ts` | Service | ~300 | Scenario CRUD, metrics, comparison, Supabase sync |
| `components/ScenarioManager.tsx` | Component | ~350 | Save/Load/Compare UI panel |
| `services/exportService.ts` | Service | ~280 | Excel, CSV, PDF, JSON export logic |
| `components/ExportButton.tsx` | Component | ~200 | Dropdown export button |
| `services/correlationService.ts` | Service | ~350 | Correlation, OLS, portfolio risk math |
| `components/CorrelationMatrix.tsx` | Component | ~380 | Heatmap + factor table visualization |
