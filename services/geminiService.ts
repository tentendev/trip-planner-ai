
import { TripInput, GeneratedPlan, Language, PreAnalysisQuestion } from "../types";

// Export model name for UI display. The actual provider (OpenRouter vs NVIDIA)
// is decided server-side in api/chat.ts based on which env var is set.
export const CURRENT_MODEL = process.env.LLM_DISPLAY_MODEL || 'minimax/minimax-m2.7';

// Calls go through our Vercel serverless proxy (api/chat.ts) which holds the LLM API key
// server-side and avoids browser CORS issues with the upstream provider.
const CHAT_API_URL = '/api/chat';

// Lazy import to avoid a circular dep at module-eval time (travelData.ts imports CURRENT_MODEL).
type TravelDataModule = typeof import('./travelData');
let _travelDataPromise: Promise<TravelDataModule> | null = null;
const getTravelData = (): Promise<TravelDataModule> => {
  if (!_travelDataPromise) _travelDataPromise = import('./travelData');
  return _travelDataPromise;
};

// Base instructions that apply to all languages
const BASE_INSTRUCTION = `
You are "Trip OS", a full-stack AI travel director capable of being a local guide, transport optimizer, budget controller, and risk manager.
Your goal is to produce a complete, actionable, bookable, and optimized itinerary with minimal friction.

## 1) Output Specification (Mandatory)

0. **Weather Intelligence & Strategy**:
   - **Action**: Based on typical weather patterns for the destination and dates.
   - **Logic**: If the trip dates are too far in the future for a reliable forecast (usually >10 days), use historical weather data for that location and time of year as a prediction.
   - **FORMAT**: **Markdown Table** (Do not use lists).
   - **Columns**: **Date** | **Condition (Forecast/Historical)** | **Temp (High/Low)** | **Rain Probability** | **Strategic Advice**.
   - **Rows**: You MUST list a row for **EVERY single day** of the trip.
   - **Key Decision**: Below the table, write one specific strategy summary (e.g., "Due to 80% rain on Day 3, we moved the museum visit to that day").

1. **One-Page Overview (TL;DR)**: Core theme, daily pace, transport strategy, accommodation strategy, budget outline.
2. **Daily Itinerary (Day 1...Day N)**:
   - **FORMAT: MUST BE A MARKDOWN TABLE.**
   - Columns: **Time Range** | **Activity** | **Logistics & Notes**.
   - Morning/Afternoon/Evening blocks + 2-3 "Anchor Activities" + 1 Flex slot.
   - **Precise Timing**: Day 1 and Last Day must strictly follow flight arrival/departure times.
   - Estimate travel time (door-to-door) and method.
   - "Why here": One sentence explaining the logic (geo-clustering/stamina/queues/weather).
3. **Geo-Clustering**: Explain the logic of grouping spots in the same area.
4. **Plan B**: One alternative per day (Rain/Tired/Crowded).
5. **Booking OS**: List of items needing reservation, best time to book, alternatives.
6. **Budget Table**: Accommodation/Transport/Food/Tickets/Misc; Conservative/Standard/Luxury tiers.
7. **Transport Rules**: Commute limits, transfer logic, taxi vs train thresholds.
8. **Risks**: Safety, scams, altitude, local rules.
9. **Packing List**: Use Markdown Checkbox syntax (e.g. - [ ] Passport).

> NOTE: Real-time **flight options** and **hotel options** are rendered by the app as interactive cards ABOVE your output — populated from Google Flights / Google Hotels live data. DO NOT generate those sections in markdown. Do not duplicate them.

## 2) Planning Algorithm

- **Boundaries**: Start Day 1 after arrival+exit time; End Last Day before departure-checkin time.
- Group by location first, then sort by energy curve.
- Max 2-3 anchors per day.
- Minify friction for arrival/departure days.
- Mark uncertain info as [Assumption].

## 3) Constraints

- No wishlists; only actionable schedules.
- High information density, fewer adjectives.
- Use tables for structured data.
`;

