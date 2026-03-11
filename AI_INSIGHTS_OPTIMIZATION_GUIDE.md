# AI-Driven Research Features: Optimization Guide
## REITLens Strategic Terminal

---

## Executive Summary

This guide documents the optimization of REITLens AI research features to deliver **high-impact, actionable insights** with ruthless focus on "what matters most" to institutional REIT investors.

**Core Philosophy**: Signal over noise. Every insight must answer "So what?" and "What should I do with this?"

---

## 1. Optimized Gemini Prompts

### A. AnalystPerspectives.tsx - Street Research Aggregation

**Old Approach**: Generic request for analyst data
**New Approach**: Metric-driven, actionable synthesis with quantified insights

#### Key Improvements:
1. **Quantification Mandate**: Lead with numbers, not adjectives
2. **Comparative Context**: Every metric requires benchmark/historical comparison
3. **Forward-Looking Catalysts**: Focus on upcoming events that change the narrative
4. **Ruthless Prioritization**: Maximum 3-4 bull/bear points, each with >5% valuation impact
5. **Actionability**: Every insight informs a decision (priced-in expectations, variant perception, risk/reward)

#### Example Output Transformation:

**BEFORE** (Generic):
```
Bull Case:
- Strong occupancy trends
- Healthy dividend yield
- Good management team
```

**AFTER** (High-Impact):
```
Bull Case:
1. "Occupancy jumped 280bps to 96.8% (highest in 5 years), driven by supply-constrained sunbelt markets with 24-month lease duration runway providing SS-NOI visibility through 2026"
2. "5.2% dividend yield vs sector median 4.1%, covered at 75% AFFO payout (best-in-class coverage), implying 200bps distribution growth potential without leverage increase"
3. "$1.2B development pipeline delivering in Q3 2025 at 8.5% stabilized yield vs 6.2% portfolio cap rate = $24M annual NOI accretion (4.2% AFFO/share boost)"
```

#### Content Guidelines Enforced:
- **Banned Words**: "excellent", "impressive", "strong", "robust"
- **Required Format**: Number → Driver → Implication
- **Context Mandate**: Compare to sector median, historical trend, or peer average
- **Time Horizon**: Include forward catalysts with specific dates

---

### B. AnalystMemo.tsx - Investment Thesis Synthesis

**Old Approach**: Generic "variant perception memo"
**New Approach**: Answer 3 critical questions with surgical precision

#### The 3-Question Framework:
1. **What is the market pricing in RIGHT NOW?**
   - Use Gordon Growth Model: P = D / (r - g)
   - Reverse-engineer implied growth/cap rate from current price

2. **Where is your model materially different?**
   - Specific deltas: Market implies X%, model shows Y%
   - Operational drivers: Why is the market wrong?

3. **What's the so-what?**
   - Upside case: Quantify return potential
   - Downside risk: Structural vulnerabilities only
   - Actionable conclusion: One-sentence verdict

#### Improved Structure:

**I. Market Pricing Snapshot** (75 words)
- What growth/cap rate does current price imply?
- Gordon Growth framing: "At $52/share and 4.8% yield, market prices in 3.2% terminal growth"

**II. Variant Perception: Where We Differ** (100 words)
- Growth delta: "Market implies 3.2%, we model 5.5% driven by embedded rent growth from 2023-24 lease cohort"
- Cap rate delta: "Market prices 6.8% cap, comps suggest 6.2% justified by occupancy premium"
- Valuation gap: "Implies 18% upside to $61 fair value"

**III. Cash Flow Quality Check** (75 words)
- AFFO payout ratio with sustainability context
- SS-NOI trend (accelerating/decelerating)
- Maintenance capex vs depreciation (quality flag)

**IV. Key Structural Risks** (75 words)
- Red flags only: Debt maturity walls >20% EV, occupancy cliffs >500bps, development >30% NAV

**V. Bottom Line: Actionable Takeaway** (25 words)
- One-sentence verdict with risk/reward framing

#### Clinical Language Standards:
```
✗ "Strong cash flow growth trajectory"
✓ "AFFO/share growing 8.2% vs market-implied 4.5%"

✗ "High occupancy rates"
✓ "96.1% occupancy vs 10-year avg of 93.2%"

✗ "Well-covered dividend"
✓ "67% AFFO payout, 15% margin of safety vs 80% sector median"
```

---

## 2. Visual Presentation Enhancements

