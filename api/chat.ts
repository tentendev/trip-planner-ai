export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error('[api/chat] NVIDIA_API_KEY is not configured');
    return res.status(500).json({ error: 'NVIDIA_API_KEY is not configured on the server' });
  }

  const t0 = Date.now();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const model = body?.model || process.env.NVIDIA_MODEL || 'minimaxai/minimax-m2.7';
    const payload = JSON.stringify({ ...body, model, stream: false });

    console.log('[api/chat] →', { model, msgs: body?.messages?.length, temp: body?.temperature, payload_bytes: payload.length });

    // NVIDIA's edge sometimes returns 502 transiently on cold backends.
    // Retry up to 3 times with exponential backoff (only on 5xx).
    let upstream: Response | null = null;
    let lastBody = '';
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      upstream = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'TripOS/1.0 (+https://vercel.app)',
        },
        body: payload,
      });

      if (upstream.status < 500) break; // success or 4xx — stop retrying

      lastBody = await upstream.text();
      console.warn('[api/chat] upstream 5xx, will retry', { attempt, status: upstream.status, bytes: lastBody.length });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // 500ms, 1000ms
      }
    }

    if (!upstream) throw new Error('No upstream response');

    const elapsed = Date.now() - t0;

    if (!upstream.ok) {
      const text = lastBody || (await upstream.text());
      console.error('[api/chat] upstream error (final)', { status: upstream.status, elapsed_ms: elapsed, body: text.slice(0, 1000) });
      return res.status(upstream.status).json({
        error: `NVIDIA upstream ${upstream.status}`,
        upstream_body: tryParse(text),
        elapsed_ms: elapsed,
      });
    }

    const text = await upstream.text();
    console.log('[api/chat] ← ok', { status: upstream.status, elapsed_ms: elapsed, bytes: text.length });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    console.error('[api/chat] proxy threw', { message: err?.message, name: err?.name, elapsed_ms: elapsed });
    return res.status(500).json({ error: err?.message || 'Proxy error', name: err?.name, elapsed_ms: elapsed });
  }
}

function tryParse(s: string) {
  try { return JSON.parse(s); } catch { return s.slice(0, 500); }
}
