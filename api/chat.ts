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
// If upstream sends no SSE data for this long, treat the model as stalled and abort.
// 90s is generous for thinking models but well below the 300s function ceiling so we
// can return a clean error instead of dying.
const STALL_TIMEOUT_MS = 90_000;
const HEARTBEAT_MS = 15_000;

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
  let provName = provider.name;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const clientWantsStream = body?.stream === true;
    const model = pickModelForProvider(provider, body?.model);
    const payload = JSON.stringify({ ...body, model, stream: true });

    console.log('[api/chat] →', {
      provider: provName,
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
      provider: provName,
      status: upstream.status,
      content_type: upstream.headers.get('content-type'),
      ms: headersAt - t0,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[api/chat] upstream error', { provider: provName, status: upstream.status, body: text.slice(0, 1000) });
      return res.status(upstream.status).json({
        error: `${provName} upstream ${upstream.status}`,
        provider: provName,
        upstream_body: tryParse(text),
        elapsed_ms: Date.now() - t0,
      });
    }
    if (!upstream.body) return res.status(502).json({ error: 'Upstream returned no body' });

    if (clientWantsStream) {
      // Manual stream forward with explicit flush + heartbeat + stall detection.
      // Plain `body.pipe(res)` worked locally but Vercel's runtime sometimes buffers
      // until enough bytes accumulate, and gives us no signal when the upstream model
      // is thinking silently.
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-LLM-Provider', provName);
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      // Initial heartbeat so the client connection is established immediately and any
      // intermediate proxy commits to streaming mode.
      res.write(': connected\n\n');

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) res.write(': keepalive\n\n');
      }, HEARTBEAT_MS);

      let firstByteAt: number | null = null;
      let lastByteAt = Date.now();
      const stallChecker = setInterval(() => {
        if (Date.now() - lastByteAt > STALL_TIMEOUT_MS) {
          console.error('[api/chat] upstream stalled — no data in', STALL_TIMEOUT_MS, 'ms');
          ac.abort();
        }
      }, 5_000);

      let totalBytes = 0;
      const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!firstByteAt) {
            firstByteAt = Date.now();
            console.log('[api/chat] upstream first byte', { provider: provName, ms: firstByteAt - t0 });
          }
          lastByteAt = Date.now();
          totalBytes += value.byteLength;
          res.write(Buffer.from(value));
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.error('[api/chat] stream aborted (stall)', { provider: provName, total_ms: Date.now() - t0 });
          // Tell the client what happened via an SSE error event.
          res.write(`data: ${JSON.stringify({ error: { message: `Upstream stalled after ${STALL_TIMEOUT_MS / 1000}s — model may be too slow or queued. Try a faster model.` } })}\n\n`);
        } else {
          console.error('[api/chat] stream read error', err);
          res.write(`data: ${JSON.stringify({ error: { message: err?.message || 'stream read error' } })}\n\n`);
        }
      } finally {
        clearInterval(heartbeat);
        clearInterval(stallChecker);
        if (!res.writableEnded) {
          res.write('data: [DONE]\n\n');
          res.end();
        }
        console.log('[api/chat] ← stream end', {
          provider: provName,
          total_ms: Date.now() - t0,
          first_byte_ms: firstByteAt ? firstByteAt - t0 : null,
          total_bytes: totalBytes,
        });
      }
      return;
    }

    // Non-streaming client: accumulate SSE → assemble a ChatCompletion-style JSON.
    let firstByteAt: number | null = null;
    let lastByteAt = Date.now();
    const stallChecker = setInterval(() => {
      if (Date.now() - lastByteAt > STALL_TIMEOUT_MS) {
        console.error('[api/chat] upstream stalled (non-streaming) — aborting');
        ac.abort();
      }
    }, 5_000);
    try {
      const accumulated = await accumulateSSE(upstream.body as any, () => {
        if (!firstByteAt) firstByteAt = Date.now();
        lastByteAt = Date.now();
      });
      console.log('[api/chat] ← accumulated', {
        provider: provName,
        total_ms: Date.now() - t0,
        first_byte_ms: firstByteAt ? firstByteAt - t0 : null,
        content_chars: accumulated.content.length,
      });
      res.status(200);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-LLM-Provider', provName);
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
    } finally {
      clearInterval(stallChecker);
    }
  } catch (err: any) {
    const elapsed = Date.now() - t0;
    console.error('[api/chat] proxy threw', { provider: provName, message: err?.message, name: err?.name, elapsed_ms: elapsed });
    if (!res.headersSent) {
      const isStall = err?.name === 'AbortError';
      return res.status(isStall ? 504 : 502).json({
        error: isStall
          ? `Upstream stalled after ${STALL_TIMEOUT_MS / 1000}s — the model may be too slow or queued. Try a faster model in OPENROUTER_MODEL.`
          : err?.message || 'Proxy error',
        provider: provName,
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

async function accumulateSSE(stream: ReadableStream<Uint8Array>, onChunk?: () => void): Promise<SSEResult> {
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
    if (onChunk) onChunk();
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
