
import { TripInput, GeneratedPlan, Language } from "../types";

// Export model name for UI display
export const CURRENT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

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
7. **Accommodation**: Suggest 2-3 "Areas" (not specific hotels unless unique), pros/cons.
8. **Transport Rules**: Commute limits, transfer logic, taxi vs train thresholds.
9. **Risks**: Safety, scams, altitude, local rules.
10. **Packing List**: Use Markdown Checkbox syntax (e.g. - [ ] Passport).

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

export const generateTripPlan = async (input: TripInput, lang: Language = 'zh-TW'): Promise<GeneratedPlan> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = CURRENT_MODEL;

  if (!apiKey) {
    throw new Error("API Key is missing. Please set process.env.OPENROUTER_API_KEY.");
  }

  const systemInstruction = LANGUAGE_INSTRUCTIONS[lang];

  const userPrompt = `
  Trip OS Input Data:
  - Destination: ${input.destination}
  - Arrival: ${input.arrivalDetail}
  - Departure: ${input.departureDetail}
  - Dates: ${input.dates}
  - Travelers: ${input.travelers}
  - Budget: ${input.budget}
  - Pace: ${input.pace}
  - Interests: ${input.interests}
  - Must Dos: ${input.mustDos}
  - Constraints: ${input.constraints}
  - Accommodation Prefs: ${input.accommodation}
  - Transport Prefs: ${input.transportPref}
  - Diet: ${input.diet}
  - Work/Shopping: ${input.work}
  - Existing Bookings: ${input.bookings}
  - Other: ${input.other}

  Please generate the Trip OS plan following the system instructions.
  Language Requirement: ${lang}
  `;

  try {
    // Create AbortController for timeout (3 minutes for complex itineraries)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Trip OS - AI Travel Planner"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: systemInstruction
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.4
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API Response Error:", response.status, errorData);
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("API Response received:", {
      model: data.model,
      hasChoices: !!data.choices?.length,
      hasContent: !!data.choices?.[0]?.message?.content
    });

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in response:", data);
      throw new Error("No content in response");
    }

    return {
      markdown: content,
      sources: []
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("Request timed out after 3 minutes");
      throw new Error("Request timed out. Please try again.");
    }
    console.error("OpenRouter API Error:", error);
    throw error;
  }
};
