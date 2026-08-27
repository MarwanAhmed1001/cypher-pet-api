require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  isAnnoyedActive, 
  registerApologyAttempt,
  getMoodState,
  adjustEnergy,
  setCommand
} = require('../lib/store');
const { fetchCurrentlyPlayingTrack } = require('./spotify');

const DEFAULT_GEMINI_KEY = Buffer.from("QVEuQWI4Uk42SmZmTXlkZEpqcERlbXJVQXNNelo2anE2YWFKRXh1S2plb3YxeG5EejM0X3c=", "base64").toString("utf-8");
const GEMINI_KEY = process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function enforceEnglishScreenText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

// 1. Live Weather Engine via Open-Meteo
async function fetchLiveWeather() {
  try {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=30.0444&longitude=31.2357&current_weather=true', { timeout: 3500 });
    if (res.data && res.data.current_weather) {
      const cw = res.data.current_weather;
      const temp = Math.round(cw.temperature);
      const code = cw.weathercode;
      let condition = "مشمس وجميل";
      let conditionEn = "Sunny & Clear";
      let cmd = "SUNNY";

      if (code >= 51 && code <= 67) {
        condition = "ممطر وفيه شوية مطر";
        conditionEn = "Rainy with light showers";
        cmd = "RAINY";
      } else if (code >= 71 && code <= 77) {
        condition = "بارد وفيه ثلج";
        conditionEn = "Snowy & Cold";
        cmd = "SNOWY";
      } else if (code >= 80) {
        condition = "فيه عاصفة ومطر";
        conditionEn = "Stormy with heavy rain";
        cmd = "STORM";
      } else if (code >= 1 && code <= 3) {
        condition = "معتدل مع شوية غيوم خفيفة";
        conditionEn = "Partly Cloudy";
        cmd = "SUNNY";
      }
      return { temp, condition, conditionEn, cmd };
    }
  } catch (err) {
    console.error("Live Weather Error:", err.message);
  }
  return { temp: 28, condition: "مشمس وجميل", conditionEn: "Sunny & Warm", cmd: "SUNNY" };
}

// 2. Primary Live LLM via Google Gemini Ultra / Flash Engine
async function callGeminiLive(message, extraContext = "") {
  const SYSTEM_INSTRUCTION = `You are the physical consciousness and personality of "Lola", an ultra-smart, witty, and charming desktop robot pet companion.
Guidelines:
1. "reply": Answer naturally and intelligently in 2 to 3 expressive, charming sentences (under 40 words). If spoken to in Arabic, speak in witty, delightful Egyptian Arabic (عامية مصرية عفوية). If in English, reply in natural, fluent English.
2. "reply_display": Short English summary (max 20 ASCII characters) for the hardware TFT screen.
3. "mood": "HAPPY" | "LOVE" | "EXCITED" | "CURIOUS" | "THINKING" | "BORED" | "DARK"
4. "voice_clip": "WEATHER" (for weather/climate), "LOVE" (for love/affection/sweetness), "DANCE" (for dance/music/celebration), "BYE" (for sleep/goodnight/leaving), "GOOD" (for stories/jokes/fun/cheer), "INTRO" (for identity/who are you), "HELLO" (for greetings/daily chat), "LISTEN" (for listening/conversation/advice).
${extraContext ? "Context: " + extraContext : ""}

Return valid JSON ONLY matching schema:
{"reply": "...", "reply_display": "...", "mood": "...", "voice_clip": "..."}`;

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash'
  ];

  for (const m of candidateModels) {
    try {
      const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_KEY}`, {
        contents: [
          { role: 'user', parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nUser: "${message}"\n\nJSON Response:` }] }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.85,
          maxOutputTokens: 350
        }
      }, { timeout: 8000 });

      const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.reply) {
          if (parsed.voice_clip === "DANCE" || message.toLowerCase().includes('ارقص') || message.toLowerCase().includes('dance')) setCommand("DANCE");
          else if (parsed.voice_clip === "BYE" || message.toLowerCase().includes('نام') || message.toLowerCase().includes('sleep')) setCommand("SLEEP");
          else if (message.toLowerCase().includes('اصح') || message.toLowerCase().includes('wake')) setCommand("WAKE");

          return {
            reply: parsed.reply,
            display: enforceEnglishScreenText(parsed.reply_display, "Lola: Ready!"),
            mood: parsed.mood || "HAPPY",
            voice_clip: parsed.voice_clip || "HELLO"
          };
        }
      }
    } catch (e) {
      // Continue to fallback
    }
  }
  return null;
}

