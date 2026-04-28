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
    return res.status(500).json({ error: 'NVIDIA_API_KEY is not configured on the server' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const model = body?.model || process.env.NVIDIA_MODEL || 'minimaxai/minimax-m2.7';

    const upstream = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ ...body, model, stream: false }),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err: any) {
    console.error('[api/chat] proxy error', err);
    return res.status(500).json({ error: err?.message || 'Proxy error' });
  }
}
