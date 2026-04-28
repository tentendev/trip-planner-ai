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

const HEADERS_TIMEOUT_MS = 60_000;

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const referer = req.headers?.origin || req.headers?.referer || 'https://trip-os.local';
  const provider = resolveProvider(referer);
  if (!provider) {
    console.error('[api/chat] no provider configured');
    return res.status(500).json({
      error: 'No LLM provider configured. Set OPENROUTER_API_KEY (preferred) or NVIDIA_API_KEY in Vercel env vars.',
    });
  }

  const t0 = Date.now();
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const clientWantsStream = body?.stream === true;
    const model = pickModelForProvider(provider, body?.model);
    // Always request streaming upstream — even if the client wants a single JSON response.
    // This avoids the Node 24 undici keep-alive hang where `await response.text()` blocks
    // for the full generation duration on chunked responses with stream:false. The proxy
    // either pipes the SSE stream straight through (if clientWantsStream) or accumulates
    // it server-side and returns one ChatCompletion JSON.
    const payload = JSON.stringify({ ...body, model, stream: true });

    console.log('[api/chat] →', {
      provider: provider.name,
      model,
      msgs: body?.messages?.length,
      temp: body?.temperature,
      payload_bytes: payload.length,
      client_wants_stream: clientWantsStream,
    });

    const ac = new AbortController();
    const headersTimer = setTimeout(() => ac.abort(), HEADERS_TIMEOUT_MS);

    const upstream = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'User-Agent': 'TripOS/1.0 (+https://vercel.app)',
        ...(provider.extraHeaders || {}),
      },
      body: payload,
      signal: ac.signal,
    });
    clearTimeout(headersTimer);

    const headersAt = Date.now();
    console.log('[api/chat] upstream headers', {
      provider: provider.name,
      status: upstream.status,
      content_type: upstream.headers.get('content-type'),
      ms: headersAt - t0,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[api/chat] upstream error', {
        provider: provider.name,
        status: upstream.status,
        body: text.slice(0, 1000),
      });
      return res.status(upstream.status).json({
        error: `${provider.name} upstream ${upstream.status}`,
        provider: provider.name,
        upstream_body: tryParse(text),
        elapsed_ms: Date.now() - t0,
      });
    }

    if (!upstream.body) {
      return res.status(502).json({ error: 'Upstream returned no body' });
    }

    if (clientWantsStream) {
      // Pass SSE through to the client. The browser parses delta tokens as they arrive,
      // so even a 4-minute model gives the user progressive output.
      res.status(200);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-LLM-Provider', provider.name);
      res.setHeader('X-Accel-Buffering', 'no');
      const nodeStream = Readable.fromWeb(upstream.body as any);
      nodeStream.pipe(res);
      nodeStream.on('end', () => {
        console.log('[api/chat] ← stream end', { provider: provider.name, total_ms: Date.now() - t0 });
      });
      nodeStream.on('error', (err) => {
        console.error('[api/chat] stream error', err);
        if (!res.writableEnded) res.end();
      });
      return;
    }

    // Non-streaming client: accumulate SSE → assemble a ChatCompletion-style JSON.
    const accumulated = await accumulateSSE(upstream.body as any);
    res.status(200);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-LLM-Provider', provider.name);
    console.log('[api/chat] ← accumulated', {
      provider: provider.name,
      total_ms: Date.now() - t0,
      content_chars: accumulated.content.length,
    });
    return res.json({
      id: accumulated.id,
      object: 'chat.completion',
      model: accumulated.model || model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: accumulated.content },
          finish_reason: accumulated.finish_reason || 'stop',
        },
      ],
    });
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    console.error('[api/chat] proxy threw', {
      provider: provider?.name,
      message: err?.message,
      name: err?.name,
      elapsed_ms: elapsed,
    });
    if (!res.headersSent) {
      return res.status(502).json({
        error: err?.message || 'Proxy error',
        provider: provider?.name,
        name: err?.name,
        elapsed_ms: elapsed,
      });
    }
    return;
  }
}

interface SSEResult {
  id: string;
  model: string;
  content: string;
  finish_reason: string | null;
}

async function accumulateSSE(stream: ReadableStream): Promise<SSEResult> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let id = '';
  let model = '';
  let content = '';
  let finish_reason: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const chunk = JSON.parse(data);
        if (!id && chunk.id) id = chunk.id;
        if (!model && chunk.model) model = chunk.model;
        const choice = chunk.choices?.[0];
        if (choice?.delta?.content) content += choice.delta.content;
        if (choice?.finish_reason) finish_reason = choice.finish_reason;
      } catch {
        // ignore malformed chunks
      }
    }
  }
  return { id, model, content, finish_reason };
}

function pickModelForProvider(provider: Provider, clientModel?: string): string {
  if (!clientModel) return provider.defaultModel;
  if (provider.name === 'openrouter' && clientModel.startsWith('minimaxai/')) return provider.defaultModel;
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
