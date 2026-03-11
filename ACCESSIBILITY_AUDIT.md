# REITLens V1.0 -- Accessibility Audit

Date: 2026-03-04
Auditor: Architecture & State Management Agent
Standard: WCAG 2.1 Level AA

---

## Priority Definitions

- **P0 -- Critical**: Keyboard traps, no screen reader support, completely inaccessible functionality
- **P1 -- High**: Missing labels, missing ARIA attributes, no programmatic relationships
- **P2 -- Medium**: Color contrast issues, missing alt text, cosmetic accessibility gaps

---

## 1. Layout.tsx (SearchableSelect)

**Status: PARTIALLY FIXED in this upgrade**

### Fixed Issues
- Added `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, `aria-owns` to the trigger element
- Added `role="listbox"` and `role="option"` with `aria-selected` to dropdown items
- Added `aria-labelledby` linking the label span to the combobox
- Added `aria-activedescendant` for tracking the highlighted option
- Added keyboard navigation: ArrowUp/Down, Enter, Space, Escape, Home, End
- Added `role="searchbox"` and `aria-label` to the search input
- Added `aria-hidden="true"` to decorative SVG chevron icons
- Added `aria-current="page"` to active navigation buttons
- Added `role="switch"` and `aria-checked` to live mode toggle
- Added `role="main"` and `aria-label` to the main content area
- Added `role="complementary"` and `aria-label` to the sidebar

### Remaining Issues

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 1.1 | Search input `autoFocus` grabs focus without warning when dropdown opens | P1 | Add `aria-live="polite"` region announcing "dropdown opened, N options available" |
| 1.2 | No visible focus indicator on the combobox trigger in its default state | P2 | Add `focus-visible:ring-2 focus-visible:ring-lightBlue` to the trigger div |
| 1.3 | The three SearchableSelect instances share similar label text but no unique `aria-describedby` | P2 | Add descriptive text like "Select a REIT ticker" vs "Select a sector" |

---

## 2. Charts.tsx (MetricChart)

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 2.1 | No `role="img"` or `aria-label` on chart containers | P0 | Add `role="img"` and a descriptive `aria-label` to the outermost `<div>` (e.g. "Area chart showing NOI over 8 quarters") |
| 2.2 | Recharts SVG elements have no `<title>` or `<desc>` elements | P1 | Use Recharts' `accessibilityLayer` prop (available in v2.9+) or manually add `<title>` to the `<svg>` |
| 2.3 | Tooltip is mouse-hover only, not keyboard accessible | P1 | Add keyboard focus tracking: on chart focus, show tooltip for the nearest data point |
| 2.4 | `StockTooltip` uses inline styles with hard-coded colors -- no high-contrast mode support | P2 | Use CSS custom properties or Tailwind classes instead of inline hex colors |
| 2.5 | Chart data is not available in any non-visual format | P1 | Add a visually-hidden `<table>` below each chart with the same data as a fallback for screen readers |
| 2.6 | Color-only differentiation between positive (green) and negative (red) performance | P2 | Add a "+/-" text prefix or directional arrow that is visible alongside the color indicator |

---

## 3. InfoTooltip.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 3.1 | Tooltip is hover-only (`onMouseEnter`/`onMouseLeave`) -- completely inaccessible via keyboard | P0 | Add `tabIndex={0}`, `onFocus`/`onBlur` handlers, and `role="button"` to the trigger. Add `aria-describedby` linking to tooltip content. |
| 3.2 | The `<Info>` icon has no accessible name | P1 | Add `aria-label="More information"` or `<title>Info</title>` inside the SVG |
| 3.3 | Tooltip has `pointer-events-none` which prevents mouse users from selecting tooltip text | P2 | Remove `pointer-events-none` and keep tooltip visible while hovered |
| 3.4 | No `role="tooltip"` on the tooltip container | P1 | Add `role="tooltip"` and `id` to the tooltip, then `aria-describedby` on the trigger |
| 3.5 | Tooltip animation uses `motion` but no `prefers-reduced-motion` check | P2 | Wrap animation in a media query or use `motion`'s `useReducedMotion` hook |

---

## 4. Dashboard.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 4.1 | KPI cards use color-only change indicators (green/red badge) | P2 | Include a "+"/"-" or up/down arrow icon alongside the colored badge text |
| 4.2 | Timeframe selector buttons have no `aria-pressed` or grouped role | P1 | Wrap buttons in a `role="group"` with `aria-label="Select timeframe"`, add `aria-pressed` to each button |
| 4.3 | Loading spinner (`animate-spin` div) has no accessible announcement | P1 | Add `role="status"` and `aria-label="Loading performance data"` to the spinner container |
| 4.4 | The "Live" / "Loading..." status indicators are visual-only | P1 | Add `aria-live="polite"` to the status container so screen readers announce state changes |
| 4.5 | Chart containers lack `aria-label` describing what they show | P1 | See Charts.tsx issue 2.1 |

---

## 5. AuthModal.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 5.1 | Modal backdrop click closes modal but no Escape key handler | P0 | Add `onKeyDown` handler for Escape key to close the modal |
| 5.2 | No focus trap -- Tab key can navigate behind the modal to the sidebar | P0 | Implement focus trap: on mount, capture focusable elements; on Tab at last element, cycle to first |
| 5.3 | Modal container lacks `role="dialog"` and `aria-modal="true"` | P1 | Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title |
| 5.4 | Close button (X icon) has no accessible label | P1 | Add `aria-label="Close authentication dialog"` to the close button |
| 5.5 | Error message (`errorMSG`) is not announced to screen readers | P1 | Add `role="alert"` to the error message container |
| 5.6 | Form labels use custom text ("Email Designation", "Passcode") which may confuse screen readers | P2 | Add `aria-label` with standard text ("Email address", "Password") to the input fields |
| 5.7 | Toggle between Sign Up / Login does not announce the mode change | P2 | Add `aria-live="polite"` to the title region |

---

## 6. Valuation.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 6.1 | Lookback period buttons (1Y, 3Y, 5Y, 10Y) lack `aria-pressed` | P1 | Add `aria-pressed={selectedLookback === p}` to each button |
| 6.2 | `DistributionScale` visualization is purely visual -- no text alternative | P0 | Add `role="img"` with `aria-label` describing current value vs. range (e.g. "Current: 14.2x, Range: 10.5x to 22.0x, Median: 16.5x") |
| 6.3 | Expectations status uses color-only indicators (colored dot + colored text) | P2 | Add a text prefix like "[CHEAP]" or "[EXPENSIVE]" for screen readers |
| 6.4 | Value trap status uses color-only differentiation (emerald vs rose) | P2 | Already has text labels -- but add `aria-label` with the full verdict for screen readers |

---

## 7. JustifiedPAFFO.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 7.1 | Range inputs (`<input type="range">`) have no accessible labels | P0 | Add `aria-label` to each range input (e.g. `aria-label="Risk-free rate: 4.2%"`) or associate with the visible label using `aria-labelledby` |
| 7.2 | PercentilePicker buttons have no `aria-pressed` state | P1 | Add `aria-pressed={isActive}` to each percentile button |
| 7.3 | Sensitivity table cells use color-only encoding (green = undervalued, red = overvalued) | P2 | Add `aria-label` to each cell (e.g. "14.2x, undervalued vs. market") or add text indicators |
| 7.4 | The large justified multiple display (`text-6xl`) has no semantic heading or label | P1 | Wrap in a heading or add `aria-label="Justified P/AFFO Multiple: 18.2x"` |
| 7.5 | GrowthBridge component sliders change visible numeric outputs but these are not announced | P1 | Add `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-valuetext` to each range input |

---

## 8. PortfolioManager.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 8.1 | Ticker selection buttons in "Security Universe" grid have no role="checkbox" or aria-checked | P1 | Use `role="checkbox"` with `aria-checked` since they toggle inclusion/exclusion |
| 8.2 | Weight allocation range inputs have no `aria-label` | P0 | Add `aria-label="Weight for {ticker}: {weight}%"` |
| 8.3 | Delete portfolio button (trash icon) has no accessible label | P1 | Add `aria-label="Delete portfolio {name}"` |
| 8.4 | Remove ticker button (trash icon) has no accessible label | P1 | Add `aria-label="Remove {ticker} from portfolio"` |
| 8.5 | Weight integrity check uses color-only feedback (green = 100%, red = not 100%) | P2 | Already has numeric display -- add `role="status"` and `aria-live="polite"` to announce changes |
| 8.6 | "Equalize Weights" button has no descriptive label for screen readers | P2 | Current text is adequate; optionally add `aria-describedby` linking to explanation text |

---

## 9. Watchlist.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 9.1 | Data table lacks `aria-label` or `<caption>` | P1 | Add `<caption className="sr-only">Core Research Watchlist showing 8 REITs with price, cap rate, yield, and market cap</caption>` |
| 9.2 | Pie chart (Sector Allocation) has no text alternative | P0 | Add `role="img"` and `aria-label` describing the sector breakdown |
| 9.3 | Column headers use `<th>` correctly but lack `scope="col"` | P2 | Add `scope="col"` to each `<th>` element |
| 9.4 | "Update Universe" button does not describe its action to screen readers | P2 | Current text is adequate; no change needed |

---

## 10. Operations.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 10.1 | KPI cards with color-only trend indicators | P2 | Add "+"/"-" prefix to change values |
| 10.2 | InfoTooltip used throughout -- inherits all issues from section 3 | P0 | Fix InfoTooltip component (section 3) |
| 10.3 | Chart components -- inherits all issues from section 2 | P1 | Fix Charts.tsx (section 2) |

---

## 11. BalanceSheet.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 11.1 | InfoTooltip instances -- inherits all issues from section 3 | P0 | Fix InfoTooltip component |
| 11.2 | Chart components -- inherits all issues from section 2 | P1 | Fix Charts.tsx |
| 11.3 | Color-only "green" indicator for metrics that pass threshold checks | P2 | Add a checkmark icon or "[PASS]" text label alongside the green color |

---

## 12. SectorLens.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 12.1 | Return period selector buttons have no `aria-pressed` | P1 | Add `aria-pressed={selectedPeriod === period}` |
| 12.2 | Sector comparison bar chart has no text alternative | P0 | Add `role="img"` and descriptive `aria-label` |
| 12.3 | Color-only performance indicators (green/red for returns) | P2 | Add "+"/"-" text prefix |

---

## 13. Macro.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 13.1 | Horizon selector buttons lack `aria-pressed` | P1 | Add `aria-pressed={selectedHorizon === h}` |
| 13.2 | Scatter chart and composed chart have no text alternatives | P0 | Add `role="img"` and descriptive `aria-label` |
| 13.3 | Inline styles used for chart tooltips -- no high-contrast support | P2 | Convert to Tailwind classes |

---

## 14. ReturnDecomposition.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 14.1 | Stacked bar chart has no text alternative | P0 | Add `role="img"` and `aria-label` describing the return decomposition |
| 14.2 | Color-only differentiation between yield, growth, and valuation return components | P2 | The legend provides text labels -- ensure legend is readable by screen readers |
| 14.3 | CustomTooltip is mouse-hover only | P1 | See Charts.tsx issue 2.3 |

---

## 15. RelativeValue.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 15.1 | Scatter chart has no text alternative | P0 | Add `role="img"` and `aria-label` describing the cap rate vs. growth scatter |
| 15.2 | Target REIT highlighted only by color (different fill) | P2 | Add a text label or different shape to distinguish the target |

---

## 16. NAVSensitivity.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 16.1 | Sensitivity table cells use color-only encoding | P2 | Add directional arrows or "+"/"-" text indicators |
| 16.2 | No `<caption>` on the sensitivity table | P1 | Add a visually-hidden caption describing the table purpose |

---

## 17. AnalystMemo.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 17.1 | "Generate Memo" button state change (loading spinner) not announced | P1 | Add `aria-busy="true"` during generation, and `aria-live="polite"` on the memo output container |
| 17.2 | Generated memo content has no `aria-label` identifying it as AI-generated | P1 | Add `role="article"` and `aria-label="AI-generated analyst memo"` |

---

## 18. AnalystPerspectives.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 18.1 | API key prompt uses `alert()` which blocks screen readers | P1 | Replace `alert()` with an inline message or modal with proper ARIA |
| 18.2 | Loading and error states not announced to screen readers | P1 | Add `aria-live="polite"` containers for status messages |
| 18.3 | Rating badges (Buy/Hold/Sell) use color-only indicators | P2 | Add text labels (already present) -- ensure sufficient color contrast |

---

## 19. ExpertKnowledge.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 19.1 | Tab navigation (`activeTab` state) uses buttons but no `role="tablist"` / `role="tab"` / `role="tabpanel"` | P0 | Implement the ARIA tabs pattern: `role="tablist"` on container, `role="tab"` with `aria-selected` on each tab button, `role="tabpanel"` with `aria-labelledby` on content panels |
| 19.2 | Sector selection buttons have no `aria-pressed` or `aria-selected` | P1 | Add `aria-pressed` for toggle buttons |
| 19.3 | Lucide icons used as the sole identifier for tabs | P1 | Ensure each tab has visible text label (already has text -- verify icon has `aria-hidden="true"`) |

---

## 20. DataGuide.tsx

| # | Issue | Priority | Fix |
|---|-------|----------|-----|
| 20.1 | `<code>` blocks inside `<pre>` have no `aria-label` or role | P2 | Add `role="code"` to code blocks (minor) |
| 20.2 | Section headings use `<h2>` correctly -- no issues | -- | No fix needed |
| 20.3 | List items use `<ul>` with `<li>` correctly -- no issues | -- | No fix needed |

---

## Summary of P0 Issues (Must Fix)

| # | Component | Issue |
|---|-----------|-------|
| 3.1 | InfoTooltip | Hover-only tooltip, completely inaccessible via keyboard |
| 5.1 | AuthModal | No Escape key handler to close modal |
| 5.2 | AuthModal | No focus trap -- Tab navigates behind modal |
| 7.1 | JustifiedPAFFO | Range inputs have no accessible labels |
| 8.2 | PortfolioManager | Weight allocation range inputs have no accessible labels |
| 2.1 | Charts | No `role="img"` or `aria-label` on chart containers |
| 6.2 | Valuation | DistributionScale visualization has no text alternative |
| 9.2 | Watchlist | Pie chart has no text alternative |
| 12.2 | SectorLens | Bar chart has no text alternative |
| 13.2 | Macro | Charts have no text alternatives |
| 14.1 | ReturnDecomposition | Stacked bar chart has no text alternative |
| 15.1 | RelativeValue | Scatter chart has no text alternative |
| 19.1 | ExpertKnowledge | Tab navigation lacks ARIA tabs pattern |

**Total P0 issues: 13**
**Total P1 issues: 27**
**Total P2 issues: 22**

---

## Recommended Fix Order

1. **InfoTooltip.tsx** (P0, 3.1) -- affects every component that uses it (Dashboard, Valuation, JustifiedPAFFO, Operations, BalanceSheet, SectorLens)
2. **AuthModal.tsx** (P0, 5.1 + 5.2) -- critical for authentication flow
3. **Charts.tsx** (P0, 2.1) -- affects Dashboard, Operations, BalanceSheet, Macro
4. **JustifiedPAFFO.tsx** range inputs (P0, 7.1) -- core institutional workflow
5. **ExpertKnowledge.tsx** tabs (P0, 19.1) -- broken tab pattern
6. **All remaining chart containers** -- add `role="img"` and `aria-label`
7. **All remaining P1 issues** in order of component usage frequency
