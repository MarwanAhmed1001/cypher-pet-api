require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  clearAnnoyedState, 
  isAnnoyedActive, 
  registerApologyAttempt 
} = require('../lib/store');

// System prompt for Lola (لولا) - Roasty, funny, Egyptian slang personality
const SYSTEM_PROMPT = `أنتِ "لولا" (Lola) - شخصية رقمية روشة ومضحكة بتتكلمي بالعامية المصرية بوضوح ودون أي رموز غريبة.

شخصيتك:
- بتردي بالتعبير المصري الطبيعي: "يا عم"، "ياسطا"، "ده انت بتهزر"، "ايوه والله"، "لأ خالص"، "اللي انت عايزه"، "معلش بس.."
- ممنوع منعاً باتاً استخدام أي رموز يابانية أو صينية أو رموز تحكم غريبة.

قواعد JSON المرجعة:
1. "reply": الرد الكامل باللغة العربية المصرية العامية فقط أو الإنجليزية البسيطة (مخصص للشات).
2. "reply_display": عبارة مختصرة باللغة الإنجليزية فقط 100% (ENGLISH ONLY - MAX 25 ASCII CHARACTERS) مخصصة لشاشة الـ ESP32 (مثل: "Lola: Happy!", "Cairo: 26C", "5+5 = 10", "Lola: OK!").
CRITICAL RULE: "reply_display" MUST BE 100% ENGLISH ASCII. NEVER INCLUDE ARABIC LETTERS IN "reply_display".

قواعد المزاج:
- HAPPY, EXCITED, NEUTRAL, SAD, ANNOYED, BORED`;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

// Clean chat text for web UI (Arabic & English text only)
function cleanChatReply(text) {
  if (!text) return "أهلاً بيك! أنا لولا 💖";
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\\n/g, ' ')
    .trim();
}

// Strictly enforce ENGLISH ONLY for screen display
function enforceEnglishScreenText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

function isInsultOrRude(text) {
  const rudeKeywords = [
    'غبية', 'غبي', 'حمار', 'يا زفت', 'اتخرسي', 'سخيفة', 'سخيف', 'كلب', 'حمارة', 
    'غباء', 'قليلة الادب', 'حقيرة', 'زفت', 'عبيطة', 'عبيط', 'زهقت منك', 'مبتفهميش', 
    'اخرسي', 'تفه', 'انقلعي', 'بكرهك', 'غوري'
  ];
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

async function fetchCairoWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=30.0444&longitude=31.2357&current_weather=true';
    const response = await axios.get(url, { timeout: 4000 });
    const current = response.data.current_weather;
    if (current) {
      const temp = Math.round(current.temperature);
      return {
        reply: `الطقس حالياً في القاهرة حوالي ${temp}° مئوية والجو مستقر.`,
        display: `Cairo Temp: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'درجة الحرارة في القاهرة حالياً حوالي 26° مئوية والجو مشمس ومعتدل.',
    display: 'Cairo Temp: 26C'
  };
}

async function callGroq(message, extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  const isRude = isInsultOrRude(message);
  const currentlyAnnoyed = isAnnoyedActive();

  if (isRude) {
    setAnnoyedState();
    return {
      reply: "ملكيش دعوة بيا شوية وهفك! مش حابة أتكلم معاك دلوقتي 🙄",
      display: "Lola: Stay away!",
      mood: "ANNOYED"
    };
  }

  if (currentlyAnnoyed) {
    const apolStatus = registerApologyAttempt(message);
    if (apolStatus.forgiven) {
      return {
        reply: "خلاص المرة دي سامحتك عشان خاطرك وبس، بس إياك تزعلني تاني! ❤️",
        display: "Lola: Forgiven <3",
        mood: "HAPPY"
      };
    } else {
      let annoyedSystemMsg = `[تنبيه: أنتِ لسة زعلانة من المستخدم! ردي بقمص وزعل وتقوليلو: "ملكيش دعوة بيا شوية وهفك" والمزاج ANNOYED]`;
      try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n${annoyedSystemMsg}` },
            { role: 'user', content: `${message}\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "ANNOYED"}` }
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

        return {
          reply: cleanChatReply(parsed.reply || "ملكيش دعوة بيا شوية وهفك!"),
          display: enforceEnglishScreenText(parsed.reply_display, "Lola: Leave me!"),
          mood: "ANNOYED"
        };
      } catch (e) {
        return {
          reply: "ملكيش دعوة بيا شوية وهفك! لسة زعلانة منك.",
          display: "Lola: Stay away!",
          mood: "ANNOYED"
        };
      }
    }
  }

  const requestedMood = isReactionCommand(message);
  if (requestedMood) {
    if (requestedMood === 'HAPPY') return { reply: "ايوه والله بقيت فرحانة دلوقتي! 😄", display: "Lola: Happy!", mood: "HAPPY" };
    if (requestedMood === 'ANNOYED') {
      setAnnoyedState();
      return { reply: "اوكي اوكي اتعصبت بقى! 😤", display: "Lola: Annoyed!", mood: "ANNOYED" };
    }
    if (requestedMood === 'SAD') return { reply: "يعني ايه اتحزن كده؟ 🥺", display: "Lola: Sad..", mood: "SAD" };
    if (requestedMood === 'EXCITED') return { reply: "ياااه بقيت متحمسة جداً!! 🔥", display: "Lola: Excited!", mood: "EXCITED" };
    if (requestedMood === 'BORED') return { reply: "تمام يعني.. زهقت. 😑", display: "Lola: Bored..", mood: "BORED" };
  }

  const userMessage = extraContext ? `${message}\n\n(معلومات إضافية: ${extraContext})` : message;

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

    return {
      reply: cleanChatReply(parsed.reply || "أهلاً بيك! لولا معاك 💖"),
      display: enforceEnglishScreenText(parsed.reply_display, "Lola: Hello!"),
      mood: parsed.mood || "HAPPY"
    };
  } catch (e) {
    console.error('Groq Error:', e.message);
    return {
      reply: "أهلاً بيك! أنا لولا، منورة معاك دائماً ✨",
      display: "Lola: Hello!",
      mood: "HAPPY"
    };
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let result;
    if (isWeatherQuery(message)) {
      const weatherData = await fetchCairoWeather();
      result = {
        reply: weatherData.reply,
        display: weatherData.display,
        mood: 'HAPPY'
      };
    } else {
      result = await callGroq(message);
    }

    const cleanReply = cleanChatReply(result.reply);
    const englishDisplay = enforceEnglishScreenText(result.display, "Lola: Ready!");

    recordInteraction(cleanReply, result.mood, 'chat', englishDisplay);

    return res.status(200).json({
      success: true,
      reply: cleanReply,
      reply_display: englishDisplay,
      mood: result.mood
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
};