### Information Hierarchy: Above vs Below the Fold

#### ABOVE THE FOLD (First 2 screens):
**Objective**: Deliver 80% of the insight value in 20 seconds

1. **Hero Metrics Block**
   - Median Price Target (large, gold, centered)
   - Target Range visualization (gradient bar with median marker)
   - Rating Distribution (% bullish/neutral/bearish with progress bars)
   - Coverage Count (# of firms)

2. **Key Themes: Bull/Bear Cases**
   - Maximum 4 points each side
   - Numbered bullets with visual hierarchy
   - Metrics highlighted in the text
   - Source links visible on hover
   - Color-coded containers (emerald for bull, rose for bear)

3. **Quick Stats Grid**
   - Consensus strength indicator
   - Recent rating changes (upgrades/downgrades)
   - Median target vs current price (% upside/downside)

#### BELOW THE FOLD (Detailed View):
**Objective**: Source verification and deep dive for power users

1. **Detailed Firm Coverage Table**
   - Full sortable table of all ratings
   - Source links for each rating
   - Date sorting to see most recent
   - Color-coded rating badges

2. **Sector Experts Panel**
   - Analyst names and firms
   - Track record indicators (optional)
   - Consistency scoring (optional)

### Visual Components Implemented:

#### A. Price Target Range Visualization
```tsx
<div className="relative h-3 bg-obsidian/60 rounded-full overflow-hidden border border-rain/20">
  <div className="absolute h-full bg-gradient-to-r from-rose-500/20 via-gold/40 to-emerald-500/20" />
  <div className="absolute h-full w-1 bg-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]"
       style={{ left: `${((medianTarget - lowTarget) / (highTarget - lowTarget)) * 100}%` }} />
</div>
```
**Why it works**: Instantly shows target dispersion and consensus position

#### B. Rating Distribution Bars
```tsx
<div className="h-2 bg-obsidian/60 rounded-full overflow-hidden">
  <div className="h-full bg-emerald-500" style={{ width: `${bullishPct}%` }} />
</div>
```
**Why it works**: Visual consensus strength at a glance

#### C. Numbered Insight Cards
```tsx
<div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40">
  <span className="text-[10px] font-black text-emerald-400">{i + 1}</span>
</div>
```
**Why it works**: Creates scannable, prioritized list

---

## 3. Output Format Standards

### A. Metric Display Hierarchy

**Level 1: Primary Metrics** (Above the fold)
- Size: `text-3xl` (30px)
- Font: `mono` (JetBrains Mono for numbers)
- Color: `gold` for targets, `white` for counts
- Example: Median Price Target "$52.50"

**Level 2: Context Metrics** (Supporting data)
- Size: `text-xl` (20px)
- Font: `mono`
- Color: `white` with `rain` labels
- Example: "12 Firms" coverage count

**Level 3: Detail Metrics** (Table data)
- Size: `text-base` (16px) for targets, `text-[11px]` for text
- Font: Mixed (mono for numbers, sans for text)
- Color: Conditional (emerald/rose/slate based on rating)

### B. Text Formatting Standards

```typescript
// Insight Text
className="text-[12px] text-slate-200 leading-relaxed font-medium"

// Section Headers
className="text-sm font-black text-emerald-400 uppercase tracking-wider"

// Metadata/Labels
className="text-[10px] text-rain font-bold uppercase tracking-widest"

// Numbers in prose
<span className="text-gold font-bold mono">5.2%</span>
```

### C. Color Coding System

| Metric Type | Color | Usage |
|------------|-------|-------|
| Price Targets | `gold` (#D4AF37) | Median targets, valuation metrics |
| Bullish Signals | `emerald-400` | Bull case points, buy ratings |
| Bearish Signals | `rose-400` | Bear case points, sell ratings |
| Neutral/Data | `slate-400` | Hold ratings, metadata |
| Links/Actions | `lightBlue` (#48A3CC) | Source links, interactive elements |
| Labels | `rain` (#5F9AAE) | Section labels, muted text |

---

## 4. Information Density vs Readability Balance

### The 3-Second Rule
**Every card must communicate its core insight in 3 seconds of scanning**

#### Techniques:
1. **Visual Anchors**: Large numbers draw the eye first
2. **Proximity Grouping**: Related metrics physically close
3. **White Space**: 24-32px between major sections
4. **Typography Contrast**: 3 font sizes max per component
5. **Color Coding**: Consistent semantic meaning

### Optimal Density Matrix:

| Component | Text Density | Visual Density | Scan Time |
|-----------|-------------|----------------|-----------|
| Hero Metrics | Low (1-2 numbers) | High (charts) | 3 sec |
| Bull/Bear Cards | Medium (3-4 bullets) | Medium | 10 sec |
| Firm Table | High (10+ rows) | Low | 30 sec |

### Readability Checklist:
- ✅ Line height ≥ 1.5 for body text (class: `leading-relaxed`)
- ✅ Maximum line width 65 characters for prose
- ✅ Minimum font size 11px for readability
- ✅ High contrast text: white on dark, never gray on gray
- ✅ Grouped related info with borders/backgrounds
- ✅ Consistent spacing scale (4px base unit)

---

## 5. Scenario-Specific Examples

### Scenario A: Industrial REIT Growth Story (e.g., PLD, DRE)

**High-Impact Bullet Point Structure**:

```markdown
BULL CASE:
1. "E-commerce penetration driving 220bps annual SS-NOI growth to 5.8% (vs 3.5% sector avg), with embedded rent spreads of 35% on 2025-26 renewals providing 18-month visibility"

2. "$4.2B development pipeline (12% of GAV) delivering at 8.2% stabilized yields vs 5.8% in-place cap rate = $344M incremental NOI (9% AFFO/share accretion by 2027)"

3. "Net debt/EBITDA of 4.2x (best-in-class) enables $3B annual acquisition capacity at 50bps spread to WACC without equity dilution"

4. "Market prices in 4.5% terminal growth; our base case 6.2% SS-NOI + 2% external growth = 30% upside to $145 PT vs $112 current"

BEAR CASE:
1. "$8.5B debt maturity in 2026-27 (22% of EV) faces 175bps refinancing headwind = $149M AFFO drag (6% headwind to growth)"

2. "Supply pipeline of 450M SF (8% of U.S. stock) in top 6 markets risks 150-200bps cap rate expansion if absorption slows below 350M SF annually"

3. "72% rent mark-to-market implies margin compression post-2026 as renewals shift from 35% spreads to high-single-digit normalized levels"
```

**Why it works**:
- Leads with specific metrics (220bps, 5.8%, 35% spreads)
- Provides time horizons (18-month visibility, 2027 accretion)
- Quantifies implications ($344M NOI, 9% AFFO boost)
- Compares to benchmarks (vs sector avg, vs in-place cap rate)
- Identifies risks with magnitude ($149M drag, 22% of EV)

---

### Scenario B: Retail REIT Turnaround (e.g., REG, KIM)

**High-Impact Bullet Point Structure**:

```markdown
BULL CASE:
1. "Occupancy inflection: 93.2% → 95.8% in 12 months (260bps), fastest recovery in sector, driven by grocer-anchored necessity retail with 3-year avg tenant sales/SF of $425 (top quartile)"

2. "Lease spreads turned positive at +4.2% (from -2% trough), with $180M contractual rent step-ups through 2026 = 3.5% embedded SS-NOI floor before market rent growth"

3. "Disposition program: $900M non-core sales at 6.1% cap rate funding $1.1B acquisitions at 7.8% cap = 170bps spread = $19M annual NOI accretion (immediate)"

4. "Trading at 0.85x NAV ($32 vs $38 appraised) despite normalized 5% SS-NOI = 40% upside if multiple re-rates to peer avg 0.95x"

BEAR CASE:
1. "E-commerce risk: 18% of tenants are apparel/non-grocery retail (high disruption exposure), with $65M annual rent at risk if occupancy cost ratios breach 12% threshold"

2. "Rent recapture rate of 88% on renewals (below 95% sector norm) suggests 7% structural leakage = $40M annual NOI headwind vs embedded growth assumptions"

3. "$1.8B development pipeline (20% of GAV) at pre-leasing average of 67% creates 18-month delivery risk if anchor commitments slip"
```

**Why it works**:
- Turnaround narrative: Shows before/after (93.2% → 95.8%, -2% → +4.2%)
- De-risks thesis: Quantifies embedded contractual rent growth ($180M through 2026)
- Quantifies accretion: Specific cap rate spreads and NOI impact
- Identifies asymmetry: NAV discount with normalized growth assumption
- Structural risks: E-commerce exposure, rent recapture shortfall

---

### Scenario C: Office REIT Contrarian Play (e.g., BXP, VNO)

**High-Impact Bullet Point Structure**:

```markdown
BULL CASE:
1. "Flight-to-quality thesis: Class A Manhattan occupancy 94.2% vs Class B 78%, with $95/SF achieved rents vs $78/SF pre-COVID = 22% pricing power for prime assets"

2. "Lease expiration schedule: Only 8% rolling in 2025 (vs 15% sector avg), reducing near-term mark-to-market risk, while 2027+ cohort locked at $82/SF vs current $95/SF = 16% positive reversion"

3. "Trading at 0.62x NAV (largest discount in 15 years) implies 61% upside to $180 if cap rates stabilize at 5.8% (50bps above pre-COVID) vs 6.5% market-implied"

BEAR CASE:
1. "Structural vacancy risk: 850K SF lease expiration in 2026 with anchor tenant downsize optionality could trigger 480bps occupancy decline = $68M NOI loss (12% AFFO headwind)"

2. "Debt maturity wall: $4.2B due 2025-26 (35% of EV) at floating + 225bps vs legacy LIBOR + 125bps = $42M annual interest cost increase, compressing 5.8% div yield to 5.2%"

3. "Market prices 1.5% terminal growth; WFH adoption stabilized at 45% implies -1% to 0% SS-NOI structurally = dividend cut risk if coverage falls below 70% AFFO payout"

4. "Appraised NAV assumes 5.5% exit cap; comps trading at 6.2%-6.8% implies 11-19% NAV markdown risk = $18-$32/share downside to appraisal"
```

**Why it works**:
- Contrarian setup: Quantifies historical discount (0.62x NAV, largest in 15 years)
- Differentiates quality: Class A vs Class B performance gap
- Time-based catalyst: Lease expiration schedule creates visibility
- Downside case is honest: Structural WFH headwind, dividend risk
- Risk quantification: Specific NOI loss, AFFO impact, NAV markdown range

---

## 6. Chart & Visual Enhancement Recommendations

### A. Recommended New Charts for AnalystPerspectives

#### 1. **Price Target Distribution Histogram**
```tsx
// Visualize target clustering
<BarChart data={targetBuckets}>
  <Bar dataKey="count" fill="#D4AF37" />
  <XAxis dataKey="priceRange" label="Price Target Range" />
  <YAxis label="# of Analysts" />
</BarChart>
```
**Value**: Shows if consensus is tight (conviction) or dispersed (uncertainty)

#### 2. **Rating Change Timeline**
```tsx
// Show upgrade/downgrade momentum
<LineChart data={ratingHistory}>
  <Line dataKey="bullishPct" stroke="#10b981" />
  <Line dataKey="bearishPct" stroke="#f43f5e" />
  <XAxis dataKey="month" />
</LineChart>
```
**Value**: Identifies inflection points in sentiment

#### 3. **Consensus Strength Gauge**
```tsx
// Radial gauge showing conviction level
<div className="relative w-32 h-32">
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" stroke="#5F9AAE" strokeWidth="8" fill="none" opacity="0.2" />
    <circle cx="50" cy="50" r="40" stroke="#D4AF37" strokeWidth="8" fill="none"
            strokeDasharray={`${consensusStrength * 2.51} 251`}
            transform="rotate(-90 50 50)" />
  </svg>
  <div className="absolute inset-0 flex items-center justify-center">
    <span className="text-2xl font-black text-gold">{consensusStrength}%</span>
  </div>
</div>
```
**Value**: Single-metric summary of alignment

### B. Recommended Charts for AnalystMemo

#### 1. **Market Implied vs Modeled Growth Comparison**
```tsx
<BarChart data={[
  { scenario: 'Market Implied', growth: 3.2 },
  { scenario: 'Your Model', growth: 5.5 },
  { scenario: 'Bear Case', growth: 1.8 },
  { scenario: 'Bull Case', growth: 7.2 }
]}>
  <Bar dataKey="growth" fill={(entry) => entry.scenario.includes('Your') ? '#D4AF37' : '#48A3CC'} />
</BarChart>
```
**Value**: Visualizes the variant perception delta

#### 2. **AFFO Bridge Waterfall Chart**
```tsx
// Show components of growth from current to modeled AFFO
<ComposedChart data={affoBridge}>
  <Bar dataKey="value" fill={colorByCategory} />
  <Line dataKey="cumulative" stroke="#FF9D3C" />
</ComposedChart>
```
**Value**: Breaks down growth into SS-NOI, acquisitions, development, etc.

#### 3. **Risk/Reward Scatter Plot**
```tsx
<ScatterChart>
  <XAxis dataKey="impliedUpside" label="Upside %" />
  <YAxis dataKey="downside Risk" label="Downside Risk %" />
  <Scatter data={scenarios} fill="#D4AF37" />
  <ReferenceLine x={0} stroke="#5F9AAE" />
  <ReferenceLine y={0} stroke="#5F9AAE" />
</ScatterChart>
```
**Value**: Shows asymmetry (ideal: high upside, low downside)

---

## 7. Implementation Checklist

### Phase 1: Prompt Optimization (COMPLETED)
- [x] Update AnalystPerspectives prompt with metric-driven guidelines
- [x] Update AnalystMemo prompt with 3-question framework
- [x] Add quantification mandates to both prompts
- [x] Include comparative context requirements
- [x] Enforce clinical language standards

### Phase 2: Visual Enhancement (COMPLETED)
- [x] Add hero metrics block with large price target
- [x] Implement price target range visualization
- [x] Add rating distribution progress bars
- [x] Redesign bull/bear cases with numbered cards
- [x] Move detailed table below the fold
- [x] Add visual hierarchy with font sizes and colors

### Phase 3: Content Formatting (COMPLETED)
- [x] Standardize metric display hierarchy
- [x] Implement color coding system
- [x] Add source link hover states
- [x] Optimize spacing and readability
- [x] Add metadata badges (coverage count, verification status)

### Phase 4: Testing & Iteration (RECOMMENDED)
- [ ] Test with multiple REIT tickers across sectors
- [ ] Validate source URL quality from Gemini
- [ ] Measure user engagement (time on page, scroll depth)
- [ ] A/B test different bullet point formats
- [ ] Gather user feedback on insight actionability

### Phase 5: Future Enhancements (OPTIONAL)
- [ ] Add price target distribution histogram chart
- [ ] Implement rating change timeline
- [ ] Add consensus strength gauge
- [ ] Create AFFO bridge waterfall chart for memos
- [ ] Build risk/reward scatter plot visualization
- [ ] Add "Key Takeaways" summary card at top
- [ ] Implement analyst track record scoring
- [ ] Add email/export functionality for memos

---

## 8. Performance Metrics to Track

### Engagement Metrics:
- **Time to First Insight**: How quickly can user identify key thesis? Target: <10 seconds
- **Scroll Depth**: What % of users scroll below the fold? Target: >60% see details
- **Source Click Rate**: Are users verifying sources? Target: >25% click at least one
- **Return Rate**: Do users come back to re-read? High return = high value

### Quality Metrics:
- **Insight Density**: Average number of quantified metrics per bullet point (Target: ≥2)
- **Comparative Context**: % of statements with benchmarks (Target: 100%)
- **Actionability Score**: User survey: "Did this help you make a decision?" (Target: ≥4/5)
- **Source Quality**: % of AI-generated sources that are valid/accessible (Target: ≥90%)

### Technical Metrics:
- **Load Time**: Time to display first paint (Target: <2 sec)
- **API Response Time**: Gemini generation latency (Target: <15 sec)
- **Cache Hit Rate**: % of repeat queries served from cache (Target: ≥70%)
- **Error Rate**: % of API calls that fail or return invalid JSON (Target: <5%)

---

## 9. Best Practices Summary

### For Prompt Engineering:
1. **Be Specific**: Define exact output format with examples
2. **Quantify Requirements**: "3-4 bullet points", "300-400 words"
3. **Provide Context**: Give AI the "why" behind formatting rules
4. **Use Negative Examples**: Show what NOT to do
5. **Iterate**: Refine based on actual output quality

### For Visual Design:
1. **Hierarchy First**: Most important info largest/boldest
2. **Consistent Color Language**: Same color = same meaning
3. **White Space = Clarity**: Don't fear empty space
4. **Scannable Structure**: Numbers, bullets, short paragraphs
5. **Progressive Disclosure**: Summary → Details

### For Content Quality:
1. **Numbers Beat Adjectives**: "5.8%" > "strong"
2. **Context Is King**: Compare to something (peers, history, benchmarks)
3. **Forward-Looking**: Include time horizons and catalysts
4. **Honest Downside**: Credibility requires balanced risks
5. **Actionable Conclusion**: Answer "so what?" explicitly

---

## 10. Maintenance & Evolution

### Monthly Reviews:
- Audit 10 random AI-generated outputs for quality
- Check source URL validity (links not broken)
- Review user feedback/complaints
- Update prompt based on failure modes

### Quarterly Updates:
- Refresh prompt examples with current market themes
- Add new sectors/scenarios to example library
- Benchmark against competitor research quality
- A/B test new visual formats

### Annual Overhaul:
- Major prompt rewrite based on AI model improvements
- Redesign visual hierarchy based on usage data
- Add new chart types based on user requests
- Interview power users for feature prioritization

---

## Appendix: Prompt Templates

### Full AnalystPerspectives Prompt
```
You are a senior equity research analyst. Aggregate the most recent Wall Street research on [COMPANY] ([TICKER]) and distill it into HIGH-IMPACT, ACTIONABLE insights.

OBJECTIVE: Cut through noise. Focus on signal. Answer "so what?" for investors.

DATA REQUIREMENTS (Last 6 months):
- Analyst ratings & price targets from: Morgan Stanley, BMO, JP Morgan, Wells Fargo, Mizuho, RBC, Goldman Sachs, Citi, BofA
- CRITICAL: Every data point MUST include sourceUrl for verification

OUTPUT STRUCTURE (JSON):
{
  "ratings": [{ "firm": "string", "rating": "Buy|Hold|Sell|Overweight|Equalweight|Underweight", "target": "$XX.XX", "date": "MMM DD, YYYY", "sourceUrl": "https://..." }],
  "consensus": {
    "priceTargetMed": "$XX.XX",
    "bullCase": [
      { "text": "METRIC-DRIVEN INSIGHT: Lead with the number/metric, then the implication. Example: 'SS-NOI accelerating to 6.5% (vs sector avg 3.2%) driven by supply-constrained sunbelt markets with 24-month lease duration runway'", "sourceUrl": "https://..." }
    ],
    "bearCase": [
      { "text": "RISK-QUANTIFIED: Start with exposure/magnitude. Example: '$2.1B debt maturity wall in 2026 (18% of EV) faces 200bps higher refinancing costs, implying $42M annual AFFO headwind'", "sourceUrl": "https://..." }
    ],
    "sectorExperts": [{ "name": "Analyst Name", "firm": "Firm", "stance": "Bullish|Neutral|Bearish" }]
  }
}

CONTENT GUIDELINES:
1. QUANTIFY EVERYTHING: Replace adjectives with numbers
2. MAKE IT COMPARATIVE: Context = insight
3. FORWARD-LOOKING CATALYSTS: What changes the narrative?
4. RUTHLESS PRIORITIZATION: Only 3-4 bull points, 3-4 bear points
5. ACTIONABILITY: Every insight should inform a decision

TIME CONSTRAINT: Focus on research from the last 3-6 months.
```

### Full AnalystMemo Prompt
```
You are a Senior REIT Equity Analyst at a top-tier institutional fund. Write a CONCISE, HIGH-IMPACT "Investment Thesis Memo" for [COMPANY] ([TICKER]).

MARKET DATA (Terminal Clock):
- Current Price: $[X]
- Dividend Yield: [X]%
- Market Implied Cap Rate: [X]%
- Market Implied Growth: [X]%
- Your Modeled SS-NOI Growth: [X]%
- Risk-Free Rate: [X]%

YOUR MISSION: Answer 3 questions with surgical precision:
1. What is the market pricing in RIGHT NOW?
2. Where is your model materially different (the "variant perception")?
3. What's the so-what (upside case, downside risk, actionable conclusion)?

WRITING RULES:
✓ QUANTIFY: Lead with numbers, not adjectives
✓ COMPARE: Every metric needs context
✓ BE CLINICAL: Zero marketing language
✓ FOCUS ON DELTA: What's different between your view and the market's?
✓ STRUCTURAL RISKS ONLY: Skip macro hand-wringing

OUTPUT STRUCTURE (300-400 words):
I. Market Pricing Snapshot
II. Variant Perception: Where We Differ
III. Cash Flow Quality Check
IV. Key Structural Risks (Red Flags Only)
V. Bottom Line: Actionable Takeaway

LENGTH: 300-400 words. Ruthlessly concise.
```

---

**Document Version**: 1.0
**Last Updated**: 2025-02-21
**Author**: Claude Sonnet 4.5 (REIT Analysis Specialist)
