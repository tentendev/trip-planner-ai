
import { Language } from "../types";

/**
 * Zero-config demo path. Two triggers:
 *  1. `?demo=1` in the URL — explicit request to see the sample plan.
 *  2. CONFIG_ERROR fallback in geminiService — deployments without an LLM key still
 *     ship a working product instead of a dead end.
 * The plan itself is static, but it is streamed token-by-token so the UX mirrors a
 * real generation (progressive render, live timer, Stop button all behave identically).
 */

export const isDemoRequested = (): boolean => {
  if (typeof location === 'undefined') return false;
  return new URLSearchParams(location.search).get('demo') === '1';
};

// Marker embedded in the markdown so downstream code/tests can detect a demo plan.
const DEMO_MARKER = '<!-- demo-mode -->';

const DEMO_PLAN_EN = `# Kyoto · 3-Day Trip OS Plan

> **Demo itinerary** — this sample was streamed locally without an AI backend. Deploy with an \`OPENROUTER_API_KEY\` to plan *your* trip. [Demo]

## 0. Weather Intelligence & Strategy — Typical Climate Estimate

The requested window sits beyond the live-forecast horizon, so figures are historical seasonal norms for Kyoto [Assumption].

| Day | Condition (Typical Climate) | Temp (High/Low) | Rain Probability | Strategic Advice |
| --- | --- | --- | --- | --- |
| Day 1 | Sunny, cool mornings | 21°C / 12°C | 20% | Layer up for the sunrise climb at Fushimi Inari |
| Day 2 | Partly cloudy, mild wind | 20°C / 12°C | 30% | Best weather window for the Arashiyama river walk |
| Day 3 | Light showers likely | 19°C / 11°C | 40% | Indoor-priority: covered market arcades + tea house |

**Key decision:** Day 3 carries the highest rain risk, so outdoor anchors are front-loaded into Days 1–2 and Day 3 pivots to covered routes around Nishiki Market and downtown Kyoto.

## 1. One-Page Overview

- **Theme**: Classic east-meets-west Kyoto — hillside temples, bamboo, geisha districts, food markets.
- **Daily pace**: Moderate. 2–3 anchor activities per day plus one flex slot after lunch; no day exceeds 15,000 steps.
- **Transport strategy**: IC card (ICOCA) everywhere. City buses for the east cluster, JR Sagano line for Arashiyama, Haruka express for airport transfers.
- **Accommodation strategy**: Base near Kyoto Station — every day starts and ends on a major rail hub, zero luggage shuffling.
- **Budget outline**: ¥10,000–13,000/person/day excluding hotel (see tiered budget table below).

## 2. Daily Itinerary

### Day 1 — Arrival + East Kyoto Hillside

| Time Range | Activity | Logistics & Notes |
| --- | --- | --- |
| 09:30–11:00 | Land at KIX → Haruka Express to Kyoto Station | 80 min, ¥3,110 reserved seat. Buy ICOCA + Haruka bundle [Assumption: morning arrival] |
| 11:00–11:45 | Drop luggage at hotel near Kyoto Station | Coin lockers (¥700) if before check-in |
| 12:00–14:30 | Kiyomizu-dera + Sannenzaka & Ninenzaka slopes | Bus 206 from Station (15 min). Go straight to the terrace before crowds thicken |
| 14:30–15:30 | Lunch: yudofu (tofu hot pot) near Kodai-ji | Walk down the slopes — eating while descending saves legs |
| 15:30–17:00 | Kodai-ji → Yasaka Shrine → Maruyama Park | Flat 20-min stroll chain; shrine is free, open till late |
| 17:00–18:30 | Flex slot: Gion Hanamikoji street walk | Dusk is when you may spot maiko heading to appointments |
| 18:30–21:00 | Dinner in Pontocho Alley | Riverside terraces (kawadoko); book a kaiseki counter 3+ days ahead |

*Why here:* everything sits in one walkable hillside-to-river cluster; the route only descends, which matters after a red-eye flight.

### Day 2 — Bamboo, Gold & Rivers

| Time Range | Activity | Logistics & Notes |
| --- | --- | --- |
| 07:30–08:15 | JR Sagano line to Saga-Arashiyama | Beat both crowds and heat — grove is near-empty before 08:30 |
| 08:15–09:30 | Arashiyama Bamboo Grove + Togetsukyo Bridge | Free. Photo light is best at this hour |
| 09:30–11:30 | Tenryu-ji temple & garden | ¥500 garden entry; Unesco site, exit north gate into the grove loop |
| 11:30–12:30 | Flex slot: Monkey Park Iwatayama OR riverbank café | 20-min uphill hike — skip if knees object [Tired option] |
| 12:30–13:30 | Lunch: unagi or soba by the Katsura River | Shops fill with tour buses after 13:00 |
| 13:30–15:00 | JR + bus to Kinkaku-ji (Golden Pavilion) | 40 min door-to-door; ¥400 ticket doubles as a bookmark |
| 15:00–17:00 | Nijo Castle nightingale floors | 15 min by bus 12; last entry 16:00 — don't cut it close |
| 17:30–21:00 | Kamo River dinner + Pontocho evening stroll | Reserve a riverside table; trains back to Station run until ~23:30 |

*Why here:* northwest sites are chained in one corridor; starting at 07:30 converts a famously crowded district into a quiet one.

### Day 3 — Markets, Craft & Departure (Rain-Resilient)

| Time Range | Activity | Logistics & Notes |
| --- | --- | --- |
| 08:30–09:30 | Breakfast + luggage to station lockers | Check-out before 10:00; keep bags cached for the evening train |
| 09:30–11:30 | Nishiki Market breakfast crawl | Covered arcade — rain-proof. Tako-tamago, matcha soft serve, pickle barrels |
| 11:30–13:00 | Teramachi & Shin-Kyogoku shopping arcades | Stationery, knives, ceramics — tax-free counters upstairs |
| 13:00–14:30 | Tea ceremony experience (Camellia or En) | Indoor, seated, 45–90 min; book 3–7 days ahead |
| 14:30–16:00 | Flex slot: Kyoto Railway Museum OR Samurai & Ninja Museum | Both fully indoor, both kid-friendly |
| 16:00–17:00 | Early dinner at Kyoto Station Ramen Street | 8 shops on the 10th floor; queues are shortest before 17:30 |
| 17:00–19:30 | Haruka Express to KIX | Board 40 min pre-departure buffer for international check-in |

*Why here:* every stop is within 300 m of an arcade exit, so the highest-rain-probability day never forces an exposed walk longer than 5 minutes.

## 3. Geo-Clustering Logic

- **Day 1** = one hillside wedge (Kiyomizu → Gion), strictly downhill sequencing.
- **Day 2** = western/northern corridor reached by rail, chained bus stops on the return.
- **Days never cross the city twice**: each day occupies one quadrant, cutting average transit to under 25 min per hop.

## 4. Plan B (Per Day)

- **Day 1 — Rain**: Swap Sannenzaka slopes for the Kyoto National Museum, keep Kiyomizu (umbrella-friendly stone plaza).
- **Day 2 — Tired**: Drop Monkey Park + Nijo Castle; insert an onsen stop (Funaoka Onsen, ¥470) between temples.
- **Day 3 — Crowded**: If Nishiki is shoulder-to-shoulder, pivot to Kyoto Handicraft Center or the International Manga Museum.

## 5. Booking OS

| Item | Book When | Alternative |
| --- | --- | --- |
| Hotel near Kyoto Station | 4–6 weeks out | Any Tokyu/Mitsui Garden branch on the subway loop |
| Pontocho kaiseki dinner | 3+ days ahead | Izakaya in the same alley, walk-in before 18:00 |
| Tea ceremony | 3–7 days ahead | Tea house in Camellia's sister shop, same-day slots |
| Haruka reserved seat | At KICCO/online anytime | Non-reserved cars exist but fill on peak weekends |
| Kinkaku-ji / shrines | No booking needed | Arrive before 09:00 or after 16:00 |

## 6. Budget Table (per person, excl. hotel)

| Category | Conservative | Standard | Luxury |
| --- | --- | --- | --- |
| Accommodation | ¥6,000/night (business hotel) | ¥14,000/night (boutique) | ¥35,000+/night (ryokan + kaiseki) |
| Transport | ¥1,500/day (bus + rail) | ¥2,000/day (+ Haruka reserved) | ¥6,000/day (private driver, taxi hops) |
| Food | ¥3,500/day | ¥7,000/day | ¥15,000/day |
| Tickets & experiences | ¥1,000/day | ¥2,500/day (+tea ceremony) | ¥6,000/day (+private guide) |
| Misc/shopping | ¥1,000/day | ¥3,000/day | ¥10,000/day |
| **3-day total** | **≈¥39,000** | **≈¥87,000** | **≈¥216,000** |

## 7. Transport Rules

- Cap any single transit leg at 40 min; beyond that, re-cluster the day.
- Buses are flat-fare ¥230 — take them only for hops under 3 km; rails beat buses beyond that.
- Taxi threshold: 4 people or rain → taxi beats two bus transfers (flag fall ¥500).

## 8. Risks & Local Rules

- Geisha-district photography of private alleys is banned; fines apply in Gion's side streets.
- Temple grounds close sharply at 17:00 (16:30 in winter) — anchors are morning-weighted accordingly.
- Peak foliage (mid-Nov) triples queues at Kiyomizu; the 07:30 rule above becomes mandatory.
- Tap water is safe; convenience-store ice is safe; avoid picnicking along private farmland in Arashiyama.

## 9. Packing Checklist

- [ ] Passport + ICOCA card (or phone Suica)
- [ ] Power bank — navigation burns battery fast
- [ ] Compact umbrella (Day 3 rain probability)
- [ ] Walking shoes broken in — expect 15k steps/day
- [ ] Light jacket for 12°C mornings/evenings
- [ ] Cash ¥20,000+ — many temples and stalls are cash-only
- [ ] Coin purse — lockers, buses and vending machines eat coins
- [ ] Small towel (temple etiquette + summer humidity)
`;