const LANGUAGE_INSTRUCTIONS: Record<Language, string> = {
  'en': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN ENGLISH.**
    - Clear and professional tone.
  `,
  'zh-CN': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN SIMPLIFIED CHINESE (Mainland China Usage).**
    - Use terms like "出租车" not "计程车", "公交车" not "公车".
    - Currency format: CNY, JPY, USD etc.
  `,
  'zh-TW': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN TRADITIONAL CHINESE (Taiwan Usage).**
    - Use terms like "計程車" not "出租車", "公車" not "公交車".
    - Currency format: TWD, JPY, USD etc.
  `,
  'ja': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN JAPANESE.**
    - Natural Japanese phrasing for travel.
    - Use polite tone (Desu/Masu).
  `,
  'ko': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN KOREAN.**
    - Use natural Korean travel terminology.
    - Currency: KRW, JPY, USD.
  `,
  'hi': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN HINDI.**
    - Use formal but accessible Hindi.
  `,
  'es': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN SPANISH.**
    - Use neutral Spanish (suitable for international travelers).
  `,
  'fr': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN FRENCH.**
    - Use professional French.
  `,
  'ar': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN ARABIC.**
    - Output text direction must be RTL friendly logic (though Markdown is plain text).
    - Use Modern Standard Arabic.
  `,
  'pt': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN PORTUGUESE.**
    - Use Portuguese (adaptable for BR/PT, focus on clarity).
  `,
  'ru': `
    ${BASE_INSTRUCTION}
    **IMPORTANT: OUTPUT MUST BE IN RUSSIAN.**
    - Use standard Russian travel terminology.
  `
};

export const buildUserPrompt = (input: TripInput, lang: Language, preAnalysisAnswers?: Record<string, string[]>, preAnalysisQuestions?: PreAnalysisQuestion[]): string => {
  const fields: { label: string; value: string }[] = [
    { label: 'Destination', value: input.destination },
    { label: 'Arrival', value: input.arrivalDetail },
    { label: 'Departure', value: input.departureDetail },
    { label: 'Dates', value: input.dates },
    { label: 'Travelers', value: input.travelers },
    { label: 'Budget', value: input.budget },
    { label: 'Pace', value: input.pace },
    { label: 'Interests', value: input.interests },
    { label: 'Must Dos', value: input.mustDos },
    { label: 'Constraints', value: input.constraints },
    { label: 'Accommodation Prefs', value: input.accommodation },
    { label: 'Transport Prefs', value: input.transportPref },
    { label: 'Diet', value: input.diet },
    { label: 'Work/Shopping', value: input.work },
    { label: 'Existing Bookings', value: input.bookings },
    { label: 'Other', value: input.other },
  ];

  const filledFields = fields
    .filter(f => f.value && f.value.trim() !== '')
    .map(f => `- ${f.label}: ${f.value}`)
    .join('\n');

  let prompt = `Trip OS Input Data:\n${filledFields}`;

  // Append pre-analysis refinements if user answered any questions
  if (preAnalysisAnswers) {
    const answeredEntries = Object.entries(preAnalysisAnswers).filter(([, vals]) => vals.length > 0);
    if (answeredEntries.length > 0) {
      const questionMap = new Map(preAnalysisQuestions?.map(q => [q.id, q.question]) || []);
      prompt += `\n\n## User Refinements (from pre-analysis Q&A — integrate these preferences deeply into the itinerary):\n`;
      answeredEntries.forEach(([questionId, selections]) => {
        const questionText = questionMap.get(questionId) || questionId;
        prompt += `- Q: ${questionText}\n  A: ${selections.join(', ')}\n`;
      });
    }
  }

  prompt += `\n\nPlease generate the Trip OS plan following the system instructions.\nLanguage Requirement: ${lang}`;
  return prompt;
};

export const buildFullPrompt = (input: TripInput, lang: Language, preAnalysisAnswers?: Record<string, string[]>, preAnalysisQuestions?: PreAnalysisQuestion[]): string => {
  const systemInstruction = LANGUAGE_INSTRUCTIONS[lang];
  const userPrompt = buildUserPrompt(input, lang, preAnalysisAnswers, preAnalysisQuestions);
  return `[System]\n${systemInstruction.trim()}\n\n[User]\n${userPrompt}`;
};

