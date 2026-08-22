import { put, list } from '@vercel/blob';
import { isAllowedOrigin, clientIp, checkRateLimit, validators } from '../lib/apiGuard';

export const config = {
  runtime: 'nodejs',
};

// Public writes to shared storage must be capped — an unbounded payload would let
// a single request burn Blob storage/money.
const MAX_SHARE_BODY_BYTES = 512 * 1024;

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isAllowedOrigin(req.headers?.origin, req.headers?.host || null)) {
    return res.status(403).json({ error: 'Forbidden origin', code: 'FORBIDDEN_ORIGIN' });
  }
  // Writes are expensive; reads are cheap and cacheable — limit them differently.
  const ip = clientIp(req);
  if (req.method === 'POST' && !checkRateLimit(ip, Number(process.env.RATE_LIMIT_SHARE_WRITE_RPM || 10))) {
    return res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handlePost(req: any, res: any) {
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (raw.length > MAX_SHARE_BODY_BYTES) {
      return res.status(413).json({ error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' });
    }
    const body = typeof req.body === 'string' ? JSON.parse(raw) : req.body;

    const {
      id,
      markdown,
      sources,
      lang,
      summary,
      flights,
      hotels,
      searchParams,
      flightPriceInsights,
    } = body;

    // Strict id format: share URLs embed the id in plaintext, so anything outside
    // this charset/length is either corrupted or hostile.
    if (!validators.shareId(id)) {
      return res.status(400).json({ error: 'Invalid share id format', code: 'BAD_REQUEST' });
    }
    if (typeof markdown !== 'string' || markdown.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: markdown', code: 'BAD_REQUEST' });
    }
    if (Array.isArray(sources) && sources.length > 50) {
      return res.status(400).json({ error: 'Too many sources', code: 'BAD_REQUEST' });
    }

    const planData = JSON.stringify({
      id,
      markdown,
      sources: sources || [],
      lang: lang || 'en',
      createdAt: Date.now(),
      summary: summary || undefined,
      flights: flights || undefined,
      hotels: hotels || undefined,
      searchParams: searchParams || undefined,
      flightPriceInsights: flightPriceInsights || undefined,
    });

    const blob = await put(`shares/${id}.json`, planData, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return res.status(200).json({ ok: true, id, url: blob.url });
  } catch (error: any) {
    console.error('Share POST error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save share' });
  }
}

async function handleGet(req: any, res: any) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Missing id parameter' });
    }

    // List blobs with the specific prefix to find the share
    const { blobs } = await list({ prefix: `shares/${id}.json` });

    if (blobs.length === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Fetch the blob content
    const blobUrl = blobs[0].url;
    const response = await fetch(blobUrl);
    const planData = await response.json();

    return res.status(200).json(planData);
  } catch (error: any) {
    console.error('Share GET error:', error);
    return res.status(500).json({ error: error.message || 'Failed to retrieve share' });
  }
}
