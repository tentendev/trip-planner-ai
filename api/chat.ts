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

// --- Abuse guards -----------------------------------------------------------
// This endpoint proxies a PAID LLM key, so it must not be an open utility.
// 1) Same-origin enforcement: browsers always send Origin on cross-origin POSTs.
//    Requests with a foreign Origin are rejected unless it matches the deployment
//    host or ALLOWED_ORIGINS (comma-separated, set for preview domains / local dev).
// 2) Field whitelist + clamps below bound what we send upstream (cost ceiling).
// 3) Per-instance IP rate limit. Serverless instances are ephemeral so this is a
//    speed bump rather than a hard quota — pair with Vercel Firewall for real DDoS
//    protection; it still stops naive scripting from a single connection pool.
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 32_000;
const MAX_TOKENS_CAP = 16_000;

function getAllowedOrigins(reqOriginHost: string | null): string[] {
  const list: string[] = [];
  if (reqOriginHost) list.push(reqOriginHost);
  const extra = process.env.ALLOWED_ORIGINS?.trim();
  if (extra) list.push(...extra.split(',').map(s => s.trim()).filter(Boolean));
  return list;
}

function isAllowedOrigin(originHeader: string | undefined, reqHost: string | null): boolean {
  if (!originHeader) return true; // same-origin/server-to-server fetches may omit it
  let originHost: string | null = null;
  try {
    originHost = new URL(originHeader).host;
  } catch {
    return false;
  }
  if (!originHost) return false;
  if (reqHost && originHost === reqHost) return true;
  return getAllowedOrigins(reqHost).includes(originHeader);
}

// --- Naive sliding-window rate limiter --------------------------------------
interface RateEntry { timestamps: number[] }
const rateBuckets = new Map<string, RateEntry>();
const RATE_WINDOW_MS = 60_000;
const CHAT_RPM_LIMIT = Number(process.env.RATE_LIMIT_CHAT_RPM || 6);
const FAST_RPM_LIMIT = Number(process.env.RATE_LIMIT_FAST_RPM || 20);

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(ip) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_WINDOW_MS);
  if (entry.timestamps.length >= limit) {
    rateBuckets.set(ip, entry);
    return false;
  }
  entry.timestamps.push(now);
  rateBuckets.set(ip, entry);
  // Opportunistic cleanup so the Map cannot grow unbounded across a warm instance's life.
  if (rateBuckets.size > 5_000) {
    for (const [k, v] of rateBuckets) {
      if (v.timestamps.every(t => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(k);
    }
  }
  return true;
}

function clientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.headers?.['x-real-ip'] || 'unknown';
}

/**
 * Whitelist + clamp the upstream request body. Only what we intend to support passes.
 */
