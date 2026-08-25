
import { Language } from '../types';
import { FriendlyError } from './geminiService';
import { parsePlanDays, scanHeadings } from '../utils/exportCalendar';

/**
 * Scoped day regeneration ("regenerate just Day N").
 *
 * Full-plan regeneration destroys trust — travelers lose the days they already
 * liked — so this service swaps exactly one day section and splices it back
 * into the markdown. Section boundaries come exclusively from the shared
 * parsers in utils/exportCalendar (scanHeadings + parsePlanDays); duplicating
 * heading/day parsing here would let the editor and the renderer disagree
 * about where a day ends.
 */

const CHAT_API_URL = '/api/chat';

// api/chat rejects any message over 32k chars; leave headroom for the prompt
// wrapper so large plans get a compacted context instead of a 400.
const PLAN_CONTEXT_BUDGET_CHARS = 26_000;

export interface RegenerateDayParams {
  markdown: string;
  dayNumber: number;
  destination?: string;
  language?: Language;
  /** Free-text steer, e.g. "make it less busy" or "rain alternatives" */
  hint?: string;
  signal?: AbortSignal;
  /**
   * Called once with the model's raw day output. The endpoint is consumed
   * non-streaming (simpler, and a single day is short), so there is no real
   * delta stream today — the hook exists so a streaming upgrade slots in
   * without changing callers.
   */
  onDelta?: (content: string) => void;
}

// Reuses geminiService's error-code vocabulary where one exists so operator-side
// copy mapping stays uniform; EDIT_* codes are local to scoped editing.
type EditErrorCode =
  | 'RATE_LIMITED'
  | 'UPSTREAM_BUSY'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'CONFIG_ERROR'
  | 'FORBIDDEN_ORIGIN'
  | 'BAD_REQUEST'
  | 'PROXY_ERROR'
  | 'EDIT_INVALID_RESPONSE';

const KNOWN_PROXY_CODES: readonly string[] = [
  'CONFIG_ERROR',
  'RATE_LIMITED',
  'TIMEOUT',
  'UPSTREAM_BUSY',
  'UPSTREAM_ERROR',
  'FORBIDDEN_ORIGIN',
  'BAD_REQUEST',
  'PROXY_ERROR',
];

interface DaySectionRange {
  startLine: number;
  endLine: number;
  level: number;
  title: string;
}

/**
 * Line range of one day's section: its heading line through the line before
 * the next heading at the same or shallower level (or EOF). Deeper headings
 * (sub-sections inside the day) stay in-range, while any sibling section that
 * follows — including non-day sections after the final day, like the demo's
 * "## 3. Geo-Clustering Logic" — terminates the range instead of being
 * swallowed. anchorIds are deterministic functions of the document, so
 * cross-referencing parsePlanDays results with scanHeadings is safe.
 */
function findDaySectionRange(markdown: string, dayNumber: number): DaySectionRange | null {
  const headings = scanHeadings(markdown);
  const target = parsePlanDays(markdown).find((d) => d.dayNumber === dayNumber);
  if (!target) return null;
  const startIdx = headings.findIndex((h) => h.anchorId === target.anchorId);
  if (startIdx === -1) return null;
  const start = headings[startIdx];
  const lineCount = markdown.split('\n').length;
  let endLine = lineCount;
  for (let i = startIdx + 1; i < headings.length; i++) {
    if (headings[i].level <= start.level) {
      endLine = headings[i].lineIndex;
      break;
    }
  }
  return { startLine: start.lineIndex, endLine, level: start.level, title: start.text };
}

