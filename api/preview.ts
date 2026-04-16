import { list } from '@vercel/blob';

export const config = {
  runtime: 'nodejs',
};

// --- Localized fallback meta ---
const LANG_META: Record<string, { site: string; fallbackTitle: string; fallbackDesc: string; label: string }> = {
  'en':    { site: 'Trip OS', fallbackTitle: 'Shared Itinerary',    fallbackDesc: 'AI-crafted travel itinerary with optimized pacing, geo-clustering, and plan B alternatives.', label: 'Trip Plan' },
  'zh-TW': { site: 'Trip OS', fallbackTitle: '共享旅程',              fallbackDesc: 'AI 打造的最佳化旅遊行程，含地理分群、備案、天氣策略。',                                  label: '行程' },
  'zh-CN': { site: 'Trip OS', fallbackTitle: '共享行程',              fallbackDesc: 'AI 精心打造的旅游行程，含地理分群、备案、天气策略。',                                  label: '行程' },
  'ja':    { site: 'Trip OS', fallbackTitle: '共有された旅程',         fallbackDesc: 'AIが作成した最適化された旅行スケジュール。',                                            label: '旅程' },
  'ko':    { site: 'Trip OS', fallbackTitle: '공유된 여행 일정',        fallbackDesc: 'AI가 설계한 최적화된 여행 일정.',                                                      label: '여행 일정' },
  'es':    { site: 'Trip OS', fallbackTitle: 'Itinerario compartido', fallbackDesc: 'Itinerario de viaje optimizado generado por IA.',                                       label: 'Viaje' },
  'fr':    { site: 'Trip OS', fallbackTitle: 'Itinéraire partagé',    fallbackDesc: 'Itinéraire de voyage optimisé créé par IA.',                                           label: 'Voyage' },
  'pt':    { site: 'Trip OS', fallbackTitle: 'Roteiro compartilhado', fallbackDesc: 'Roteiro de viagem otimizado criado por IA.',                                           label: 'Viagem' },
  'ru':    { site: 'Trip OS', fallbackTitle: 'Общий маршрут',         fallbackDesc: 'Оптимизированный маршрут путешествия, созданный ИИ.',                                   label: 'Маршрут' },
  'ar':    { site: 'Trip OS', fallbackTitle: 'مسار سفر مشترك',         fallbackDesc: 'مسار سفر مُحسَّن تم إنشاؤه بواسطة الذكاء الاصطناعي.',                                    label: 'رحلة' },
  'hi':    { site: 'Trip OS', fallbackTitle: 'साझा यात्रा कार्यक्रम',   fallbackDesc: 'AI द्वारा बनाया गया अनुकूलित यात्रा कार्यक्रम।',                                       label: 'यात्रा' },
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripMarkdown(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, '')        // code fences
    .replace(/`([^`]+)`/g, '$1')            // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links: keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')      // bold
    .replace(/__([^_]+)__/g, '$1')          // bold
    .replace(/\*([^*]+)\*/g, '$1')          // italic
    .replace(/_([^_]+)_/g, '$1')            // italic
    .replace(/~~([^~]+)~~/g, '$1')          // strikethrough
    .replace(/\[([^\]]+)\]/g, '$1')         // [Context]
    .replace(/^\s*#{1,6}\s+/gm, '')         // headers
    .replace(/^\s*[-*+]\s+/gm, '')          // bullets
    .replace(/^\s*\d+\.\s+/gm, '')          // numbered
    .replace(/^\s*>\s?/gm, '')              // blockquotes
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(plan: any, meta: { fallbackTitle: string; label: string; site: string }): string {
  const dest = plan?.summary?.destination;
  const dates = plan?.summary?.dates;

  // If we have the destination, build a clean title: "東京 · 5 日行程 · Trip OS"
  if (dest) {
    const parts: string[] = [dest];
    if (dates) parts.push(dates);
    parts.push(meta.site);
    return parts.join(' · ');
  }

  // Else try the first h1/h2 from markdown
  const md = plan?.markdown || '';
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return `${stripMarkdown(h1[1]).slice(0, 80)} · ${meta.site}`;
  const h2 = md.match(/^##\s+([^\n]+)/m);
  if (h2) {
    const firstH2 = stripMarkdown(h2[1]);
    // Skip boilerplate h2s like "0. 🌦️ Weather", prefer something meaningful
    if (!/^\d+\.\s/.test(firstH2) && firstH2.length < 60) {
      return `${firstH2} · ${meta.site}`;
    }
  }
  return `${meta.fallbackTitle} · ${meta.site}`;
}

function extractDescription(plan: any, meta: { fallbackDesc: string }): string {
  const summary = plan?.summary || {};
  const bits: string[] = [];

  if (summary.destination) bits.push(summary.destination);
  if (summary.dates) bits.push(summary.dates);
  if (summary.travelers) bits.push(summary.travelers);
  if (summary.pace) bits.push(summary.pace);
  if (summary.interests) bits.push(summary.interests);

  const leading = bits.join(' · ');

  // Also grab a paragraph from the markdown
  const md: string = plan?.markdown || '';
  let body = '';
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('|')) continue;
    if (line.startsWith('>')) continue;
    if (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line)) continue;
    const cleaned = stripMarkdown(line);
    if (cleaned.length >= 20) {
      body = cleaned;
      break;
    }
  }

  const combined = [leading, body].filter(Boolean).join(' — ');
  const final = combined || meta.fallbackDesc;
  return final.length > 200 ? final.slice(0, 197).trimEnd() + '…' : final;
}

async function fetchPlan(id: string) {
  try {
    const { blobs } = await list({ prefix: `shares/${id}.json` });
    if (!blobs.length) return null;
    const resp = await fetch(blobs[0].url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    console.error('[preview] failed to fetch plan', err);
    return null;
  }
}

async function fetchBaseHtml(host: string, proto: string): Promise<string> {
  // Fetch the pristine index.html (direct path, bypasses our rewrite rule
  // which matches only `/` with a `share` query).
  const url = `${proto}://${host}/index.html`;
  const resp = await fetch(url, { headers: { 'x-preview-bypass': '1' } });
  if (!resp.ok) throw new Error(`index.html fetch failed: ${resp.status}`);
  return await resp.text();
}

