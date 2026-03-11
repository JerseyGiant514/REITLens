/**
 * Supabase Edge Function: Gemini API Proxy
 *
 * Keeps the Gemini API key server-side so it is never exposed in client
 * JavaScript bundles. Accepts POST requests with a prompt and optional
 * configuration, forwards them to the Google Gemini API, and returns the
 * response.
 *
 * Environment variable required (set via Supabase Dashboard > Edge Functions > Secrets):
 *   GEMINI_API_KEY - Your Google Gemini API key
 *
 * Deno runtime (Supabase Edge Functions)
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // Tighten to your domain in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

interface GeminiProxyRequest {
  /** The text prompt to send to Gemini */
  prompt: string;
  /** Which Gemini model to use (default: gemini-2.0-flash-exp) */
  model?: string;
  /** Optional Gemini config (tools, responseMimeType, etc.) */
  config?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.error('[gemini-proxy] GEMINI_API_KEY not set in environment');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: API key not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const body: GeminiProxyRequest = await req.json();

    if (!body.prompt || typeof body.prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid "prompt" field in request body' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const model = body.model || 'gemini-2.0-flash-exp';

    // Build the Gemini REST API request
    // https://ai.google.dev/api/generate-content
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiBody: Record<string, unknown> = {
      contents: [{ parts: [{ text: body.prompt }] }],
    };

    // Merge any extra config (tools, responseMimeType, etc.)
    if (body.config) {
      // generationConfig fields
      if (body.config.responseMimeType) {
        geminiBody.generationConfig = {
          responseMimeType: body.config.responseMimeType,
        };
      }
      // Tools (e.g., googleSearch grounding)
      if (body.config.tools) {
        geminiBody.tools = body.config.tools;
      }
    }

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('[gemini-proxy] Gemini API error:', geminiResponse.status, errText);
      return new Response(
        JSON.stringify({
          error: `Gemini API returned ${geminiResponse.status}`,
          details: errText,
        }),
        {
          status: geminiResponse.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract the text from the Gemini response
    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    return new Response(
      JSON.stringify({ text, raw: geminiData }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    console.error('[gemini-proxy] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