function trimBlankEdges(lines: string[]): string[] {
  const out = [...lines];
  while (out.length && out[0].trim() === '') out.shift();
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

/**
 * Replace the lines of Day `dayNumber`'s section with `replacement`, keeping
 * everything before and after byte-identical. Pure: no parsing side effects,
 * throws when the plan has no such day.
 */
export function spliceDaySection(markdown: string, dayNumber: number, replacement: string): string {
  const range = findDaySectionRange(markdown, dayNumber);
  if (!range) throw new Error(`spliceDaySection: no Day ${dayNumber} section found`);
  const lines = markdown.split('\n');
  const before = lines.slice(0, range.startLine);
  const after = lines.slice(range.endLine);
  // Models emit \r\n and padding blank lines regardless of instructions.
  const body = trimBlankEdges(replacement.replace(/\r\n/g, '\n').split('\n'));
  const head = before.length ? `${before.join('\n')}\n\n` : '';
  const tail = after.length ? `\n\n${after.join('\n')}` : '\n';
  return `${head}${body.join('\n')}${tail}`;
}

/**
 * Pull just the requested day's markdown out of a raw model response. Models
 * prepend commentary ("Sure! Here is...") or wrap output in fences even when
 * told not to, so: unwrap a fenced block if present, cut from the first
 * heading line to the next same-or-shallower heading (dropping leading and
 * trailing prose), then verify the surviving block actually contains the
 * requested day. Returns null when anything about the shape is wrong — callers
 * treat that as an error.
 */
export function extractDaySection(modelOutput: string, dayNumber: number): string | null {
  const text = modelOutput.replace(/\r\n/g, '\n').trim();
  // scanHeadings deliberately ignores fenced lines (a "#" in a code block is
  // text, not a heading), so a model that wraps the whole answer in ``` hides
  // the very heading we need. Unwrap the outermost fence pair first; if that
  // guess is wrong, retry against the raw text.
  return tryExtract(unwrapOuterFence(text), dayNumber) ?? tryExtract(text, dayNumber);
}

/** Content between the first fence-open and the last fence-close, else input. */
function unwrapOuterFence(text: string): string {
  const lines = text.split('\n');
  const open = lines.findIndex((line) => /^\s{0,3}```/.test(line));
  if (open === -1) return text;
  let close = -1;
  for (let i = lines.length - 1; i > open; i--) {
    if (/^\s{0,3}```\s*$/.test(lines[i])) {
      close = i;
      break;
    }
  }
  if (close === -1) return text;
  const inner = trimBlankEdges(lines.slice(open + 1, close)).join('\n');
  return inner || text;
}

function tryExtract(text: string, dayNumber: number): string | null {
  const headings = scanHeadings(text);
  if (headings.length === 0) return null;
  const first = headings[0];
  const lines = text.split('\n');
  let endLine = lines.length;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level <= first.level) {
      endLine = headings[i].lineIndex;
      break;
    }
  }
  const section = trimBlankEdges(lines.slice(first.lineIndex, endLine)).join('\n').trim();
  if (!section) return null;
  // The contract: what we splice back must contain the day we were asked for.
  return parsePlanDays(section).some((d) => d.dayNumber === dayNumber) ? section : null;
}

const SYSTEM_PROMPT =
  'You are Trip OS editing one day of an existing itinerary. Return ONLY the replacement markdown section for the specified day, same table format (Time Range | Activity | Logistics & Notes), same language as the surrounding plan, same overall style. Do not repeat other days.';

/**
 * Whole-plan context normally fits the proxy limit; when it does not, keep the
 * target day verbatim and pad with as much surrounding plan as fits (tail of
 * the prefix + head of the suffix), since adjacent days carry the language and
 * pacing style the edit must match.
 */
