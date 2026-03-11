import React, { useState } from 'react';
import { StrategicModelState } from '../App';
import { REITS } from '../services/mockData';
import { getFinancials, getKPIs, getMarketData } from '../services/dataService';
import { FinancialsQuarterly } from '../types';

interface AnalystMemoProps {
  ticker: string;
  model: StrategicModelState;
  liveFinancials?: FinancialsQuarterly[];
}

const AnalystMemo: React.FC<AnalystMemoProps> = ({ ticker, model, liveFinancials }) => {
  const [memo, setMemo] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMemo = async () => {
    setIsGenerating(true);
    setMemo("");

    try {
      const reit = REITS.find(r => r.ticker === ticker)!;
      const fin = getFinancials(reit.id, liveFinancials);
      const kpis = getKPIs(reit.id, liveFinancials);
      const mktData = await getMarketData(reit.id, !!liveFinancials);
      const mkt = mktData[0];

      const latestFin = fin[fin.length - 1];
      const latestKPI = kpis[kpis.length - 1];

      // Institutional Discount Rate Calculation for the prompt
      const costOfEquity = model.wacc.rf + (model.wacc.beta * model.wacc.erp);
      // Gordon Growth Model: g = k - (D/P), adjusted for payout ratio
      // Higher retention (lower payout) means more reinvestment -> higher sustainable g
      const payoutRatio = model.wacc.payout / 100;
      const marketImpliedG = costOfEquity - (mkt.dividendYield / payoutRatio);

      // Build the prompt
      const prompt = `
You are a Senior REIT Equity Analyst at a top-tier institutional fund. Write a CONCISE, HIGH-IMPACT "Investment Thesis Memo" for ${reit.name} (${reit.ticker}).

MARKET DATA (Terminal Clock):
- Current Price: $${mkt.closePrice.toFixed(2)}
- Dividend Yield: ${mkt.dividendYield.toFixed(2)}%
- Market Implied Cap Rate: ${((latestFin.noi * 4) / (mkt.marketCap + latestFin.totalDebt) * 100).toFixed(2)}%
- Market Implied Growth: ${marketImpliedG.toFixed(2)}%
- Your Modeled SS-NOI Growth: ${model.growth.ss.toFixed(2)}%
- Risk-Free Rate: ${model.wacc.rf.toFixed(2)}%

YOUR MISSION: Answer 3 questions with surgical precision:
1. What is the market pricing in RIGHT NOW?
2. Where is your model materially different (the "variant perception")?
3. What's the so-what (upside case, downside risk, actionable conclusion)?

WRITING RULES:
✓ QUANTIFY: Lead with numbers, not adjectives
  - Bad: "Strong cash flow growth"
  - Good: "AFFO/share growing 8.2% vs market-implied 4.5%"

✓ COMPARE: Every metric needs context
  - Bad: "High occupancy"
  - Good: "96.1% occupancy vs 10-year avg of 93.2%"

✓ BE CLINICAL: Zero marketing language. Objective tone only.
  - Banned words: "excellent", "impressive", "strong", "robust"
  - Use instead: "above median", "top quartile", "superior to historical trend"

✓ FOCUS ON DELTA: What's different between your view and the market's?
  - "Market prices in ${marketImpliedG.toFixed(2)}% terminal growth. Our model assumes ${model.growth.ss.toFixed(2)}% SS-NOI growth, implying XX% upside if fundamentals hold."

✓ STRUCTURAL RISKS ONLY: Skip macro hand-wringing
  - Include: Debt maturity walls, occupancy cliff risks, specific lease expiration concentrations
  - Exclude: "Rising rates", "recession fears", generic sector headwinds

OUTPUT STRUCTURE (300-400 words):

**I. Market Pricing Snapshot**
What growth, cap rate, or multiple is the current price implying? Use Gordon Growth Model framing: P = D / (r - g). Reverse-engineer what the market believes.

**II. Variant Perception: Where We Differ**
Specific deltas between your model and market pricing:
- Growth: Market implies X%, we model Y% because [operational driver]
- Cap Rate: Market prices Z% cap, we see A% justified by [comp/spread analysis]
- Valuation Gap: Quantify the upside/downside in $ terms or % return

**III. Cash Flow Quality Check**
- AFFO payout ratio: ${latestKPI.payoutAffo.toFixed(1)}% (context: sustainable if <80%)
- SS-NOI growth trend: ${latestKPI.sameStoreNOIGrowth.toFixed(2)}% (accelerating/decelerating?)
- Maintenance capex vs depreciation: Flag if capex >1.2x depreciation (quality issue)

**IV. Key Structural Risks (Red Flags Only)**
- Debt: Any maturity wall >20% of EV in next 24 months?
- Occupancy: Any >500bps decline risk from lease rollovers?
- Development: Any projects >30% of NAV under construction?

**V. Bottom Line: Actionable Takeaway**
One-sentence verdict. Example: "Undervalued on ${marketImpliedG.toFixed(2)}% implied growth vs our ${model.growth.ss.toFixed(2)}% base case; upside if fundamentals reaccelerate, but debt refinancing in 2026 caps near-term return."

LENGTH: 300-400 words. Ruthlessly concise.
        `;

      // Call Gemini via server-side Edge Function (API key never leaves server)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/gemini-proxy`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          prompt,
          model: 'gemini-2.0-flash-exp',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Edge Function returned ${response.status}`);
      }

      const result = await response.json();
      setMemo(result.text || "Synthesis failed.");
    } catch (e) {
      setMemo("Error: Terminal-to-Gemini link interrupted. Verify API key and connectivity.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 max-w-4xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-noe text-2xl text-white uppercase tracking-tight">Variant Perception Memo</h2>
          <p className="text-[10px] text-rain font-bold uppercase tracking-[0.3em] mt-2">Objective Multi-Factor Research Synthesis</p>
        </div>
        <button
          onClick={generateMemo}
          disabled={isGenerating}
          className="px-8 py-3 bg-pumpkin text-white text-[10px] font-black uppercase tracking-widest rounded hover:brightness-110 transition-all shadow-xl disabled:opacity-50"
        >
          {isGenerating ? 'Synthesizing Factors...' : 'Run Objective Synthesis'}
        </button>
      </header>

      {isGenerating ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="w-12 h-12 border-4 border-pumpkin border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#FF9D3C]"></div>
          <span className="text-[10px] font-black text-rain uppercase tracking-[0.5em] animate-pulse">Computing Market Deltas...</span>
        </div>
      ) : memo ? (
        <div className="aegis-card p-12 bg-darkBlue/20 border-rain/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-32 h-32 text-gold" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" /></svg>
          </div>
          <div className="prose prose-invert max-w-none text-slate-300 font-primary leading-relaxed whitespace-pre-wrap text-[13px]">
            {memo}
          </div>
          <div className="mt-12 pt-8 border-t border-rain/10 flex justify-between items-center italic text-rain/40 text-[10px] font-bold uppercase tracking-widest">
            <span>Terminal Fact Protocol v1.2</span>
            <span>Zero-Bias Narrative Constraint: Enabled</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-32 bg-darkBlue/10 border border-dashed border-rain/20 rounded-xl">
          <span className="text-xs font-bold text-rain/40 uppercase tracking-[0.4em]">Awaiting Model Selection</span>
        </div>
      )}
    </div>
  );
};

export default AnalystMemo;