# REIT Lens: Data Strategy & Lineage

This document outlines how we move from "Mock" to "Real" data and how we normalize SEC filings for institutional analysis.

## 1. The Medallion Architecture

### Bronze Layer (Raw)
*   **Source:** SEC EDGAR (Company Facts API), Google Search Grounding (for Analyst Ratings).
*   **Format:** Raw JSON.
*   **Storage:** In-memory or local cache.

### Silver Layer (Normalized)
*   **Logic:** Mapping XBRL tags to internal financial concepts.
*   **Key Mappings:**
    *   `NetIncomeLoss` -> `Net Income`
    *   `NetCashProvidedByUsedInOperatingActivities` -> `CFO`
    *   `CommonStockDividendsPerShareDeclared` -> `DPS`
*   **REIT Specifics:** Handling `FundsFromOperations` (FFO) which is often buried in "Non-GAAP" disclosures or requires manual reconstruction from Net Income + Depreciation.

### Gold Layer (Analytical)
*   **Logic:** Applying the formulas defined in `FORMULAS.md`.
*   **Outputs:** Justified Multiples, Implied Cap Rates, 3-Year IRR Bridges.

---

## 2. Real-Data Integration Plan

### Current Status
*   We use `mockData.ts` for the majority of the UI.
*   `dataService.ts` has a skeleton `fetchSECData` function.

### Transition Strategy
1.  **Hybrid Mode:** If `isLiveMode` is true, the app attempts to fetch SEC data. If it fails or tags are missing, it falls back to "Smart Mocks" (mocks that are scaled to the real market cap of the ticker).
2.  **Tag Enrichment:** Use Gemini 3 Flash to "read" the latest 10-K/10-Q via `urlContext` to extract non-XBRL data (like "Same-Store NOI Growth" or "Debt Maturity Schedules") that the SEC API often misses.
3.  **Analyst Ratings:** Use Google Search Grounding to fetch the latest consensus price targets and ratings, then normalize them into our "Expert Consensus" module.

---

## 3. Data Integrity Rules
*   **No Stale Data:** Any analyst rating older than 180 days is flagged as "Stale."
*   **Checksums:** If `Total_Assets != Total_Liabilities + Equity`, flag the "Balance Sheet" view as "Unverified."
*   **Source Attribution:** Every metric in the "Deep Dive" should have a hover-state showing its source (e.g., "Source: SEC 10-K, Item 7").

---

## 4. Handling SEC Oddities
*   **CIK Mapping:** We maintain a mapping of Ticker -> CIK in `mockData.ts`.
*   **Unit Conversion:** SEC data is often in absolute dollars; we must convert to "Per Share" using `EntityCommonStockSharesOutstanding`.