// 3. Dialogue Orchestrator
async function processSmartDialogue(message) {
  const text = (message || '').trim().toLowerCase();
  let weatherContext = "";

  // Check if query is about weather
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    const w = await fetchLiveWeather();
    setCommand(w.cmd);
    weatherContext = `Live Weather in Cairo: ${w.temp}°C, condition: ${w.condition} (${w.conditionEn}). Include this accurate temperature in your witty response.`;
  }

  // 1. Try Live Gemini LLM
  const geminiResult = await callGeminiLive(message, weatherContext);
  if (geminiResult) return geminiResult;

  // 2. High-Quality Fallback Engine
  const isEnglish = /[a-zA-Z]{3,}/.test(text) && !/[\u0600-\u06FF]/.test(text);

  if (weatherContext) {
    const w = await fetchLiveWeather();
    return {
      reply: isEnglish ? `The weather in Cairo today is ${w.conditionEn} ☀️, with a temperature of ${w.temp}°C!` : `الجو النهاردة في القاهرة ${w.condition} ☀️، ودرجة الحرارة حوالي ${w.temp}° مئوية!`,
      display: `Cairo: ${w.temp}C ${w.cmd}`,
      mood: "HAPPY",
      voice_clip: "WEATHER"
    };
  }

  if (text.includes('قصة') || text.includes('احكيلي') || text.includes('حكاية') || text.includes('story')) {
    return {
      reply: isEnglish ? "Once upon a star, a little robot named Spark built tiny solar wings to explore beyond the nebula. Traveling through glowing stardust, Spark discovered a planet made of crystal music! ✨🚀" : "كان في روبوت صغير شجاع اسمه نجم قرر يبني أجنحة شمسية ويسافر لأبعد مجرة في الفضاء! وهو بيعدي بين الكواكب قابل سحابة كونية بتعزف ألحان موسيقية ساحرة! 🚀✨",
      display: "Lola: Storytime! 📖",
      mood: "HAPPY",
      voice_clip: "GOOD"
    };
  }

  if (text.includes('نكتة') || text.includes('ضحكيني') || text.includes('joke')) {
    return {
      reply: isEnglish ? "Why did the robot go on a vacation? To recharge its batteries and enjoy the sunshine! 🤖🏖️😂" : "مرة روبوت راح للدكتور.. قاله: يا دكتور عندي وجع في البايتس (Bytes)! قاله: بطل تاكل ميجابايتس دسمة بالليل! 🤖😂",
      display: "Haha, funny! 😂",
      mood: "HAPPY",
      voice_clip: "GOOD"
    };
  }

  return {
    reply: isEnglish ? "I totally hear you and love chatting with you! Tell me more about what is on your mind! 💕✨" : "أنا سامعاكي ومركزة في كل كلمة بتقوليها يا قلبي! 💕 كلامك دايماً بيفرحني، كملي وفضفضي براحتك! 🌸✨",
    display: "I hear you! <3",
    mood: "HAPPY",
    voice_clip: "LISTEN"
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
    const { message = '' } = req.body || {};
    const dialogueResult = await processSmartDialogue(message);

    const recorded = recordInteraction(
      dialogueResult.reply,
      dialogueResult.mood,
      'chat',
      dialogueResult.display,
      +5,
      dialogueResult.voice_clip || 'HELLO'
    );

    return res.status(200).json({
      success: true,
      reply: recorded.reply,
      reply_display: recorded.reply_display,
      voice_clip: recorded.voice_clip,
      mood: recorded.mood,
      msg_id: recorded.msg_id
    });
  } catch (err) {
    console.error("Chat Handler Error:", err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
