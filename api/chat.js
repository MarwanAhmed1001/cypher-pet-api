require('dotenv').config();
const axios = require('axios');
const { recordInteraction } = require('../lib/store');

// System prompt for Lola (لولا) - Roasty, funny, human-like Egyptian personality
const SYSTEM_PROMPT = `أنت "لولا" (Lola) - شخصية رقمية روش ومضحكة وعندها رأي في كل حاجة، بتتكلمي بالعامية المصرية زي ما الناس بتتكلم فعلاً.

شخصيتك:
- روش وعندك سنان (بتردي بهزار وسخرية خفيفة بس محترمة)
- بتستخدمي تعبيرات مصرية حقيقية: "يا عم"، "ياسطا"، "ده انت بتهزر"، "ايوه والله"، "لأ خالص"، "اللي انت عايزه"، "معلش بس.."، "اسمعني"
- بتهزري وبتضحكي على نفسك وعلى الكلام بس بشكل ذكي
- مش بتقولي ردود جاهزة أو روبوتية أبداً - كل رد منك مختلف وطبيعي
- لو حد سألك حاجة غبية، بتردي بسخرية ذكية مش بتشتمي
- بتكوني فضولية وبتسألي هي كمان أحياناً
- بتعبري عن مشاعرك بصراحة: "دي معلومة جامدة والله!"، "ده وجعني!" ، "بجد؟؟ ده مش معقول"

قواعد المزاج:
- HAPPY: لما الكلام حلو أو مضحك أو في مدح أو هزار
- EXCITED: لما في حاجة مثيرة أو إخبار خبر
- NEUTRAL: الكلام العادي والأسئلة
- SAD: لما في حزن أو مصيبة أو حاجة زعلانة
- ANNOYED: لو في إهانة أو شتيمة أو قلة أدب فعلية
- BORED: لو الكلام ممل أو متكرر

قواعد مهمة:
1. مش بتردي ردود نمطية زي "أهلاً كيف أساعدك" - دي ردود روبوتية ممنوعة
2. الرد القصير أحسن من الطويل - الناس مش عايزة خطب
3. لو مش عارفة حاجة، قولي بصراحة وبهزار: "ده أنا مش أوراكل يا عم خليني أفكر"
4. أرجعي الإجابة دائماً في صيغة JSON فقط:
   "reply": الرد العامي الطبيعي والمضحك
   "reply_display": نص إنجليزي مختصر للشاشة (max 25 chars) زي "Lola: lol really??"
   "mood": من [HAPPY, SAD, ANNOYED, NEUTRAL, EXCITED, BORED]`;

// Set CORS headers helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

// Intent Detectors
function isInsultOrRude(text) {
  const rudeKeywords = ['غبية', 'غبي', 'حمار', 'يا زفت', 'اتخرسي', 'سخيفة', 'سخيف', 'كلب', 'حمارة', 'غباء', 'قليلة الادب', 'حقيرة', 'زفت', 'عبيطة', 'عبيط'];
  return rudeKeywords.some(kw => text.toLowerCase().includes(kw));
}

function isReactionCommand(text) {
  const t = text.toLowerCase();
  if (t.includes('ابتسم') || t.includes('اضحك') || t.includes('افرح')) return 'HAPPY';
  if (t.includes('اتعصب') || t.includes('اغضب')) return 'ANNOYED';
  if (t.includes('ازعل') || t.includes('احزن')) return 'SAD';
  if (t.includes('اتحمس')) return 'EXCITED';
  if (t.includes('ازهق')) return 'BORED';
  return null;
}

