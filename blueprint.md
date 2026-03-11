# REIT Lens: Strategic Terminal Blueprint

## 1. Vision & Executive Summary: Expectations Investing
REIT Lens is a high-fidelity, institutional-grade analytical terminal designed for the sophisticated REIT researcher. The core philosophy is **Expectations Investing**:

*   **Screen for Oddities:** Identify tickers where the market price implies extreme outcomes (99th percentile or 1st percentile growth).
*   **Determine Market Pricing:** Reverse-engineer the current share price to solve for the "Implied Growth" or "Implied Cap Rate."
*   **Independent Rationalization:** Allow analysts to overlay their own independent assumptions (Sustainable g, WACC) to determine "Justified Value" vs. "Market Value."
*   **Variant Perception:** Highlight the delta between independent operational reality and the prevailing street narrative.

**The Product Mission:** To provide a rational, independent viewpoint on relative value by identifying when expectations have decoupled from operational fundamentals.

---

## 2. User Workflows: The "Zoom-In" Architecture
The application is designed to start with a broad macro/sector view and incrementally offer opportunities to "zoom in" on specific operational details.

1.  **Macro/Sector Level (The Wide Lens):**
    *   Assess the yield curve, inflation, and sector-wide cap rate trends.
    *   Identify sectors that are fundamentally mispriced relative to their historical spreads.
2.  **Watchlist/Screening (The Filter):**
    *   Identify "oddities" (e.g., REITs trading at significant discounts to NAV or with outlier multiples).
    *   Compare relative value across a peer group.
3.  **Ticker Deep-Dive (The Microscope):**
    *   **Dashboard:** High-level health check (FFO trends, Leverage, Dividend Safety).
    *   **Valuation:** The "Expectations" bridge (Justified P/AFFO vs. Market P/AFFO).
    *   **Operations:** Granular property-level metrics (SS-NOI, Occupancy, Leasing Spreads).
    *   **Balance Sheet:** Debt maturity walls and capital stack topology.
4.  **Analyst Synthesis (The Verdict):**
    *   **Analyst Memo:** AI-assisted synthesis of the quantitative model into a qualitative thesis.

---

## 3. Technical Constraints & Performance Targets

### State Management Stance
*   **Lifting State:** Prefer lifting state to the nearest common ancestor (e.g., `App.tsx`) for critical global variables like `selectedTicker` or `strategicModel`.
*   **Context API:** Use React Context for "Static-ish" global data (e.g., Theme, User Preferences, or cached Sector Averages) to avoid prop-drilling.
*   **Local State:** Keep UI-only state (e.g., "isModalOpen", "activeTab") local to the component.

### Performance Budget
*   **D3/Recharts:** Optimize heavy renders by memoizing data transformations. Avoid re-calculating complex IRR bridges on every keystroke; use `useMemo`.
*   **Data Fetching:** Implement a "Stale-While-Revalidate" pattern for SEC data. Cache normalized results in `localStorage` or a client-side store to minimize redundant API calls.

---

## 4. Feature Roadmap
- **NAVSensitivity:** Real-time matrixing of theoretical share prices based on Cap Rate vs. NOI sensitivity.
- **AnalystMemo (AI):** Using Gemini 3 Flash to synthesize quantitative models into objective research notes.
- **PerspectiveEngine:** Automatic corroborated expert analysis from search grounding.
- **RelativeValue:** Dynamic scatter plots comparing Implied g vs. Dividend Yield across sectors.