// zh-TW variant follows Taiwan usage (計程車/公車); other locales fall back to English
// rather than machine-flavored translations of a fixed script.
const DEMO_PLAN_ZH_TW = `# 京都 · 三日 Trip OS 行程計畫

> **示範行程** — 此範例由本機串流產生，未經 AI 後端。部署時設定 \`OPENROUTER_API_KEY\` 即可規劃你自己的旅程。[Demo]

## 0. 天氣情報與策略（典型氣候估計值）

出發日超出即時預報範圍，以下為京都該季節的歷史氣候常態值 [假設]。

| 天 | 天氣狀況（典型氣候） | 溫度（高／低） | 降雨機率 | 策略建議 |
| --- | --- | --- | --- | --- |
| 第 1 天 | 晴朗、清晨偏涼 | 21°C / 12°C | 20% | 伏見稻荷清晨登山，記得帶外套 |
| 第 2 天 | 多雲、微風 | 20°C / 12°C | 30% | 天氣最佳，適合嵐山河畔散步 |
| 第 3 天 | 可能零星小雨 | 19°C / 11°C | 40% | 以室內為主：有頂蓋的市場與茶屋 |

**關鍵決策：** 第 3 天降雨風險最高，因此戶外景點集中在前兩天，第 3 天改走錦市場與京都市中心的騎樓路線。

## 1. 一頁總覽

- **主題**：經典京都——山坡古寺、竹林、花見小路、美食市場。
- **每日步調**：適中。每天 2–3 個錨點活動＋午後彈性時段；單日不超過 15,000 步。
- **交通策略**：全程使用 IC 卡（ICOCA）。東側景群搭市區公車，嵐山搭 JR 嵯峨野線，機場來回搭 Haruka 特急。
- **住宿策略**：以京都車站周邊為據點——每天從同一個軌道樞紐出發與返回，行李零搬移。
- **預算概要**：每人每日 ¥10,000–13,000（不含住宿），詳見下方分級預算表。

## 2. 每日行程

### 第 1 天 — 抵達＋東側山坡古寺

| 時間帶 | 活動 | 交通與備註 |
| --- | --- | --- |
| 09:30–11:00 | 關西機場 → Haruka 特急至京都車站 | 80 分鐘、指定席 ¥3,110。建議購買 ICOCA＆Haruka 套票 [假設：上午抵達] |
| 11:00–11:45 | 旅館寄放行李 | 若未到入住時間，可投幣置物櫃 ¥700 |
| 12:00–14:30 | 清水寺＋三年坂・二年坂 | 自車站搭公車 206 號（15 分）。先直上清水舞台，避開人潮 |
| 14:30–15:30 | 午餐：高台寺附近湯豆腐懷石 | 順著坡道下行覓食——下坡省腿力 |
| 15:30–17:00 | 高台寺 → 八坂神社 → 圓山公園 | 平緩連走的 20 分鐘路線；神社免費、開放至夜間 |
| 17:00–18:30 | 彈性時段：祇園花見小路散步 | 黃昏最容易遇見趕赴宴席的藝伎 |
| 18:30–21:00 | 先斗町巷內晚餐 | 川床席位有限，懷石料理請提前 3 天以上訂位 |

*為什麼這樣排：* 全程集中在同一片「山坡→河岸」步行群聚，且路線只往下走——對紅眼航班後的第一天特別重要。

### 第 2 天 — 竹林、金閣與河岸

| 時間帶 | 活動 | 交通與備註 |
| --- | --- | --- |
| 07:30–08:15 | JR 嵯峨野線前往嵯峨嵐山 | 趕在人潮與暑氣之前——08:30 前竹林幾乎淨空 |
| 08:15–09:30 | 嵐山竹林小徑＋渡月橋 | 免費。此時段光線最適合拍照 |
| 09:30–11:30 | 天龍寺庭園 | 參拜 ¥500；世界遺產，北門出口正好接回竹林環線 |
| 11:30–12:30 | 彈性時段：岩田山猴子公園或河畔咖啡館 | 上坡健行約 20 分鐘——體力不佳就跳過 [累了選項] |
| 12:30–13:30 | 午餐：桂川畔鰻魚飯或蕎麥麵 | 13:00 後團客湧入，先吃為快 |
| 13:30–15:00 | JR＋公車轉乘金閣寺 | 門到門約 40 分鐘；門票 ¥400 本身就是祈福籤 |
| 15:00–17:00 | 二條城（鶯張廊下） | 公車 12 號 15 分鐘；16:00 最後入場——別卡太剛好 |
| 17:30–21:00 | 鴨川晚餐＋先斗町夜景 | 河畔第一排需訂位；回程末班車約 23:30 |

*為什麼這樣排：* 西北景點串成一條走廊；07:30 出發把著名塞爆景區變成安靜私房路線。

### 第 3 天 — 市場、工藝與返程（雨天備案友善）

| 時間帶 | 活動 | 交通與備註 |
| --- | --- | --- |
| 08:30–09:30 | 早餐＋行李移至車站置物櫃 | 10:00 前退房；傍晚直奔月台不用繞回旅館 |
| 09:30–11:30 | 錦市場早餐巡禮 | 有頂蓋騎樓——下雨照逛。章魚蛋、抹茶冰淇淋、醬菜桶 |
| 11:30–13:00 | 寺町・新京極商店街 | 文具、刀具、陶器——樓上有退稅櫃台 |
| 13:00–14:30 | 茶道體驗（Camellia 或 En） | 室內坐著體驗 45–90 分鐘；提前 3–7 天預約 |
| 14:30–16:00 | 彈性時段：京都鐵道博物館或侍忍者博物館 | 兩者皆全室內、皆適合親子 |
| 16:00–17:00 | 早晚餐：京都車站拉麵小路 | 10 樓共 8 家店；17:30 前排隊最短 |
| 17:00–19:30 | Haruka 特急前往關西機場 | 國際線登機前抓 40 分鐘緩衝 |

*為什麼這樣排：* 每一站距離騎樓出口都在 300 公尺內，全天降雨機率最高的日子不會被迫走在露天路段超過 5 分鐘。

## 3. 地理群聚邏輯

- **第 1 天**＝同一片山坡楔形區（清水→祇園），嚴格一路向下。
- **第 2 天**＝西北走廊，去程靠鐵路、回程公車沿站鏈接。
- **任何一天都不橫跨城市兩次**：每天佔據一個象限，單趟平均交通壓在 25 分鐘以內。

## 4. Plan B（逐日備案）

- **第 1 天 — 下雨**：三年坂改為京都國立博物館，清水寺保留（石造平台撐傘可走）。
- **第 2 天 — 疲累**：捨棄猴子公園與二條城，插入船岡溫泉（¥470）泡湯休整。
- **第 3 天 — 人潮**：錦市場若寸步難行，改往京都傳統工藝館或國際漫畫博物館。

## 5. 預約作業系統

| 項目 | 何時預約 | 替代方案 |
| --- | --- | --- |
| 京都車站周邊旅館 | 提前 4–6 週 | 地鐵環線上任一東急／三井花園 |
| 先斗町懷石晚餐 | 提前 3 天以上 | 同巷居酒屋，18:00 前可現場候位 |
| 茶道體驗 | 提前 3–7 天 | 同集團姊妹店的當日釋出名額 |
| Haruka 指定席 | 隨時（線上或車站） | 有非指定席，但連假週末會客滿 |
| 金閣寺／神社 | 無需預約 | 09:00 前或 16:00 後抵達即可 |

## 6. 預算表（每人每日，不含住宿）

| 類別 | 省錢級 | 標準級 | 頂級 |
| --- | --- | --- | --- |
| 住宿 | ¥6,000／晚（商務旅館） | ¥14,000／晚（設計旅店） | ¥35,000+／晚（溫泉旅館＋懷石） |
| 交通 | ¥1,500／天（公車＋電車） | ¥2,000／天（含 Haruka 指定席） | ¥6,000／天（包車＋計程車代步） |
| 餐飲 | ¥3,500／天 | ¥7,000／天 | ¥15,000／天 |
| 門票體驗 | ¥1,000／天 | ¥2,500／天（含茶道） | ¥6,000／天（含私人導覽） |
| 雜支購物 | ¥1,000／天 | ¥3,000／天 | ¥10,000／天 |
| **三日總計** | **約 ¥39,000** | **約 ¥87,000** | **約 ¥216,000** |

## 7. 交通規則

- 單趟交通上限 40 分鐘；超過就重新群聚當日景點。
- 市區公車均一價 ¥230——3 公里內搭公車，超過改電車更快。
- 計程車門檻：4 人同行或下雨 → 計程車勝過兩段公車轉乘（起跳 ¥500）。

## 8. 風險與當地規則

- 祇園私有巷弄禁止拍攝藝伎，違規有罰款。
- 寺院 17:00（冬季 16:30）準時關門——錨點活動因此全部排在上午時段。
- 紅葉季（11 月中旬）清水寺排隊時間三倍起跳，「07:30 法則」變成必守規則。
- 自來水與超商冰品皆安全；嵐山私有農地請勿進入野餐。

## 9. 打包清單

- [ ] 護照＋ICOCA 卡（或手機 Suica）
- [ ] 行動電源——導航非常耗電
- [ ] 摺疊傘（第 3 天降雨機率高）
- [ ] 已磨合的步行鞋——每天約 15,000 步
- [ ] 輕外套——早晚僅 12°C
- [ ] 現金 ¥20,000 以上——多數寺院與攤販只收現金
- [ ] 零錢包——置物櫃、公車、自動販賣機都很吃零錢
- [ ] 小毛巾（寺院禮儀＋夏季濕熱）
`;