function sanitizeBody(body: any): { error: string | null; value: Record<string, unknown> | null } {
  if (!body || typeof body !== 'object') return { error: 'Invalid body', value: null };
  const msgs = body.messages;
  if (!Array.isArray(msgs) || msgs.length === 0 || msgs.length > MAX_MESSAGES) {
    return { error: `messages must be an array of 1-${MAX_MESSAGES} items`, value: null };
  }
  for (const m of msgs) {
    if (!m || typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS) {
      return { error: 'invalid or oversized message content', value: null };
    }
    if (m.role !== 'system' && m.role !== 'user' && m.role !== 'assistant') {
      return { error: 'invalid message role', value: null };
    }
  }
  const temp = typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1.2) : undefined;
  // Client may only choose '' (default model) or 'fast' (small extraction model).
  const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model : '';
  const cleaned: Record<string, unknown> = {
    messages: msgs.map((m: any) => ({ role: m.role, content: m.content })),
    stream: true,
  };
  if (temp !== undefined) cleaned.temperature = temp;
  cleaned.max_tokens = typeof body.max_tokens === 'number' && body.max_tokens > 0
    ? Math.min(body.max_tokens, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;
  if (requestedModel === 'fast') cleaned.model = 'fast';
  return { error: null, value: cleaned };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });

  const referer = req.headers?.origin || req.headers?.referer || 'https://trip-os.local';
  const provider = resolveProvider(referer);
  if (!provider) {
    console.error('[api/chat] no provider configured');
    return res.status(503).json({
      error: 'Trip planner backend is not configured yet.',
      code: 'CONFIG_ERROR',
    });
  }

  // Same-origin gate (after provider check so misconfiguration is reported first).
  const reqHost: string | null = req.headers?.host || null;
  if (!isAllowedOrigin(req.headers?.origin, reqHost)) {
    console.warn('[api/chat] rejected foreign origin', { origin: req.headers?.origin });
    return res.status(403).json({ error: 'Forbidden origin', code: 'FORBIDDEN_ORIGIN' });
  }

  // Rate limit: stricter for main generations, looser for the small "fast" calls.
  const ip = clientIp(req);
  const rawBody: any = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : req.body;
  const limit = rawBody?.model === 'fast' ? FAST_RPM_LIMIT : CHAT_RPM_LIMIT;
  if (!checkRateLimit(ip, limit)) {
    return res.status(429).json({
      error: 'Too many requests — please wait a moment before planning again.',
      code: 'RATE_LIMITED',
      retry_after_seconds: 60,
    });
  }

  const sanitized = sanitizeBody(rawBody);
  if (sanitized.error || !sanitized.value) {
    return res.status(400).json({ error: sanitized.error, code: 'BAD_REQUEST' });
  }

  const t0 = Date.now();
  let provName = provider.name;
  try {
    const clientWantsStream = rawBody?.stream === true;
    const model = pickModelForProvider(provider, sanitized.value.model as string | undefined);
    const payload = JSON.stringify({ ...sanitized.value, model });

    console.log('[api/chat] →', {
      provider: provName,
      model,
      msgs: Array.isArray(sanitized.value.messages) ? (sanitized.value.messages as any[]).length : 0,
      temp: sanitized.value.temperature,
      payload_bytes: payload.length,
      client_wants_stream: clientWantsStream,
      ip,
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
      const code = upstream.status === 429 ? 'RATE_LIMITED' : upstream.status >= 500 ? 'UPSTREAM_BUSY' : 'UPSTREAM_ERROR';
      return res.status(upstream.status === 429 ? 429 : 502).json({
        error: code === 'RATE_LIMITED'
          ? 'The AI planner is very busy right now — please try again in a minute.'
          : 'The AI planner could not complete this request.',
        code,
        upstream_body: tryParse(text),
        elapsed_ms: Date.now() - t0,
      });
    }
    if (!upstream.body) return res.status(502).json({ error: 'Upstream returned no body', code: 'UPSTREAM_ERROR' });

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
          res.write(`data: ${JSON.stringify({ error: { message: `Upstream stalled after ${STALL_TIMEOUT_MS / 1000}s — model may be too slow or queued. Try again shortly.`, code: 'TIMEOUT' } })}\n\n`);
        } else {
          console.error('[api/chat] stream read error', err);
          res.write(`data: ${JSON.stringify({ error: { message: err?.message || 'stream read error', code: 'UPSTREAM_ERROR' } })}\n\n`);
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
          ? 'The planner took too long to respond — please try again.'
          : 'The planner could not complete this request.',
        code: isStall ? 'TIMEOUT' : 'PROXY_ERROR',
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
  // "fast" is the only client model value the proxy honors — it's an alias for utility
  // calls (param extraction, classification) so a slow main model doesn't block them.
  // Override via OPENROUTER_FAST_MODEL / NVIDIA_FAST_MODEL env vars.
  if (clientModel === 'fast') {
    if (provider.name === 'openrouter') {
      return process.env.OPENROUTER_FAST_MODEL?.trim() || 'openai/gpt-5-mini';
    }
    return process.env.NVIDIA_FAST_MODEL?.trim() || 'meta/llama-3.3-70b-instruct';
  }

  // For everything else, the provider's env var (OPENROUTER_MODEL or NVIDIA_MODEL) is the
  // single source of truth. Ignore whatever model name the client baked in at build time —
  // OpenRouter and NVIDIA use different namespaces (e.g. "minimax/m2.7" vs "minimaxai/m2.7",
  // and OpenRouter has many models that don't exist on NVIDIA).
  return provider.defaultModel;
}

function tryParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s.slice(0, 500);
  }
}
