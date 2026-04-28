export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
};

interface Provider {
  name: 'openrouter' | 'nvidia';
  url: string;
  apiKey: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
}

/**
 * Resolve which upstream LLM provider to use.
 * Priority:
 *   1. OPENROUTER_API_KEY (preferred — broad model access, stable edge)
 *   2. NVIDIA_API_KEY (fallback — build.nvidia.com)
 * Returns null if neither is configured.
 */
function resolveProvider(referer: string): Provider | null {
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    return {
      name: 'openrouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: orKey,
      defaultModel: process.env.OPENROUTER_MODEL?.trim() || 'minimax/minimax-m2.7',
      extraHeaders: {
        'HTTP-Referer': referer,
        'X-Title': 'Trip OS - AI Travel Planner',
      },
    };
  }

  const nvKey = process.env.NVIDIA_API_KEY?.trim();
  if (nvKey) {
    return {
      name: 'nvidia',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      apiKey: nvKey,
      defaultModel: process.env.NVIDIA_MODEL?.trim() || 'minimaxai/minimax-m2.7',
    };
  }

  return null;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const referer = req.headers?.origin || req.headers?.referer || 'https://trip-os.local';
  const provider = resolveProvider(referer);
  if (!provider) {
    console.error('[api/chat] no provider configured — set OPENROUTER_API_KEY or NVIDIA_API_KEY');
    return res.status(500).json({
      error: 'No LLM provider configured. Set OPENROUTER_API_KEY (preferred) or NVIDIA_API_KEY in Vercel env vars.',
    });
  }

  const t0 = Date.now();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Per-provider model resolution. The client sends a model name, but each provider has its own
    // ID format (e.g. OpenRouter "minimax/minimax-m2.7" vs NVIDIA "minimaxai/minimax-m2.7").
    // If the client-provided model doesn't match the provider's namespace, fall back to the
    // provider's default model.
    const clientModel: string | undefined = body?.model;
    const model = pickModelForProvider(provider, clientModel);
    const payload = JSON.stringify({ ...body, model, stream: false });

    console.log('[api/chat] →', {
      provider: provider.name,
      model,
      msgs: body?.messages?.length,
      temp: body?.temperature,
      payload_bytes: payload.length,
    });

    let upstream: Response | null = null;
    let lastBody = '';
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      upstream = await fetch(provider.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'TripOS/1.0 (+https://vercel.app)',
          ...(provider.extraHeaders || {}),
        },
        body: payload,
      });

      if (upstream.status < 500) break;

      lastBody = await upstream.text();
      console.warn('[api/chat] upstream 5xx, will retry', {
        provider: provider.name,
        attempt,
        status: upstream.status,
        bytes: lastBody.length,
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    if (!upstream) throw new Error('No upstream response');

    const elapsed = Date.now() - t0;

    if (!upstream.ok) {
      const text = lastBody || (await upstream.text());
      console.error('[api/chat] upstream error (final)', {
        provider: provider.name,
        status: upstream.status,
        elapsed_ms: elapsed,
        body: text.slice(0, 1000),
      });
      return res.status(upstream.status).json({
        error: `${provider.name} upstream ${upstream.status}`,
        provider: provider.name,
        upstream_body: tryParse(text),
        elapsed_ms: elapsed,
      });
    }

    const text = await upstream.text();
    console.log('[api/chat] ← ok', {
      provider: provider.name,
      status: upstream.status,
      elapsed_ms: elapsed,
      bytes: text.length,
    });
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.setHeader('X-LLM-Provider', provider.name);
    return res.send(text);
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    console.error('[api/chat] proxy threw', {
      provider: provider.name,
      message: err?.message,
      name: err?.name,
      elapsed_ms: elapsed,
    });
    return res.status(500).json({
      error: err?.message || 'Proxy error',
      provider: provider.name,
      name: err?.name,
      elapsed_ms: elapsed,
    });
  }
}

function pickModelForProvider(provider: Provider, clientModel?: string): string {
  if (!clientModel) return provider.defaultModel;
  // If client-provided model namespace matches the provider's expected namespace, pass through.
  // Otherwise, use the provider's default. This lets the same client work against either provider.
  if (provider.name === 'openrouter' && clientModel.startsWith('minimaxai/')) {
    // NVIDIA-format slug → use OpenRouter default
    return provider.defaultModel;
  }
  if (provider.name === 'nvidia' && clientModel.startsWith('minimax/') && !clientModel.startsWith('minimaxai/')) {
    // OpenRouter-format slug → use NVIDIA default
    return provider.defaultModel;
  }
  return clientModel;
}

function tryParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s.slice(0, 500);
  }
}