// Latin words stay whole; CJK glyphs pair up so streaming pace (and therefore the
// elapsed timer) feels comparable across locales.
const STREAM_TOKEN_RE =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]{1,2}\s*|[^\s\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+(?:\s+|$)/g;

// Same error shape fetch/reader aborts produce, so App's `err.name === 'AbortError'`
// cancel handling treats demo and real generations identically.
const abortError = (): Error => new DOMException('Demo generation aborted', 'AbortError');

// Sleep that rejects the instant the signal fires — abort must interrupt mid-delay,
// not wait out the current tick.
const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Streams the demo plan token-by-token with 20–45ms randomized delays, reporting the
 * ACCUMULATED markdown through onDelta exactly like the real SSE pipeline does.
 * Resolves with the full markdown; rejects with an AbortError-named error on cancel.
 */
export const streamDemoPlan = async (
  lang: Language,
  onDelta: (accumulated: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  const body = lang === 'zh-TW' ? DEMO_PLAN_ZH_TW : DEMO_PLAN_EN;
  const full = `${DEMO_MARKER}\n${body}`;
  const tokens = full.match(STREAM_TOKEN_RE) || [full];

  let accumulated = '';
  for (const token of tokens) {
    if (signal?.aborted) throw abortError();
    await delay(20 + Math.random() * 25, signal);
    accumulated += token;
    onDelta(accumulated);
  }
  return accumulated;
};
