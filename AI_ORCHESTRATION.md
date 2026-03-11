# REIT Lens: AI Orchestration (The "Analyst Brain")

This document defines how Gemini 3 Flash is used to transform quantitative data into institutional-grade qualitative research.

## 1. The "Analyst Memo" Protocol
The AI acts as a Senior REIT Analyst synthesizing the output of our financial models.

### Input Data
*   **Quantitative:** Justified P/AFFO, Implied g, Debt Maturity Wall, SS-NOI trends.
*   **Contextual:** Ticker, Sector, Current Market Price, 10-Year Historical Medians.
*   **External:** Latest news and analyst ratings via Google Search Grounding.

### Synthesis Logic
1.  **Identify the Delta:** Compare the "Justified Value" (Independent) vs. "Market Price" (Expectations).
2.  **Stress Test:** Evaluate if the "Market Implied g" is realistic relative to the sector's 5-year historical median.
3.  **Risk Assessment:** Flag any "Debt Maturity Walls" occurring in high-rate environments.
4.  **The Verdict:** Provide a "Variant Perception" summary—why is the market wrong (or right)?

---

## 2. Tooling & Grounding

### Google Search Grounding
*   **Usage:** Fetching real-time analyst price targets and recent earnings call transcripts.
*   **Goal:** Corroborate the "Expert Consensus" module and provide "Bull vs. Bear" cases.

### URL Context
*   **Usage:** Reading specific 10-K/10-Q filings to extract "Same-Store" metrics that aren't available in standard XBRL feeds.

---

## 3. Prompt Engineering Principles
*   **No Hyperbole:** The AI must use professional, measured language (e.g., "The valuation appears stretched relative to historical spreads" rather than "The stock is a bubble").
*   **Data-First:** Every qualitative claim must be backed by a quantitative metric from the model.
*   **Contrarian Bias:** The AI is encouraged to look for "Value Traps" where high yields mask secular declines.
