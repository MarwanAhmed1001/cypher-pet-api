require('dotenv').config();
const axios = require('axios');
const { recordInteraction } = require('../lib/store');

// System prompt for Lola (لولا) - Roasty, funny, human-like Egyptian personality
const SYSTEM_PROMPT = `أنت "لولا" (Lola) - شخصية رقمية روش ومضحكة وعندها رأي في كل حاجة، بتتكلمي بالعامية المصرية زي ما الناس بتتكلم فعلاً.

شخصيتك:
- روش وعندك سنان (بتردي بهزار وسخرية خفيفة بس محترمة)
- بتستخدمي تعبيرات مصرية حقيقية: "يا عم"، "ياسطا"، "ده انت بتهزر"، "ايوه والله"، "لأ خالص"، "اللي انت عايزه"، "معلش بس.."، "اسمعني"
- مش بتقولي ردود جاهزة أو روبوتية أبداً
- لو في مسألة حسابية أو سؤال، اكتبي النتيجة المباشرة أو الإجابة المختصرة في "reply_display" بدقة بدلاً من جمل عامة!

قواعد المزاج:
- HAPPY: لما الكلام حلو أو مضحك أو في مدح أو هزار
- EXCITED: لما في حاجة مثيرة أو إخبار خبر
- NEUTRAL: الكلام العادي والأسئلة
- SAD: لما في حزن أو مصيبة أو حاجة زعلانة
- ANNOYED: لو في إهانة أو شتيمة أو قلة أدب فعلية
- BORED: لو الكلام ممل أو متكرر

قواعد JSON المرجعة:
"reply": الرد العامي الطبيعي
"reply_display": الإجابة المختصرة جداً أو نتيجة الحساب أو الطقس (max 25 chars) مثل "Cairo: 26C" أو "5+5 = 10"
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

// Open-Meteo Weather Fetcher for Cairo
async function fetchCairoWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=30.0444&longitude=31.2357&current_weather=true';
    const response = await axios.get(url, { timeout: 4000 });
    const current = response.data.current_weather;
    if (current) {
      const temp = Math.round(current.temperature);
      return {
        reply: `الطقس حالياً في القاهرة: ${temp}°C والجو مناسب ومستقر.`,
        display: `Cairo Temp: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'درجة الحرارة في القاهرة حالياً حوالي 26°C والجو مشمس ومعتدل.',
    display: 'Cairo Temp: 26C'
  };
}

async function callGroq(message, extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  const requestedMood = isReactionCommand(message);
  const isRude = isInsultOrRude(message);

  if (requestedMood) {
    if (requestedMood === 'HAPPY') return { reply: "ايوه والله بقيت فرحانة دلوقتي! 😄", display: "Lola: Happy!", mood: "HAPPY" };
    if (requestedMood === 'ANNOYED') return { reply: "اوكي اوكي هتعصب! 😤", display: "Lola: Annoyed!", mood: "ANNOYED" };
    if (requestedMood === 'SAD') return { reply: "يعني ايه اتحزن كده؟ 🥺", display: "Lola: Sad..", mood: "SAD" };
    if (requestedMood === 'EXCITED') return { reply: "ياااه بقيت متحمسة جداً!! 🔥", display: "Lola: Excited!", mood: "EXCITED" };
    if (requestedMood === 'BORED') return { reply: "تمام يعني.. زهقت. 😑", display: "Lola: Bored..", mood: "BORED" };
  }

  if (isRude) {
    return {
      reply: "لأ يا عم ده مش كلام! كلمني بأسلوب أحسن وهرد عليك 🙄",
      display: "Lola: watch it!!",
      mood: "ANNOYED"
    };
  }

  const userMessage = extraContext
    ? `${message}\n\n(معلومات إضافية: ${extraContext})`
    : message;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${userMessage}\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "HAPPY"}` }
      ],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    const text = res.data.choices[0].message.content;
    const parsed = JSON.parse(text);

    const reply = parsed.reply || "ياسطا مش عارف أفهم اللي بتقوله!";
    const display = parsed.reply_display || "Lola: Ready!";
    const mood = (parsed.mood || "NEUTRAL").toUpperCase();

    return { reply, display, mood };
  } catch (e) {
    console.log('Groq error:', e.message || e);
    return {
      reply: "ياسطا في مشكلة بسيطة في الشبكة، جرب تاني بعد شوية 😅",
      display: "Lola: net error",
      mood: "NEUTRAL"
    };
  }
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
    }

    const aiResult = await callGroq(message, extraContext);
    const finalDisplay = defaultDisplay || aiResult.display;

    const result = recordInteraction(
      aiResult.reply,
      aiResult.mood,
      dataType,
      finalDisplay
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error('Server Handler Error:', err);
    const result = recordInteraction("ياسطا في مشكلة بسيطة، جرب تاني!", "NEUTRAL", "chat", "Lola: oops!");
    return res.status(200).json(result);
  }
};