const PRE_ANALYSIS_PROMPT = `You are "Trip OS Pre-Analyzer". Given the user's trip input, generate 4-6 smart follow-up questions that would significantly improve the itinerary quality.

For each question:
- Identify gaps, assumptions, or opportunities in the user's input
- Suggest specific options relevant to their destination and travel style
- Cover areas like: must-visit spots they might have missed, local experiences, timing optimization, hidden gems, practical concerns, food/dining specifics, neighborhood preferences

You MUST respond with ONLY a valid JSON array. No markdown, no explanation, no code fences. Just the raw JSON array.

Each object in the array must have:
- "id": unique string (q1, q2, ...)
- "question": the question text
- "options": array of 3-6 specific, actionable options (not generic)
- "allowMultiple": boolean (true if user can pick more than one)

Make options SPECIFIC to the destination. For example, if going to Tokyo, don't say "Local food" — say "Tsukiji Outer Market sushi breakfast", "Shibuya izakaya hopping", etc.`;

export const preAnalyzeTrip = async (input: TripInput, lang: Language): Promise<PreAnalysisQuestion[]> => {
  const model = CURRENT_MODEL;
  const userPrompt = buildUserPrompt(input, lang);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `${PRE_ANALYSIS_PROMPT}\n\nIMPORTANT: All questions and options MUST be in ${lang}. Respond ONLY with a JSON array.` },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.detail || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No content in pre-analysis response");

    // Parse JSON from response, stripping any markdown fences
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const questions: PreAnalysisQuestion[] = JSON.parse(jsonStr);

    return questions.map((q: any) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      selected: [],
      allowMultiple: q.allowMultiple ?? true
    }));
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("Pre-analysis timed out. Please try again.");
    }
    throw error;
  }
};

export const generateTripPlan = async (input: TripInput, lang: Language = 'zh-TW', preAnalysisAnswers?: Record<string, string[]>, preAnalysisQuestions?: PreAnalysisQuestion[]): Promise<GeneratedPlan> => {
  const model = CURRENT_MODEL;
  const baseSystemInstruction = LANGUAGE_INSTRUCTIONS[lang];
  const userPrompt = buildUserPrompt(input, lang, preAnalysisAnswers, preAnalysisQuestions);

  // Fetch real-time flight + hotel data from SerpAPI before generating the itinerary.
  // Failures are non-fatal: we degrade to the original generation flow.
  let travelDataBlock = '';
  let travelData: import('./travelData').TravelData | null = null;
  try {
    const { gatherTravelData, formatTravelDataForPrompt } = await getTravelData();
    travelData = await gatherTravelData(input, lang);
    travelDataBlock = formatTravelDataForPrompt(travelData);
    console.log('[geminiService] travel data gathered', {
      hasFlights: !!travelData?.flights?.length,
      hasHotels: !!travelData?.hotels?.length,
      params: travelData?.params,
      errors: travelData?.errors,
    });
  } catch (err) {
    console.warn('[geminiService] travel data fetch failed, continuing without real-time data', err);
  }

  const systemInstruction = travelDataBlock
    ? `${baseSystemInstruction}\n\n---\n${travelDataBlock}`
    : baseSystemInstruction;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 295000);

    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.4,
        // Request SSE — long generations (>5min for big models) would otherwise hit
        // the Vercel function 300s ceiling before any body bytes were written.
        stream: true
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API Response Error:", response.status, errorData);
      const upstreamMsg =
        errorData.upstream_body?.error?.message ||
        errorData.upstream_body?.detail ||
        errorData.upstream_body?.message ||
        (typeof errorData.upstream_body === 'string' ? errorData.upstream_body : null) ||
        errorData.error?.message ||
        errorData.error ||
        errorData.detail;
      throw new Error(upstreamMsg ? `${response.status}: ${upstreamMsg}` : `API error: ${response.status}`);
    }

    if (!response.body) throw new Error("No response body");

    const content = await readSSEContent(response.body);

    console.log("API Response received:", { content_chars: content.length });

    if (!content) throw new Error("No content in response");

    return {
      markdown: content,
      sources: [],
      flights: travelData?.flights || undefined,
      hotels: travelData?.hotels || undefined,
      searchParams: travelData?.params || undefined,
      flightPriceInsights: travelData?.flight_price_insights || undefined,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("Request timed out after ~5 minutes");
      throw new Error("Request timed out after ~5 minutes. The model may be overloaded — please try again or switch to a faster model in OPENROUTER_MODEL.");
    }
    console.error("LLM API Error:", error);
    throw error;
  }
};

/**
 * Read an SSE stream of OpenAI-format chat completion chunks and return the
 * concatenated assistant content. Tolerates malformed chunks and the [DONE] sentinel.
 */
async function readSSEContent(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

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
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch {
        // ignore malformed chunks
      }
    }
  }
  return content;
}
