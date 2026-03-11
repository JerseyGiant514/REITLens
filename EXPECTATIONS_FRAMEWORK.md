# REIT Lens: Expectations Framework (The Percentile Logic)

This document defines the logic for identifying "Oddities" and distinguishing "Cheap" from "Value Traps."

## 1. Historical Lookbacks & Benchmarking
To determine if a valuation is an outlier, we compare current metrics against four lookback periods:
*   **1-Year:** Recent momentum and post-rate-hike normalization.
*   **3-Year:** Post-pandemic structural shifts.
*   **5-Year:** Mid-cycle baseline.
*   **10-Year:** Full-cycle "Through-the-Cycle" median.

---

## 2. The "Implied g" Percentile Test
We calculate the **Market Implied g** and map it against the ticker's historical growth distribution.

| Percentile | Interpretation | Action |
| :--- | :--- | :--- |
| **> 90th** | "Priced for Perfection" | High risk of disappointment; likely overvalued. |
| **40th - 60th** | "Fairly Valued" | Market expectations align with historical reality. |
| **< 10th** | "Priced for Disaster" | Potential opportunity; market expects secular decline. |

---

## 3. Cheap vs. Value Trap (The Decision Matrix)

A REIT is **Cheap** if:
1.  **Implied g < Historical Median g** (10-year lookback).
2.  **Relative Value:** Trading at a wider spread to the 10Y Treasury than its 5-year average.
3.  **Operational Confirmation:** SS-NOI growth remains positive and industry forward growth expectations are stable.

A REIT is a **Value Trap** if:
1.  **Implied g is low**, BUT there is a **Secular Decline Cause** (e.g., Office occupancy structural collapse).
2.  **Maturity Wall Risk:** Significant debt maturing in < 24 months with no clear path to refinancing at accretive rates.
3.  **Dividend at Risk:** AFFO Payout Ratio > 95%.

---

## 4. "This Time is Different" Check
Before flagging a ticker as "Cheap," the system checks for:
*   **Forward Industry Growth:** Are sector-wide expectations trending down?
*   **Comps:** Is the entire peer group trading at these levels, or is this ticker an idiosyncratic outlier?
*   **Confirmation:** Use Gemini 3 Flash to scan recent news for "Major Secular Headwinds" (e.g., regulatory changes, supply gluts).