function injectMeta(html: string, opts: { title: string; description: string; url: string; lang: string }): string {
  const { title, description, url, lang } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(url);
  const l = escapeHtml(lang);

  let out = html
    .replace(/<html([^>]*)>/, `<html lang="${l}"$1>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/<meta\s+name=["']title["'][^>]*>/, `<meta name="title" content="${t}">`)
    .replace(/<meta\s+name=["']description["'][^>]*>/, `<meta name="description" content="${d}">`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/, `<meta property="og:title" content="${t}">`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/, `<meta property="og:description" content="${d}">`)
    .replace(/<meta\s+property=["']og:url["'][^>]*>/, `<meta property="og:url" content="${u}">`)
    .replace(/<meta\s+name=["']twitter:title["'][^>]*>/, `<meta name="twitter:title" content="${t}">`)
    .replace(/<meta\s+name=["']twitter:description["'][^>]*>/, `<meta name="twitter:description" content="${d}">`)
    .replace(/<meta\s+name=["']twitter:url["'][^>]*>/, `<meta name="twitter:url" content="${u}">`);

  return out;
}

export default async function handler(req: any, res: any) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'trip.tenten.co';
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';

    const rawShare = req.query?.share;
    const rawLang = req.query?.lang;
    const shareId = Array.isArray(rawShare) ? rawShare[0] : rawShare;
    const lang = String(Array.isArray(rawLang) ? rawLang[0] : rawLang || 'en');

    const baseHtml = await fetchBaseHtml(host, proto);

    if (!shareId) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(baseHtml);
    }

    const meta = LANG_META[lang] || LANG_META['en'];
    const plan = await fetchPlan(shareId);

    const title = plan ? extractTitle(plan, meta) : `${meta.fallbackTitle} · ${meta.site}`;
    const description = plan ? extractDescription(plan, meta) : meta.fallbackDesc;
    const url = `${proto}://${host}/?share=${encodeURIComponent(shareId)}&lang=${encodeURIComponent(lang)}`;

    const html = injectMeta(baseHtml, { title, description, url, lang });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Cache at the edge for 5 min, serve stale for 1 day while revalidating.
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.send(html);
  } catch (err: any) {
    console.error('[preview] handler error', err);
    // Degrade gracefully: try to serve the base HTML with no meta injection.
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'trip.tenten.co';
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      const baseHtml = await fetchBaseHtml(host, proto);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(baseHtml);
    } catch {
      return res.status(500).send('Preview error');
    }
  }
}
