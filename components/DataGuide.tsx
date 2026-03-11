
import React from 'react';

const DataGuide: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-32 animate-in fade-in duration-700">
      <header className="border-b border-rain/20 pb-10">
        <div className="flex items-center gap-3 mb-6">
           <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded text-[10px] font-black uppercase tracking-[0.2em]">v2.2 Handoff Spec</span>
           <span className="bg-gold/10 text-gold border border-gold/20 px-3 py-1 rounded text-[10px] font-black uppercase tracking-[0.2em]">Institutional Grade</span>
        </div>
        <h1 className="header-noe text-4xl text-white tracking-tight">Backend Engineering & Data Specification</h1>
        <p className="mt-4 text-rain text-lg font-medium leading-relaxed">
          This document serves as the implementation guide for transitioning the REIT Lens frontend to a production-grade BigQuery data warehouse, including new modules for Street Consensus and Expert Perspectives.
        </p>
      </header>

      {/* 1. INSTITUTIONAL SOURCE MAP */}
      <section className="space-y-6">
        <h2 className="header-institutional text-xl font-black text-white border-l-4 border-lightBlue pl-6 uppercase tracking-widest">1. Institutional Source Map</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="aegis-card p-6 border-slate-800">
            <h3 className="text-[10px] font-black text-lightBlue mb-3 uppercase tracking-widest">Core Fact Providers</h3>
            <ul className="text-xs text-slate-400 space-y-2 list-disc ml-4">
              <li><strong>SEC EDGAR (CIK Data):</strong> Primary source for GAAP facts. Use <code>companyfacts</code> endpoint.</li>
              <li><strong>FRED (St. Louis Fed API):</strong> Source for 10Y Yields, HY Spreads, and CPI benchmarks.</li>
              <li><strong>Nasdaq/IEX Cloud:</strong> Real-time and historical price/volume feeds for market cap computation.</li>
            </ul>
          </div>
          <div className="aegis-card p-6 border-slate-800">
            <h3 className="text-[10px] font-black text-gold mb-3 uppercase tracking-widest">Street Consensus Targets</h3>
            <p className="text-[10px] text-rain/60 mb-3 uppercase font-bold tracking-widest">Priority Ingestion Targets:</p>
            <ul className="text-xs text-slate-400 space-y-2 list-disc ml-4">
              <li><strong>StreetInsider / MarketBeat:</strong> Best for rapid indexing of new analyst ratings and target changes.</li>
              <li><strong>Seeking Alpha (Analysis Tab):</strong> Aggregates "Quant" vs. "Wall St" vs. "SA Authors" ratings.</li>
              <li><strong>TipRanks API:</strong> Institutional-grade consensus data and price target distributions.</li>
              <li><strong>Bloomberg/Reuters RSS:</strong> For corroborating qualitative bull/bear narratives and expert identification.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 2. UPDATED LOGICAL DATA MODEL */}
      <section className="space-y-6">
        <h2 className="header-institutional text-xl font-black text-white border-l-4 border-lightBlue pl-6 uppercase tracking-widest">2. Logical Data Model (DDL)</h2>
        <div className="bg-black/60 rounded-lg p-6 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre border border-white/5 shadow-2xl">
{`-- New: Analyst Perspective Tracking with Lineage
CREATE TABLE reit_lens.fact_analyst_ratings (
  rating_id STRING,        -- UUID
  ticker STRING,           -- 'PLD', 'O'
  firm_name STRING,        -- 'Morgan Stanley', 'BMO Capital'
  analyst_name STRING,     -- 'Richard Hill'
  rating_status STRING,    -- 'Overweight', 'Equalweight', 'Underweight'
  price_target FLOAT64,    -- Target Price
  rating_date DATE,        -- Effective date of change
  source_url STRING,       -- Corroboration Link
  summary_text STRING      -- One-sentence bull/bear takeaway
);

-- Gold View: Street Consensus Aggregator
CREATE VIEW reit_lens.v_street_consensus AS
SELECT 
  ticker,
  PERCENTILE_CONT(price_target, 0.5) OVER(PARTITION BY ticker) AS med_price_target,
  COUNT(CASE WHEN rating_status IN ('Overweight', 'Buy') THEN 1 END) AS buy_count,
  COUNT(CASE WHEN rating_status IN ('Underweight', 'Sell') THEN 1 END) AS sell_count,
  COUNT(*) AS total_coverage
FROM reit_lens.fact_analyst_ratings
WHERE rating_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH);`}
        </div>
      </section>

      {/* 3. PROXY & VARIANT PERCEPTION LOGIC */}
      <section className="space-y-6">
        <h2 className="header-institutional text-xl font-black text-white border-l-4 border-lightBlue pl-6 uppercase tracking-widest">3. Variant Perception (The Delta Engine)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aegis-card p-8 bg-darkBlue/20">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">Pricing-In Implied g</h3>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              Backend calculates <code>Market_Implied_g = Cost_of_Equity - Dividend_Yield</code>. 
              The frontend then compares this to the User's <strong>Sustainable g</strong> to highlight overvaluation vs. undervaluation traps.
            </p>
          </div>
          <div className="aegis-card p-8 bg-darkBlue/20">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">Expert Identification</h3>
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "Sector Experts" are identified via coverage longevity. Analysts with &gt;8 quarters of continuous coverage on a specific ticker are flagged in the UI to weight their perspectives over generalists.
            </p>
          </div>
        </div>
      </section>

      {/* 4. RECENT DATA ENFORCEMENT */}
      <section className="bg-rose-500/5 border border-rose-500/20 p-10 rounded-2xl relative overflow-hidden">
        <h2 className="header-institutional text-lg font-black text-rose-400 mb-6 uppercase tracking-widest">4. Data Freshness Checksum</h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[11px] text-slate-400 font-medium leading-relaxed">
          <li className="flex gap-3">
            <span className="text-rose-500 font-black">QC-STREET</span>
            <span>Any analyst rating older than 180 days must be filtered from "Active Consensus" to avoid stale knowledge cutoff biases.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-rose-500 font-black">QC-DELTA</span>
            <span>Flag tickers where <code>abs(Justified_PAFFO - Market_Multiple) &gt; 5.0x</code>. This indicates a profound disconnect between street narrative and operational reality.</span>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default DataGuide;
