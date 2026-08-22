
import { TripInput, GeneratedPlan, Language, PreAnalysisQuestion } from "../types";

// Export model name for UI display. The actual provider (OpenRouter vs NVIDIA)
// is decided server-side in api/chat.ts based on which env var is set.
export const CURRENT_MODEL = process.env.LLM_DISPLAY_MODEL || 'minimax/minimax-m2.7';

// Calls go through our Vercel serverless proxy (api/chat.ts) which holds the LLM API key
// server-side and avoids browser CORS issues with the upstream provider.
const CHAT_API_URL = '/api/chat';

/**
 * Errors carrying a user-facing, localized message. The proxy returns machine-readable
 * `code`s; we translate them into action-oriented copy instead of surfacing operator
 * details (env var names, upstream bodies) to end users.
 */
export class FriendlyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FriendlyError';
    this.code = code;
  }
}

type ErrorCode = 'CONFIG_ERROR' | 'RATE_LIMITED' | 'TIMEOUT' | 'UPSTREAM_BUSY' | 'UPSTREAM_ERROR' | 'FORBIDDEN_ORIGIN' | 'BAD_REQUEST' | 'PROXY_ERROR' | 'NETWORK' | 'INTERRUPTED';

const FRIENDLY_MESSAGES: Record<ErrorCode, Record<Language, string>> = {
  CONFIG_ERROR: {
    en: 'The trip planner is temporarily unavailable. Please try again later.',
    'zh-TW': '旅遊規劃服務暫時無法使用，請稍後再試。',
    'zh-CN': '旅行规划服务暂时不可用，请稍后再试。',
    ja: 'トリッププランナーは一時的に利用できません。後でもう一度お試しください。',
    ko: '여행 플래너를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    hi: 'ट्रिप प्लानर अस्थायी रूप से उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।',
    es: 'El planificador de viajes no está disponible temporalmente. Inténtalo más tarde.',
    fr: "Le planificateur de voyage est temporairement indisponible. Réessayez plus tard.",
    ar: 'مخطط الرحلات غير متاح مؤقتًا. يرجى المحاولة لاحقًا.',
    pt: 'O planejador de viagens está temporariamente indisponível. Tente novamente mais tarde.',
    ru: 'Планировщик путешествий временно недоступен. Попробуйте позже.',
  },
  RATE_LIMITED: {
    en: 'You’re planning trips faster than we can keep up! Please wait about a minute and try again.',
    'zh-TW': '你的規劃速度太快了！請等待約一分鐘後再試。',
    'zh-CN': '你的规划速度太快了！请等待约一分钟后再试。',
    ja: 'リクエストが集中しています。約1分待ってからもう一度お試しください。',
    ko: '요청이 너무 많습니다. 약 1분 후에 다시 시도해 주세요.',
    hi: 'आपके अनुरोध बहुत तेज़ हैं! कृपया लगभग एक मिनट प्रतीक्षा करें और फिर से प्रयास करें।',
    es: '¡Vas más rápido de lo que podemos seguir! Espera alrededor de un minuto e inténtalo de nuevo.',
    fr: "Vous allez plus vite que nous ! Patientez environ une minute avant de réessayer.",
    ar: 'أنت تخطط أسرع مما نستطيع مواكبة! يرجى الانتظار حوالي دقيقة والمحاولة مجددًا.',
    pt: 'Você está planejando rápido demais! Aguarde cerca de um minuto e tente novamente.',
    ru: 'Вы планируете слишком быстро! Подождите около минуты и попробуйте снова.',
  },
  TIMEOUT: {
    en: 'Generation took too long and was stopped. Please try again — complex trips can take a couple of minutes.',
    'zh-TW': '生成時間過長已中止。請再試一次——複雜的行程可能需要幾分鐘。',
    'zh-CN': '生成时间过长已中止。请再试一次——复杂的行程可能需要几分钟。',
    ja: '生成に時間がかかりすぎたため中止しました。もう一度お試しください（複雑な旅程は数分かかる場合があります）。',
    ko: '생성 시간이 너무 길어 중단되었습니다. 다시 시도해 주세요.',
    hi: 'जनरेशन में बहुत समय लगा और इसे रोक दिया गया। कृपया पुनः प्रयास करें।',
    es: 'La generación tardó demasiado y se detuvo. Inténtalo de nuevo.',
    fr: "La génération a pris trop de temps et a été interrompue. Veuillez réessayer.",
    ar: 'استغرق الإنشاء وقتًا طويلاً جدًا وتم إيقافه. يرجى المحاولة مرة أخرى.',
    pt: 'A geração demorou demais e foi interrompida. Tente novamente.',
    ru: 'Генерация заняла слишком много времени и была остановлена. Попробуйте снова.',
  },
  UPSTREAM_BUSY: {
    en: 'The AI planner is very busy right now. Please try again in a minute.',
    'zh-TW': 'AI 規劃系統目前非常忙碌，請一分鐘後再試。',
    'zh-CN': 'AI 规划系统目前非常忙碌，请一分钟后再试。',
    ja: 'AIプランナーが大変混み合っています。1分後に再度お試しください。',
    ko: 'AI 플래너가 현재 매우 혼잡합니다. 1분 후 다시 시도해 주세요.',
    hi: 'AI प्लानर अभी बहुत व्यस्त है। कृपया एक मिनट में पुनः प्रयास करें।',
    es: 'El planificador con IA está muy ocupado ahora mismo. Inténtalo en un minuto.',
    fr: "Le planificateur IA est très occupé actuellement. Réessayez dans une minute.",
    ar: 'مخطط الذكاء الاصطناعي مشغول جدًا الآن. يرجى المحاولة بعد دقيقة.',
    pt: 'O planejador com IA está muito ocupado agora. Tente em um minuto.',
    ru: 'ИИ-планировщик сейчас очень загружен. Попробуйте через минуту.',
  },
  UPSTREAM_ERROR: {
    en: 'Something went wrong while generating your plan. Please try again.',
    'zh-TW': '生成行程時發生錯誤，請再試一次。',
    'zh-CN': '生成行程时发生错误，请再试一次。',
    ja: 'プランの生成中にエラーが発生しました。もう一度お試しください。',
    ko: '일정 생성 중 오류가 발생했습니다. 다시 시도해 주세요.',
    hi: 'आपकी योजना बनाते समय कुछ गलत हो गया। कृपया पुनः प्रयास करें।',
    es: 'Algo salió mal al generar tu plan. Inténtalo de nuevo.',
    fr: "Une erreur est survenue lors de la génération de votre plan. Veuillez réessayer.",
    ar: 'حدث خطأ أثناء إنشاء خطتك. يرجى المحاولة مرة أخرى.',
    pt: 'Algo deu errado ao gerar seu plano. Tente novamente.',
    ru: 'Произошла ошибка при создании вашего плана. Попробуйте снова.',
  },
  FORBIDDEN_ORIGIN: {
    en: 'This planner can only be used from its official website.',
    'zh-TW': '此規劃工具僅能從官方網站使用。',
    'zh-CN': '此规划工具仅能从官方网站使用。',
    ja: 'このプランナーは公式サイトからのみ利用できます。',
    ko: '이 플래너는 공식 웹사이트에서만 사용할 수 있습니다.',
    hi: 'इस प्लानर का उपयोग केवल आधिकारिक वेबसाइट से किया जा सकता है।',
    es: 'Este planificador solo puede usarse desde su sitio web oficial.',
    fr: "Ce planificateur ne peut être utilisé que depuis son site officiel.",
    ar: 'يمكن استخدام هذا المخطط من موقعه الرسمي فقط.',
    pt: 'Este planejador só pode ser usado no site oficial.',
    ru: 'Этот планировщик доступен только на официальном сайте.',
  },
  BAD_REQUEST: {
    en: 'Your request could not be processed. Please adjust your trip details and try again.',
    'zh-TW': '無法處理你的請求，請調整行程資訊後再試。',
    'zh-CN': '无法处理你的请求，请调整行程信息后再试。',
    ja: 'リクエストを処理できませんでした。内容を確認してもう一度お試しください。',
    ko: '요청을 처리할 수 없습니다. 여행 정보를 조정한 후 다시 시도해 주세요.',
    hi: 'आपका अनुरोध संसाधित नहीं हो सका। कृपया यात्रा विवरण समायोजित करें।',
    es: 'No se pudo procesar tu solicitud. Ajusta los detalles del viaje e inténtalo de nuevo.',
    fr: "Votre demande n'a pas pu être traitée. Ajustez les détails du voyage et réessayez.",
    ar: 'تعذر معالجة طلبك. يرجى تعديل تفاصيل الرحلة والمحاولة مرة أخرى.',
    pt: 'Não foi possível processar sua solicitação. Ajuste os detalhes da viagem e tente novamente.',
    ru: 'Не удалось обработать запрос. Скорректируйте детали поездки и попробуйте снова.',
  },
  PROXY_ERROR: {
    en: 'Something went wrong on our end. Please try again in a moment.',
    'zh-TW': '我們這邊發生錯誤，請稍候再試。',
    'zh-CN': '我们这边发生错误，请稍候再试。',
    ja: 'サーバー側でエラーが発生しました。しばらくしてからもう一度お試しください。',
    ko: '서버 측에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    hi: 'हमारे अंत में कुछ गलत हो गया। कृपया थोड़ी देर में पुनः प्रयास करें।',
    es: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.',
    fr: "Une erreur est survenue de notre côté. Réessayez dans un instant.",
    ar: 'حدث خطأ في موقعنا. يرجى المحاولة بعد قليل.',
    pt: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
    ru: 'На нашей стороне произошла ошибка. Попробуйте чуть позже.',
  },
  NETWORK: {
    en: 'Network connection lost. Please check your internet and try again.',
    'zh-TW': '網路連線中斷，請檢查網路後再試。',
    'zh-CN': '网络连接中断，请检查网络后再试。',
    ja: 'ネットワーク接続が切断されました。接続を確認してもう一度お試しください。',
    ko: '네트워크 연결이 끊겼습니다. 인터넷을 확인하고 다시 시도해 주세요.',
    hi: 'नेटवर्क कनेक्शन बाधित हुआ। कृपया अपना इंटरनेट जांचें और पुनः प्रयास करें।',
    es: 'Se perdió la conexión de red. Comprueba tu internet e inténtalo de nuevo.',
    fr: "Connexion réseau perdue. Vérifiez votre connexion et réessayez.",
    ar: 'انقطع الاتصال بالشبكة. يرجى التحقق من اتصالك والمحاولة مرة أخرى.',
    pt: 'Conexão de rede perdida. Verifique sua internet e tente novamente.',
    ru: 'Сетевое соединение потеряно. Проверьте интернет и попробуйте снова.',
  },
  INTERRUPTED: {
    en: 'Generation was interrupted partway through. Please regenerate to get the complete plan.',
    'zh-TW': '生成中途被中斷，請重新產生以取得完整行程。',
    'zh-CN': '生成中途被打断，请重新生成以获取完整行程。',
    ja: '生成の途中で中断されました。完全なプランを取得するには再生成してください。',
    ko: '생성 도중 중단되었습니다. 전체 일정을 받으려면 다시 생성해 주세요.',
    hi: 'जनरेशन बीच में रुक गया। पूरी योजना के लिए कृपया फिर से जेनरेट करें।',
    es: 'La generación se interrumpió a mitad de camino. Regenera para obtener el plan completo.',
    fr: "La génération a été interrompue à mi-chemin. Régénérez pour obtenir le plan complet.",
    ar: 'تمت مقاطعة الإنشاء في منتصفه. أعد الإنشاء للحصول على الخطة الكاملة.',
    pt: 'A geração foi interrompida no meio. Regenere para obter o plano completo.',
    ru: 'Генерация прервана на середине. Перегенерируйте, чтобы получить полный план.',
  },
};

