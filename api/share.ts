import { put, list } from '@vercel/blob';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    } = req.body;

    if (!id || !markdown) {
      return res.status(400).json({ error: 'Missing required fields: id, markdown' });
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
