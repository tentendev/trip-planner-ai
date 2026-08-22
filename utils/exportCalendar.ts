
import { GeneratedPlan, Language, TripInput } from '../types';

// ---------------------------------------------------------------------------
// Markdown day-section parsing
//
// Three features must agree on how headings map to anchor ids: the heading ids
// rendered by MarkdownRenderer, DayNav's smooth-scroll targets and the .ics
// export. The slug/parsing primitives therefore live here (one source of
// truth) instead of being duplicated per component.
// ---------------------------------------------------------------------------

export interface HeadingInfo {
  level: number;
  text: string;
  anchorId: string;
  lineIndex: number;
}

export interface TripDaySection {
  /** 1-based ordinal of the day among detected day sections */
  index: number;
  /** Day number parsed from the heading itself ("Day 3" -> 3) */
  dayNumber: number;
  title: string;
  /** Matches the id MarkdownRenderer puts on the same heading */
  anchorId: string;
  activities: string[];
}

const FENCE_RE = /^\s{0,3}(```|~~~)/;
const ATX_HEADING_RE = /^ {0,3}(#{2,4})\s+(.+?)\s*#*\s*$/;
const TABLE_ROW_RE = /^\s*\|/;
// A separator/header-delimiter row is made solely of pipes, colons, dashes and spaces.
const TABLE_SEPARATOR_RE = /^[|:\-\s]+$/;
const FULLWIDTH_DIGITS_RE = /[０-９]/g;
// English "Day 12..." and CJK "第12天 / 第十二日" day headings.
const DAY_HEADING_RE = /^(?:day[-\s]*(\d+)|第\s*([0-9一二三四五六七八九十百两零〇]+)\s*[天日])/i;

const CJK_NUMERAL_VALUES: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9,
};

/**
 * Reduce a raw heading line to the text users see: drop emphasis/code markers
 * and bracket syntax (keeping the inner text, since [Context] tags often carry
 * the place name), and normalize fullwidth digits so 第１天 parses like 第1天.
 */
export function normalizeHeadingText(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(FULLWIDTH_DIGITS_RE, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function cjkNumeralToInt(s: string): number {
  if (/^[0-9]+$/.test(s)) return parseInt(s, 10);
  let total = 0;
  let digit = 0;
  for (const ch of s) {
    if (ch in CJK_NUMERAL_VALUES) {
      digit = CJK_NUMERAL_VALUES[ch];
    } else if (ch === '十') {
      total += (digit || 1) * 10;
      digit = 0;
    } else if (ch === '百') {
      total += (digit || 1) * 100;
      digit = 0;
    } else {
      return NaN;
    }
  }
  return total + digit;
}

function dayNumberOf(text: string): number {
  const m = text.match(DAY_HEADING_RE);
  if (!m) return NaN;
  return m[1] ? parseInt(m[1], 10) : cjkNumeralToInt(m[2]);
}

/**
 * Base slug for one heading: day headings collapse to a terse "day-<n>" token
 * (stable even when the rest of the title is CJK); otherwise an ascii slug;
 * headings with neither get a positional "section-<k>" fallback so ids are
 * always ascii-safe and non-empty.
 */
function headingSlugBase(text: string): string | null {
  const n = dayNumberOf(text);
  if (!Number.isNaN(n)) return `day-${n}`;
  const ascii = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || null;
}

export interface HeadingSlugger {
  slug(normalizedText: string): string;
  /** Start a fresh pass; counters are only meaningful within one document. */
  reset(): void;
}

/** Counter keyed by slug base so repeated headings get github-style "-2" suffixes. */
export function createHeadingSlugger(): HeadingSlugger {
  const seen = new Map<string, number>();
  let fallbackCount = 0;
  return {
    reset() {
      seen.clear();
      fallbackCount = 0;
    },
    slug(text) {
      const base = headingSlugBase(text) ?? `section-${++fallbackCount}`;
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return count === 1 ? base : `${base}-${count}`;
    },
  };
}

/**
 * Walk every h2-h4 heading in document order and assign the exact ids the
 * renderer will produce. Code fences are skipped because fenced "#" lines are
 * text, not headings — walking raw lines naively would desync the counters
 * from the rendered result.
 */
export function scanHeadings(markdown: string): HeadingInfo[] {
  const lines = markdown.split('\n');
  const slugger = createHeadingSlugger();
  const out: HeadingInfo[] = [];
  let inFence = false;
  lines.forEach((line, lineIndex) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = line.match(ATX_HEADING_RE);
    if (!m) return;
    const text = normalizeHeadingText(m[2]);
    if (!text) return;
    out.push({ level: m[1].length, text, anchorId: slugger.slug(text), lineIndex });
  });
  return out;
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return TABLE_ROW_RE.test(line) && TABLE_SEPARATOR_RE.test(line) && (line.match(/-/g)?.length ?? 0) >= 3;
}

function cleanActivityText(raw: string): string {
  const cleaned = raw
    .replace(/\[([^\]]*)\]/g, '$1')
    .replace(/[*_~`>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Pure time ranges ("09:00-10:30") carry no place info for maps/calendar.
  if (!cleaned || /^[\d:.．\-\s/~]+$/.test(cleaned)) return '';
  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
}

