
import React, { useState, useEffect } from 'react';
import { REITS } from '../services/mockData';

interface AnalystRating {
  firm: string;
  rating: 'Overweight' | 'Equalweight' | 'Underweight' | 'Buy' | 'Hold' | 'Sell';
  target: string;
  date: string;
  sourceUrl?: string;
}

interface AnalystConsensus {
  bullCase: { text: string; sourceUrl?: string }[];
  bearCase: { text: string; sourceUrl?: string }[];
  sectorExperts: { name: string; firm: string; stance: string }[];
  priceTargetMed: string;
}

const AnalystPerspectives: React.FC<{ ticker: string }> = ({ ticker }) => {
  const [data, setData] = useState<{ ratings: AnalystRating[]; consensus: AnalystConsensus } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [cache, setCache] = useState<Record<string, { data: any; timestamp: number }>>({});
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

  useEffect(() => {
    const checkKey = async () => {
      // Check if Supabase is configured (Edge Function handles the API key server-side)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      setHasKey(!!(supabaseUrl && supabaseAnonKey));
    };
    checkKey();
  }, []);

  const handleOpenKey = async () => {
    // Edge Function handles the API key server-side.
    // User needs to configure Supabase env vars and deploy the gemini-proxy function.
    alert(
      'To enable AI-powered analyst perspectives:\n\n' +
      '1. Set GEMINI_API_KEY as a secret in your Supabase Edge Functions\n' +
      '2. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are in your .env\n' +
      '3. Deploy the gemini-proxy Edge Function\n\n' +
      'See SECURITY.md for detailed instructions.'
    );
  };

  useEffect(() => {
    let cancelled = false;

    const fetchPerspectives = async () => {
      if (!hasKey) return;

      // Check cache first
      const cached = cache[ticker];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setData(cached.data);
        setLoading(false);
        setSlowLoading(false);
        return;
      }

      setLoading(true);
      setSlowLoading(false);
      setError(null); // Clear previous errors
      try {
        const reit = REITS.find(r => r.ticker === ticker)!;

        const prompt = `You are a senior equity research analyst. Aggregate the most recent Wall Street research on ${reit.name} (${ticker}) and distill it into HIGH-IMPACT, ACTIONABLE insights.

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
   - Bad: "Strong occupancy trends"
   - Good: "Occupancy jumped 280bps to 96.8%, highest in 5 years"

2. MAKE IT COMPARATIVE: Context = insight
   - Bad: "Healthy dividend yield"
   - Good: "5.2% yield vs sector median 4.1%, covered at 75% payout (best-in-class coverage)"

3. FORWARD-LOOKING CATALYSTS: What changes the narrative?
   - Include: Upcoming lease renewals, development deliveries, debt refinancing dates, same-store portfolio transitions

4. RUTHLESS PRIORITIZATION: Only 3-4 bull points, 3-4 bear points
   - Each point must be material (>5% impact on valuation or major structural theme)

5. ACTIONABILITY: Every insight should inform a decision
   - What's priced in? What's the variant perception? What's the risk/reward asymmetry?

TIME CONSTRAINT: Focus on research from the last 3-6 months. Prioritize recent rating changes or target revisions.`;

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
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Edge Function returned ${response.status}`);
        }

        if (cancelled) return; // Don't update if component unmounted or ticker changed

        const responseData = await response.json();
        const responseText = responseData.text;

        // Validate response exists
        if (!responseText) {
          throw new Error('Gemini API returned empty response. This may be a rate limit or API quota issue.');
        }

        // Parse and validate response structure
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
        }

        // Validate that we have the expected data structure
        if (!result.ratings || !Array.isArray(result.ratings) || result.ratings.length === 0) {
          throw new Error(`No analyst ratings found for ${ticker}. This ticker may have limited Wall Street coverage or research is behind paywalls.`);
        }

        if (!result.consensus) {
          throw new Error('Invalid API response: missing consensus data');
        }

        setData(result);

        // Only cache valid responses with actual data
        if (result.ratings.length > 0) {
          setCache(prev => ({ ...prev, [ticker]: { data: result, timestamp: Date.now() } }));
        }
      } catch (e) {
        if (!cancelled) {
          const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
          setError(errorMessage);
          setData(null); // Clear any previous data
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSlowLoading(false);
        }
      }
    };

    fetchPerspectives();

    return () => {
      cancelled = true; // Cancel any pending updates
    };
  }, [ticker, hasKey]);

  // Slow loading detection
  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      if (loading) {
        setSlowLoading(true);
      }
    }, 5000); // Show message after 5 seconds

    return () => clearTimeout(timer);
  }, [loading]);

  if (hasKey === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8 py-32 bg-darkBlue/20 rounded-xl border border-gold/10">
        <div className="text-center space-y-4">
          <h3 className="header-noe text-2xl text-white uppercase tracking-tight">Street Research Access</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Accessing real-time analyst ratings and price targets requires <span className="text-gold font-bold">Supabase configuration</span> with the Gemini proxy Edge Function deployed.
          </p>
          <p className="text-[10px] text-rain uppercase tracking-widest">
            Please configure your Supabase project and deploy Edge Functions.
          </p>
        </div>
        <button 
          onClick={handleOpenKey}
          className="px-10 py-4 bg-gold text-obsidian text-[11px] font-black uppercase tracking-[0.2em] rounded hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          Configure Access
        </button>
        <a
          href="https://supabase.com/docs/guides/functions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-rain hover:text-white underline underline-offset-4 uppercase tracking-widest"
        >
          Edge Functions Documentation
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="w-16 h-16 border-t-4 border-gold border-solid rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-rain uppercase tracking-[0.5em] animate-pulse">Aggregating Street Research...</p>
        {slowLoading && (
          <div className="text-center space-y-2 mt-4">
            <p className="text-[9px] text-slate-400 max-w-md">This is taking longer than usual. Gemini is searching multiple sources...</p>
            <p className="text-[8px] text-rain uppercase tracking-widest">Typically completes in 10-20 seconds</p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="aegis-card p-10 bg-rose-500/10 border-rose-500/20 max-w-3xl mx-auto">
        <div className="flex items-start gap-4 mb-6">
          <svg className="w-8 h-8 text-rose-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-rose-400 font-bold text-sm mb-3 uppercase tracking-wider">Failed to Load Analyst Data</h3>
            <p className="text-slate-300 text-xs leading-relaxed mb-4">{error}</p>
            <div className="space-y-2 text-[10px] text-slate-400">
              <p className="font-bold uppercase tracking-wide text-rain">Possible causes:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>API quota exceeded (free tier limit: 10 requests/min)</li>
                <li>Network connectivity issue</li>
                <li>Limited Wall Street coverage for this ticker</li>
                <li>Gemini Search grounding service temporarily unavailable</li>
              </ul>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            // Force re-fetch by clearing cache for this ticker
            setCache(prev => {
              const updated = { ...prev };
              delete updated[ticker];
              return updated;
            });
          }}
          className="w-full px-6 py-3 bg-gold text-obsidian text-xs font-black uppercase rounded hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <div className="text-rain text-center py-20 uppercase font-black">No recent research found for {ticker}</div>;

  // Calculate rating distribution
  const ratingCounts = data.ratings.reduce((acc, r) => {
    const category = ['Buy', 'Overweight'].includes(r.rating) ? 'bullish' :
                    ['Sell', 'Underweight'].includes(r.rating) ? 'bearish' : 'neutral';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalRatings = data.ratings.length;
  const bullishPct = ((ratingCounts.bullish || 0) / totalRatings) * 100;
  const bearishPct = ((ratingCounts.bearish || 0) / totalRatings) * 100;
  const neutralPct = ((ratingCounts.neutral || 0) / totalRatings) * 100;

  // Calculate price target range
  const targets = data.ratings
    .map(r => parseFloat(r.target.replace(/[$,]/g, '')))
    .filter(t => !isNaN(t));
  const lowTarget = Math.min(...targets);
  const highTarget = Math.max(...targets);
  const medianTarget = parseFloat(data.consensus.priceTargetMed.replace(/[$,]/g, ''));

  return (
    <div className="space-y-10 animate-in fade-in duration-1000 max-w-6xl mx-auto pb-20">
      {/* ABOVE THE FOLD: Hero Metrics */}
      <header className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Target Summary */}
        <div className="aegis-card gold-braiding p-8 lg:col-span-2">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="header-noe text-2xl text-white uppercase tracking-tight">Street Consensus</h2>
              <p className="text-[10px] text-rain font-bold uppercase tracking-[0.3em] mt-2">Aggregated Wall Street Research</p>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black text-rain uppercase tracking-widest">Coverage</div>
              <div className="text-xl font-black text-white mono">{totalRatings} Firms</div>
            </div>
          </div>

          {/* Price Target Visualization */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[9px] font-black text-rain uppercase block mb-1">Median Target</span>
                <span className="text-3xl font-black text-gold mono">{data.consensus.priceTargetMed}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-rain uppercase block mb-1">Range</span>
                <span className="text-sm font-black text-white mono">${lowTarget.toFixed(2)} - ${highTarget.toFixed(2)}</span>
              </div>
            </div>

            {/* Visual Target Range Bar */}
            <div className="relative h-3 bg-obsidian/60 rounded-full overflow-hidden border border-rain/20">
              <div
                className="absolute h-full bg-gradient-to-r from-rose-500/20 via-gold/40 to-emerald-500/20"
                style={{ width: '100%' }}
              />
              <div
                className="absolute h-full w-1 bg-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]"
                style={{ left: `${((medianTarget - lowTarget) / (highTarget - lowTarget)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="aegis-card p-8 bg-darkBlue/30">
          <h3 className="text-[10px] font-black text-rain uppercase tracking-widest mb-6">Rating Breakdown</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Bullish</span>
                <span className="text-xs font-black text-white mono">{ratingCounts.bullish || 0} ({bullishPct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-obsidian/60 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${bullishPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Neutral</span>
                <span className="text-xs font-black text-white mono">{ratingCounts.neutral || 0} ({neutralPct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-obsidian/60 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500" style={{ width: `${neutralPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold text-rose-400 uppercase">Bearish</span>
                <span className="text-xs font-black text-white mono">{ratingCounts.bearish || 0} ({bearishPct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 bg-obsidian/60 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${bearishPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* KEY THEMES: Bull/Bear Case (ABOVE THE FOLD) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bull Case */}
        <div className="aegis-card p-8 bg-emerald-500/5 border-emerald-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider mb-6 flex items-center gap-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg>
              Bull Case: High-Conviction Themes
            </h3>
            <ul className="space-y-5">
              {data.consensus.bullCase.map((point, i) => (
                <li key={i} className="group">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mt-0.5">
                      <span className="text-[10px] font-black text-emerald-400">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-slate-200 leading-relaxed font-medium">{point.text}</p>
                      {point.sourceUrl && (
                        <a
                          href={point.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[9px] text-lightBlue/60 hover:text-lightBlue uppercase tracking-wider font-bold transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bear Case */}
        <div className="aegis-card p-8 bg-rose-500/5 border-rose-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <h3 className="text-sm font-black text-rose-400 uppercase tracking-wider mb-6 flex items-center gap-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 4.707 6.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" /></svg>
              Bear Case: Key Risk Factors
            </h3>
            <ul className="space-y-5">
              {data.consensus.bearCase.map((point, i) => (
                <li key={i} className="group">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mt-0.5">
                      <span className="text-[10px] font-black text-rose-400">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] text-slate-200 leading-relaxed font-medium">{point.text}</p>
                      {point.sourceUrl && (
                        <a
                          href={point.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-[9px] text-lightBlue/60 hover:text-lightBlue uppercase tracking-wider font-bold transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* DETAILED VIEW: Firm-by-Firm Breakdown (Below the fold) */}
      <div className="aegis-card overflow-hidden">
        <div className="px-8 py-5 border-b border-white/10 bg-black/20 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Detailed Firm Coverage</h3>
            <p className="text-[9px] text-rain font-bold uppercase tracking-wider mt-1">Source-Verified Analyst Ratings</p>
          </div>
          <span className="text-[8px] font-bold text-rain uppercase tracking-tighter px-3 py-1 bg-lightBlue/10 border border-lightBlue/20 rounded">Google Search Grounded</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-obsidian/40 border-b border-white/5">
              <tr>
                <th className="px-8 py-4 font-black text-rain uppercase tracking-tighter">Firm</th>
                <th className="px-8 py-4 font-black text-rain uppercase tracking-tighter">Rating</th>
                <th className="px-8 py-4 font-black text-rain uppercase tracking-tighter text-right">Price Target</th>
                <th className="px-8 py-4 font-black text-rain uppercase tracking-tighter text-right">Date</th>
                <th className="px-8 py-4 font-black text-rain uppercase tracking-tighter text-center">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {data.ratings.map((r, i) => (
                <tr key={i} className="hover:bg-white/5 transition-all">
                  <td className="px-8 py-4 text-white font-bold">{r.firm}</td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded text-[9px] font-black uppercase ${
                      ['Buy', 'Overweight'].includes(r.rating) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                      ['Sell', 'Underweight'].includes(r.rating) ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                      'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                    }`}>
                      {r.rating}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right text-white mono font-bold text-base">{r.target}</td>
                  <td className="px-8 py-4 text-right text-rain text-[10px] font-semibold uppercase tracking-wide">{r.date}</td>
                  <td className="px-8 py-4 text-center">
                    {r.sourceUrl && (
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-lightBlue/10 text-lightBlue hover:bg-lightBlue hover:text-obsidian transition-all"
                        title="View Source"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sector Experts */}
      <section className="aegis-card p-10 bg-darkBlue/20">
        <h3 className="header-noe text-lg text-white mb-8 border-b border-white/5 pb-4 uppercase tracking-wider">Top Sector Coverage Experts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {data.consensus.sectorExperts.map((expert, i) => (
            <div key={i} className="p-5 border border-white/5 bg-obsidian/40 rounded flex flex-col justify-between">
              <div>
                <span className="text-white font-bold block text-sm">{expert.name}</span>
                <span className="text-[9px] font-black text-rain uppercase tracking-widest">{expert.firm}</span>
              </div>
              <div className="mt-6 flex justify-between items-center">
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                  expert.stance.includes('Over') ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                  expert.stance.includes('Under') ? 'border-rose-500/30 text-rose-400 bg-rose-500/5' :
                  'border-slate-500/30 text-slate-400 bg-slate-500/5'
                }`}>
                  {expert.stance}
                </span>
                <span className="text-[7px] font-bold text-rain/40 uppercase">Expert Tracked</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AnalystPerspectives;
