# REIT Lens: Financial Engine & Formulas

This document defines the mathematical logic used to drive the analytical engine. All formulas are designed to comport with institutional REIT research standards (e.g., Green Street, KeyBanc, Morgan Stanley).

## 1. Valuation Multiples

### A. Justified P/AFFO Multiple
The "Fair Value" multiple based on fundamental growth and risk.
*   **Formula:** `Justified_Multiple = (Payout_Ratio * (1 + g)) / (WACC - g)`
*   **Variables:**
    *   `Payout_Ratio`: Dividend as % of AFFO.
    *   `WACC`: Weighted Average Cost of Capital.
    *   `g`: Sustainable long-term growth rate.

### B. Implied Growth (g)
Solving for the growth rate the market is currently "pricing in."
*   **Formula:** `Implied_g = (WACC - (Payout_Ratio / Market_Multiple)) / (1 + (Payout_Ratio / Market_Multiple))`
*   **Logic:** If `Implied_g > Sustainable_g`, the stock is likely overvalued (pricing in 99th percentile growth).

---

## 2. The Growth Engine (Sustainable g)

REIT growth is decomposed into organic and inorganic components.
*   **Formula:** `Sustainable_g = Organic_Growth + Inorganic_Growth - Capital_Leakage`

### A. Organic Growth
*   **Formula:** `SS_NOI_Growth * (1 - Operating_Leverage_Drag)`
*   **REIT Nuance:** Driven by contractual rent bumps, mark-to-market on expirations, and occupancy gains.

### B. Inorganic Growth (Accretion)
*   **Formula:** `(Acquisition_Volume * Spread) + (Development_Deliveries * Yield_Spread)`
*   **Spread:** `Asset_Yield - Cost_of_Capital`.

### C. Capital Leakage
*   **Formula:** `Maintenance_Capex + Leasing_Commissions + Tenant_Improvements`
*   **Logic:** Expressed as a % of NOI or a drag on the total growth rate.

---

## 3. Cost of Capital (WACC)

### A. Cost of Equity (CAPM)
*   **Formula:** `Re = Rf + (Beta * ERP)`
*   **Rf (Risk-Free Rate):** Typically the 10-Year Treasury Yield.
*   **ERP (Equity Risk Premium):** Standard institutional assumption is 5.0% - 6.0%.

### B. Cost of Debt
*   **Formula:** `Rd = (Rf + Credit_Spread) * (1 - Tax_Rate)`
*   **REIT Nuance:** Since REITs pay no corporate tax if they distribute 90% of income, the `Tax_Rate` is effectively 0% for the entity.

---

## 4. Net Asset Value (NAV)

### A. Nominal NAV
*   **Formula:** `(Forward_NOI / Market_Cap_Rate) - Total_Debt + Cash`

### B. Implied Cap Rate
*   **Formula:** `Implied_Cap_Rate = Forward_NOI / (Enterprise_Value)`
*   **Enterprise Value:** `Market_Cap + Total_Debt - Cash`.

---

## 5. Institutional Payout & Cash Flow Logic

### A. The "Earnings" Fallacy
In REIT analysis, GAAP **Net Income** is considered a secondary (and often misleading) metric. Because real estate is a depreciable asset for tax purposes but generally appreciates or maintains value in economic reality, GAAP depreciation artificially suppresses earnings.
*   **Institutional Standard:** Payout ratios MUST be calculated as a **% of AFFO** (Adjusted Funds From Operations) or **% of FAD** (Funds Available for Distribution).
*   **Formula:** `Payout_Ratio = Dividends_Paid / AFFO`
*   **Academic/Industry Cross-Ref:** NAREIT (National Association of Real Estate Investment Trusts) defines FFO to exclude depreciation; institutional firms (Green Street, ISI) further adjust to AFFO by subtracting recurring CapEx to reach "true" economic cash flow.

### B. Additional Institutional Nuances
1.  **Cash NOI vs. GAAP NOI:** Strip out "Straight-line Rent" (non-cash accounting adjustments for future rent bumps) to understand the actual cash hitting the ledger today.
2.  **Maintenance vs. Growth CapEx:** Recurring CapEx (roofs, parking lots, TIs for renewals) is a cost of doing business and must be deducted from FFO. Growth CapEx (expansions, new developments) is an investment and is capitalized.
3.  **G&A Efficiency:** Measure G&A as a **% of GAV (Gross Asset Value)**. This reveals the efficiency of the management platform relative to the scale of the assets managed, independent of market fluctuations in share price.
4.  **EBITDAre:** Use the NAREIT-defined "EBITDA for Real Estate" which adds back gains/losses on property sales to ensure a "clean" operational cash flow metric for leverage analysis (Net Debt / EBITDAre).

---

## 6. Sector-Specific Nuances

| Sector | Key Nuance | Formula Adjustment |
| :--- | :--- | :--- |
| **Industrial** | High Mark-to-Market (MTM) | `Organic_g` heavily weighted by `(Current_Rent / Market_Rent)`. |
| **Residential** | High Turnover / Low Capex | `Leakage` is lower; `SS_NOI` is more sensitive to 30-day lease cycles. |
| **Office** | High TI/LC Leakage | `AFFO` significantly lower than `FFO` due to heavy re-tenanting costs. |
| **Retail** | Anchor vs. Inline | `Inorganic_g` driven by "re-tenanting" spreads rather than new acquisitions. |
| **SFR** | Bad Debt & Turnover | `Organic_g` sensitive to property tax resets and local market HPI. |