function clampPlanContext(markdown: string, range: DaySectionRange): string {
  if (markdown.length <= PLAN_CONTEXT_BUDGET_CHARS) return markdown;
  const lines = markdown.split('\n');
  const section = lines.slice(range.startLine, range.endLine).join('\n');
  const remaining = PLAN_CONTEXT_BUDGET_CHARS - section.length - 80;
  if (remaining <= 0) return section;
  const halfBudget = Math.floor(remaining / 2);
  const takeTail = (lines: string[], budget: number): string => {
    const out: string[] = [];
    let used = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      used += lines[i].length + 1;
      if (used > budget) break;
      out.unshift(lines[i]);
    }
    return out.join('\n');
  };
  const takeHead = (lines: string[], budget: number): string => {
    const out: string[] = [];
    let used = 0;
    for (const line of lines) {
      used += line.length + 1;
      if (used > budget) break;
      out.push(line);
    }
    return out.join('\n');
  };
  return [
    '[... earlier plan omitted ...]',
    takeTail(lines.slice(0, range.startLine), halfBudget),
    section,
    takeHead(lines.slice(range.endLine), halfBudget),
    '[... later plan omitted ...]',
  ]
    .filter((part) => part.trim().length > 0)
    .join('\n');
}

function buildMessages(params: RegenerateDayParams, range: DaySectionRange) {
  const bits: string[] = ['Here is the current itinerary plan:', '', clampPlanContext(params.markdown, range), ''];
  bits.push(`Replace ONLY Day ${params.dayNumber} (title: "${range.title}").`);
  bits.push('Return the complete replacement section for that day, starting with its heading in the exact same format.');
  if (params.destination?.trim()) {
    bits.push(`Trip destination: ${params.destination.trim()}.`);
  }
  const hint = params.hint?.trim();
  if (hint) {
    bits.push(`The traveler asked for this adjustment: "${hint}". Honor it while keeping the day realistic and bookable.`);
  } else {
    bits.push('No specific request: refresh the activities and logistics for variety while keeping the day\'s defining anchors.');
  }
  if (params.language) {
    // Belt-and-braces alongside the system rule; truncation can drop the
    // plan header that otherwise establishes the language.
    bits.push('Respond in the same language as the plan.');
  }
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: bits.join('\n') },
  ];
}

/**
 * Regenerate one day of the plan via /api/chat (non-streaming: the proxy
 * accumulates upstream SSE and answers `{choices:[{message:{content}}]}`).
 * Resolves with the FULL new plan markdown (only Day N changed); rejects with
 * FriendlyError carrying a machine code the UI maps to localized copy.
 */
export async function regenerateDay(params: RegenerateDayParams): Promise<string> {
  const range = findDaySectionRange(params.markdown, params.dayNumber);
  if (!range) throw new Error(`regenerateDay: no Day ${params.dayNumber} section found`);

  let response: Response;
  try {
    response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: buildMessages(params, range),
        temperature: 0.6,
        max_tokens: 4000,
      }),
      signal: params.signal,
    });
  } catch (err: unknown) {
    // Let AbortError pass through untouched — cancellation is not a failure.
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new FriendlyError('NETWORK', err instanceof Error ? err.message : 'network error');
  }

  if (!response.ok) {
    const data: any = await response.json().catch(() => ({}));
    const rawCode = typeof data?.code === 'string' ? data.code.toUpperCase() : '';
    const code: EditErrorCode =
      response.status === 429
        ? 'RATE_LIMITED'
        : KNOWN_PROXY_CODES.includes(rawCode)
          ? (rawCode as EditErrorCode)
          : response.status >= 500
            ? 'UPSTREAM_BUSY'
            : 'UPSTREAM_ERROR';
    console.error('[planEdit] regenerate failed', { status: response.status, code, detail: data });
    throw new FriendlyError(code, typeof data?.error === 'string' ? data.error : `HTTP ${response.status}`);
  }

  const data: any = await response.json().catch(() => null);
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new FriendlyError('UPSTREAM_ERROR', 'empty completion');
  }
  params.onDelta?.(content);

  const section = extractDaySection(content, params.dayNumber);
  if (!section) {
    throw new FriendlyError('EDIT_INVALID_RESPONSE', 'model output did not contain a usable replacement for the requested day');
  }
  return spliceDaySection(params.markdown, params.dayNumber, section);
}