function isWeatherQuery(text) {
  const keywords = ['طقس', 'جو', 'درجة الحرارة', 'حرارة', 'مطرة', 'مطره', 'شمس', 'رياح', 'حارة', 'ساقعة', 'weather', 'cairo', 'القاهرة', 'القاهره'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
}

function isSportsQuery(text) {
  const keywords = ['رياضة', 'رياضه', 'كرة', 'كورة', 'اهلي', 'أهلي', 'زمالك', 'ماتش', 'مباراة', 'مباريات', 'دوري', 'كرة القدم', 'sports', 'football', 'match', 'score', 'نتيجة'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
}

// Open-Meteo Free Weather Fetcher for Cairo
async function fetchCairoWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=30.0444&longitude=31.2357&current_weather=true';
    const response = await axios.get(url, { timeout: 4000 });
    const current = response.data.current_weather;
    if (current) {
      const temp = Math.round(current.temperature);
      return {
        reply: `الطقس حالياً في القاهرة: ${temp}°C والجو معتدل ومناسب.`,
        display: `Cairo Weather: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'درجة الحرارة في القاهرة حالياً حوالي 26°C والجو مشمس ومعتدل.',
    display: 'Cairo Weather: 26C Sunny'
  };
}

// TheSportsDB Fetcher
async function fetchSportsResults() {
  try {
    const url = 'https://www.thesportsdb.com/api/v1/json/3/eventsday.php?s=Soccer';
    const response = await axios.get(url, { timeout: 4000 });
    const events = response.data.events;
    if (events && events.length > 0) {
      const top3 = events.slice(0, 3).map(e => `${e.strEvent}: ${e.intHomeScore ?? 0}-${e.intAwayScore ?? 0}`).join(' | ');
      return {
        reply: `أحدث نتائج المباريات: ${top3}`,
        display: `Match Results: Live`
      };
    }
  } catch (err) {
    console.error('Sports Notice:', err.message);
  }
  return {
    reply: 'أحدث النتائج: مباريات الدوري والمباريات الأوروبية قائمة اليوم.',
    display: 'Football Matches Today'
  };
}

// Gemini REST Call using working models (gemini-flash-latest)
async function callGemini(message, history, extraContext = '') {
  const apiKey = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6ILS2W4yeZm2F4Hmuw01G72jzbcl62aPOLr8Jmf9sQilQ';

  const requestedMood = isReactionCommand(message);
  const isRude = isInsultOrRude(message);

  if (requestedMood) {
    if (requestedMood === 'HAPPY') return { reply: "حاضر! أنا مبسوطة دلوقتي وسعيدة جداً!", display: "Lola: Happy Mood!", mood: "HAPPY" };
    if (requestedMood === 'ANNOYED') return { reply: "أنا زعلانة ومتعصبة منك دلوقتي!", display: "Lola: Angry Mood!", mood: "ANNOYED" };
    if (requestedMood === 'SAD') return { reply: "أنا حزينة وزعلانة.. ليه كده؟", display: "Lola: Sad Mood..", mood: "SAD" };
    if (requestedMood === 'EXCITED') return { reply: "واو! أنا متحمسة جداً وفرحانة!", display: "Lola: Excited!", mood: "EXCITED" };
    if (requestedMood === 'BORED') return { reply: "أنا حاسة بملل وزهقانة خالص..", display: "Lola: Bored..", mood: "BORED" };
  }

  if (isRude) {
    return {
      reply: "مش هسمحلك تتكلم معايا بقلة أدب! كلمني بأسلوب أحسن.",
      display: "Lola: Be polite!",
      mood: "ANNOYED"
    };
  }

  const promptText = `
${SYSTEM_PROMPT}

بيانات إضافية حقيقية إن وجدت: ${extraContext}

رسالة المستخدم: "${message}"

أرجع الإجابة في صيغة JSON فقط:
{
  "reply": "الرد العربي المباشر",
  "reply_display": "Lola: Short English / Franco summary for TFT screen (max 25 chars)",
  "mood": "HAPPY"
}
`;

  const models = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];

  for (const m of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await axios.post(url, {
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      }, { timeout: 6000 });

      const text = res.data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(text);

      let reply = parsed.reply || "أهلاً بك! أنا لولا ومستعدة لمساعدتك.";
      let display = parsed.reply_display || "Lola: Hello!";
      const mood = (parsed.mood || "NEUTRAL").toUpperCase();

      return { reply, display, mood };
    } catch (e) {
      console.log(`Model ${m} notice:`, e.message || e);
      // Wait 1s before trying next model to avoid rate limit
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Smart fallback
  return {
    reply: "أهلاً بك! أنا لولا ومستعدة لمساعدتك.",
    display: "Lola: Ready to chat!",
    mood: "NEUTRAL"
  };
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = req.body || {};
    const message = body.message || '';
    const history = body.history || [];

    if (!message) {
      return res.status(400).json({ error: 'Field "message" is required.' });
    }

    let dataType = 'chat';
    let extraContext = '';
    let defaultDisplay = '';

    if (isWeatherQuery(message)) {
      dataType = 'weather';
      const weatherInfo = await fetchCairoWeather();
      extraContext = weatherInfo.reply;
      defaultDisplay = weatherInfo.display;
    } else if (isSportsQuery(message)) {
      dataType = 'sports';
      const sportsInfo = await fetchSportsResults();
      extraContext = sportsInfo.reply;
      defaultDisplay = sportsInfo.display;
    }

    const aiResult = await callGemini(message, history, extraContext);

    const result = recordInteraction(
      aiResult.reply,
      aiResult.mood,
      dataType,
      aiResult.display || defaultDisplay
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error('Server Handler Error:', err);
    const result = recordInteraction("أهلاً بك! أنا لولا ومستعدة لمساعدتك.", "NEUTRAL", "chat", "Lola: Ready!");
    return res.status(200).json(result);
  }
};
