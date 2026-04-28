import { Readable } from 'node:stream';

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

const FETCH_TIMEOUT_MS = 270_000; // < function maxDuration so we surface a clean error

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

    const result = await fetchWithRetry(provider, payload);
    const elapsed = Date.now() - t0;

    if (!result.ok) {
      console.error('[api/chat] upstream error (final)', {
        provider: provider.name,
        status: result.status,
        elapsed_ms: elapsed,
        body: result.body.slice(0, 1000),
      });
      return res.status(result.status).json({
        error: `${provider.name} upstream ${result.status}`,
        provider: provider.name,
        upstream_body: tryParse(result.body),
        elapsed_ms: elapsed,
      });
    }

    console.log('[api/chat] ← ok (streaming through)', {
      provider: provider.name,
      status: result.status,
      headers_received_ms: result.headersReceivedAt - t0,
      content_type: result.contentType,
    });

    res.status(result.status);
    res.setHeader('Content-Type', result.contentType || 'application/json');
    res.setHeader('X-LLM-Provider', provider.name);

    // Stream the response body directly to the client. Avoids undici keep-alive issues
    // where `await response.text()` hangs after the body is fully delivered.
    if (result.bodyStream) {
      result.bodyStream.pipe(res);
      result.bodyStream.on('end', () => {
        const total = Date.now() - t0;
        console.log('[api/chat] ← stream complete', { provider: provider.name, total_ms: total });
      });
      result.bodyStream.on('error', (err) => {
        console.error('[api/chat] stream error', err);
        if (!res.writableEnded) res.end();
      });
    } else {
      // Fallback: text was already buffered (path used when status was 4xx and we read body for logging)
      res.send(result.body);
    }
    return;
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    console.error('[api/chat] proxy threw', {
      provider: provider.name,
      message: err?.message,
      name: err?.name,
      elapsed_ms: elapsed,
    });
    if (!res.headersSent) {
      return res.status(502).json({
        error: err?.message || 'Proxy error',
        provider: provider.name,
        name: err?.name,
        elapsed_ms: elapsed,
      });
    }
    return;
  }
}

interface FetchResult {
  ok: boolean;
  status: number;
  contentType: string | null;
  headersReceivedAt: number;
  bodyStream: NodeJS.ReadableStream | null; // populated on 2xx success
  body: string; // populated on 4xx/5xx so we can log + return error
}

async function fetchWithRetry(provider: Provider, payload: string): Promise<FetchResult> {
  const maxAttempts = 3;
  let lastFailure: FetchResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

    try {
      const upstream = await fetch(provider.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'TripOS/1.0 (+https://vercel.app)',
          ...(provider.extraHeaders || {}),
        },
        body: payload,
        signal: ac.signal,
      });

      const headersReceivedAt = Date.now();

      if (upstream.ok) {
        clearTimeout(timeoutId);
        return {
          ok: true,
          status: upstream.status,
          contentType: upstream.headers.get('content-type'),
          headersReceivedAt,
          bodyStream: upstream.body ? Readable.fromWeb(upstream.body as any) : null,
          body: '',
        };
      }

      // Non-OK: read body for logging/return.
      const text = await upstream.text();
      clearTimeout(timeoutId);
      lastFailure = {
        ok: false,
        status: upstream.status,
        contentType: upstream.headers.get('content-type'),
        headersReceivedAt,
        bodyStream: null,
        body: text,
      };

      if (upstream.status < 500) {
        // 4xx — don't retry
        return lastFailure;
      }

      console.warn('[api/chat] upstream 5xx, will retry', {
        provider: provider.name,
        attempt,
        status: upstream.status,
        bytes: text.length,
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('[api/chat] fetch attempt threw', {
        provider: provider.name,
        attempt,
        name: err?.name,
        message: err?.message,
      });
      if (err?.name === 'AbortError') {
        // Timeout — surface as 504-ish failure
        return {
          ok: false,
          status: 504,
          contentType: null,
          headersReceivedAt: Date.now(),
          bodyStream: null,
          body: `Upstream fetch aborted after ${FETCH_TIMEOUT_MS}ms`,
        };
      }
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return (
    lastFailure || {
      ok: false,
      status: 502,
      contentType: null,
      headersReceivedAt: Date.now(),
      bodyStream: null,
      body: 'No response after retries',
    }
  );
}

function pickModelForProvider(provider: Provider, clientModel?: string): string {
  if (!clientModel) return provider.defaultModel;
  if (provider.name === 'openrouter' && clientModel.startsWith('minimaxai/')) {
    return provider.defaultModel;
  }
  if (provider.name === 'nvidia' && clientModel.startsWith('minimax/') && !clientModel.startsWith('minimaxai/')) {
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