function friendlyFromResponse(status: number, data: any, lang: Language): Error {
  const rawCode = typeof data?.code === 'string' ? data.code.toUpperCase() : '';
  const code = (rawCode && rawCode in FRIENDLY_MESSAGES ? rawCode : status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR') as ErrorCode;
  console.error('[geminiService] API error', { status, code, detail: data });
  return new FriendlyError(code, FRIENDLY_MESSAGES[code][lang] || FRIENDLY_MESSAGES[code].en);
}

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
      // Pre-analysis is optional UX — surface a quiet, friendly failure; App falls
      // back to direct generation.
      const code = typeof errorData?.code === 'string' ? errorData.code.toUpperCase() : 'UPSTREAM_ERROR';
      throw new FriendlyError(code in FRIENDLY_MESSAGES ? code : 'UPSTREAM_ERROR',
        (FRIENDLY_MESSAGES as any)[code === 'CONFIG_ERROR' ? 'CONFIG_ERROR' : 'UPSTREAM_ERROR'][lang] || 'Pre-analysis unavailable');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) throw new Error("No content in pre-analysis response");

    // Parse defensively: models sometimes wrap the JSON in commentary or fences.
    // Strip fences, then extract the first [...] block instead of parsing blind.
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Pre-analysis response contained no JSON array");

    const raw: any = JSON.parse(match[0]);
    if (!Array.isArray(raw)) throw new Error("Pre-analysis JSON was not an array");

    // Validate each entry; drop malformed ones instead of crashing the flow.
    const questions: PreAnalysisQuestion[] = [];
    const seenIds = new Set<string>();
    raw.forEach((q: any, i: number) => {
      if (!q || typeof q.question !== 'string' || !q.question.trim()) return;
      if (!Array.isArray(q.options)) return;
      const options = q.options.filter((o: any) => typeof o === 'string' && o.trim());
      if (options.length < 2) return;
      let id = typeof q.id === 'string' && q.id.trim() ? q.id : `q${i + 1}`;
      while (seenIds.has(id)) id = `${id}_x`;
      seenIds.add(id);
      questions.push({
        id,
        question: q.question,
        options: options.slice(0, 8),
        selected: [],
        allowMultiple: q.allowMultiple !== false,
      });
    });

    if (questions.length === 0) throw new Error("Pre-analysis returned no usable questions");

    return questions;
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
      throw friendlyFromResponse(response.status, errorData, lang);
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
      const msg = FRIENDLY_MESSAGES.TIMEOUT[lang] || FRIENDLY_MESSAGES.TIMEOUT.en;
      throw new FriendlyError('TIMEOUT', msg);
    }
    if (error instanceof TypeError) {
      // fetch-level failure (offline, DNS) — surface as network issue, not raw TypeError
      console.error("LLM API network error:", error);
      throw new FriendlyError('NETWORK', FRIENDLY_MESSAGES.NETWORK[lang] || FRIENDLY_MESSAGES.NETWORK.en);
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
  let upstreamError: string | null = null;

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
        if (chunk.error) {
          upstreamError = chunk.error.message || JSON.stringify(chunk.error);
          continue;
        }
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch {
        // ignore malformed chunks
      }
    }
  }
  // An upstream error after partial output means the plan is TRUNCATED — shipping it
  // as complete would present a half-finished itinerary (missing days, broken tables).
  if (upstreamError) {
    throw new Error(
      content
        ? `Generation was interrupted partway through (upstream: ${upstreamError}). Please regenerate.`
        : upstreamError
    );
  }
  return content;
}