/** Up to `limit` activity names from a day section: table rows first, then bullets. */
function collectActivities(sectionLines: string[], limit: number): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const cleaned = cleanActivityText(raw);
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
  };

  // The prompt mandates Time Range | Activity | Logistics tables; the header
  // row sits above the separator, so data rows start right after it.
  const sepIdx = sectionLines.findIndex(isTableSeparator);
  if (sepIdx !== -1) {
    for (let i = sepIdx + 1; i < sectionLines.length; i++) {
      if (!TABLE_ROW_RE.test(sectionLines[i])) break;
      const cells = splitTableRow(sectionLines[i]);
      push(cells[1] ?? cells[0] ?? '');
      if (out.length >= limit) return out;
    }
  }
  for (const line of sectionLines) {
    const bullet = line.match(/^\s{0,3}[-*•]\s+(.+)/);
    if (bullet) {
      push(bullet[1]);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function parsePlanDays(markdown: string): TripDaySection[] {
  const headings = scanHeadings(markdown);
  const lines = markdown.split('\n');
  const days: TripDaySection[] = [];
  headings.forEach((heading, i) => {
    const dayNumber = dayNumberOf(heading.text);
    if (Number.isNaN(dayNumber)) return;
    const endLine = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
    days.push({
      index: days.length + 1,
      dayNumber,
      title: heading.text,
      anchorId: heading.anchorId,
      activities: collectActivities(lines.slice(heading.lineIndex + 1, endLine), 4),
    });
  });
  return days;
}

// ---------------------------------------------------------------------------
// RFC 5545 calendar export
// ---------------------------------------------------------------------------

const CRLF = '\r\n';

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const textEncoder = new TextEncoder();

/**
 * Fold content lines longer than 75 octets (RFC 5545 3.1). Char-based chunking
 * with octet accounting never splits a multi-byte character; readers unfold by
 * stripping CRLF+space, so the original line is restored verbatim.
 */
function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let firstSegment = true;
  for (const ch of line) {
    const chBytes = textEncoder.encode(ch).length;
    if (bytes + chBytes > (firstSegment ? 75 : 74)) {
      parts.push(current);
      firstSegment = false;
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += chBytes;
  }
  if (current) parts.push(current);
  return parts.join(`${CRLF} `);
}

/** FNV-1a — tiny, dependency-free content hash for stable event UIDs. */
function contentHashHex(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function parseIsoDate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // Round-trip rejects impossible combos like 2026-02-31.
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? date
    : null;
}

/**
 * TripInput.dates ends in a machine-readable ISO tail built by InputForm:
 * "... · YYYY-MM-DD/YYYY-MM-DD" (or a single "... · YYYY-MM-DD").
 */
function parseTripStartDate(dates?: string): Date | null {
  if (!dates) return null;
  const rangeMatches = [...dates.matchAll(/(\d{4}-\d{2}-\d{2})\s*\/\s*(\d{4}-\d{2}-\d{2})/g)];
  const lastRange = rangeMatches[rangeMatches.length - 1];
  if (lastRange) return parseIsoDate(lastRange[1]);
  const singles = [...dates.matchAll(/(\d{4}-\d{2}-\d{2})/g)];
  const lastSingle = singles[singles.length - 1];
  return lastSingle ? parseIsoDate(lastSingle[1]) : null;
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatDateCompact(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}${month}${day}`;
}

function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Build an RFC 5545 VCALENDAR with one all-day VEVENT per itinerary day.
 * Without usable trip dates, events are sequenced from today and a COMMENT
 * property says so (COMMENT is a valid VEVENT property in RFC 5545).
 */
export function buildIcs(plan: GeneratedPlan, tripInput?: TripInput, lang?: Language): string {
  const destination = tripInput?.destination?.trim() || '';
  const days = parsePlanDays(plan.markdown);
  const startDate = parseTripStartDate(tripInput?.dates);
  const datesKnown = startDate !== null;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trip OS//Itinerary Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (destination) lines.push(`X-WR-CALNAME:${icsEscape(destination)}`);

  days.forEach((day, i) => {
    const dayStart = datesKnown
      ? addDaysUtc(startDate as Date, i)
      : addDaysUtc(todayUtcMidnight(), i);
    lines.push(
      'BEGIN:VEVENT',
      `UID:share-${contentHashHex(plan.markdown)}@tripos`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTSTART;VALUE=DATE:${formatDateCompact(dayStart)}`,
      `DTEND;VALUE=DATE:${formatDateCompact(addDaysUtc(dayStart, 1))}`,
      `SUMMARY:${icsEscape(`${destination || 'Trip'} - Day ${day.index}`)}`,
    );
    if (!datesKnown) {
      const note =
        lang === 'zh-CN' || lang === 'zh-TW'
          ? '未提供行程日期，事件已自今日起依序推算。'
          : 'Trip dates were not provided; events are sequenced starting today.';
      lines.push(`COMMENT:${icsEscape(note)}`);
    }
    if (day.activities.length > 0) {
      lines.push(`DESCRIPTION:${icsEscape(day.activities.join('\n'))}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

function fileSlug(text?: string): string {
  const ascii = (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii || 'trip';
}

/** Build the ICS and trigger a browser download, mirroring the .md export flow. */
export function downloadIcs(plan: GeneratedPlan, tripInput?: TripInput, lang?: Language): void {
  const blob = new Blob([buildIcs(plan, tripInput, lang)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Trip-OS-${fileSlug(tripInput?.destination)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
