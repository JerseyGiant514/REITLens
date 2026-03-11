/**
 * Supabase Edge Function: Market Data Proxy
 *
 * Proxies requests to Yahoo Finance API so the app works in production
 * builds where the Vite dev-server proxy is not available. Also handles
 * CORS and adds the required User-Agent header.
 *
 * No secrets required -- Yahoo Finance v8 API is public.
 *
 * Usage:
 *   GET /market-data?ticker=PLD&days=90
 *
 * Deno runtime (Supabase Edge Functions)
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // Tighten to your domain in production
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get('ticker');
    const days = parseInt(url.searchParams.get('days') || '90', 10);

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Missing required "ticker" query parameter' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Validate ticker format (basic safeguard)
    if (!/^[A-Z0-9.\-]{1,10}$/i.test(ticker)) {
      return new Response(
        JSON.stringify({ error: 'Invalid ticker format' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - days * 24 * 60 * 60;

    const yahooUrl =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?period1=${startDate}&period2=${endDate}&interval=1d`;

    const yahooResponse = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) REITLens/1.0',
      },
    });

    if (!yahooResponse.ok) {
      const errText = await yahooResponse.text();
      console.error('[market-data] Yahoo Finance error:', yahooResponse.status, errText);
      return new Response(
        JSON.stringify({
          error: `Yahoo Finance returned ${yahooResponse.status}`,
          details: errText,
        }),
        {
          status: yahooResponse.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    const data = await yahooResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        // Cache for 5 minutes at the edge
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('[market-data] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
