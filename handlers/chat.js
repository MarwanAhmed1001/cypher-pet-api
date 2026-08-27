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

const ZENMUX_KEY = process.env.ZENMUX_KEY || "sk-ai-v1-c257f0999a6ad6fadc6c1d098e9dea0b80f2b6361b5536ab51d7512318171932";

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

// 2. Primary Free Live LLM via ZenMux Dots-3 (Preserves Gemini Free Trial!)
async function callPrimaryLLM(message, extraContext = "") {
  try {
    const res = await axios.post('https://zenmux.ai/api/v1/chat/completions', {
      model: 'dots-studio/dots3-note-prev',
      messages: [
        {
          role: 'system',
          content: `You are "Lola", an ultra-smart, witty, loving desktop robot pet. Respond in 2-3 expressive sentences (under 35 words). Use lively Egyptian Arabic for Arabic queries and natural English for English queries. ${extraContext}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 250,
      temperature: 0.85
    }, {
      headers: {
        'Authorization': `Bearer ${ZENMUX_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    });

    const reply = res.data?.choices?.[0]?.message?.content?.trim();
    if (reply) {
      let voice_clip = "HELLO";
      const lower = (message + " " + reply).toLowerCase();
      if (lower.includes('طقس') || lower.includes('weather')) voice_clip = "WEATHER";
      else if (lower.includes('بحبك') || lower.includes('love')) voice_clip = "LOVE";
      else if (lower.includes('ارقص') || lower.includes('dance')) { voice_clip = "DANCE"; setCommand("DANCE"); }
      else if (lower.includes('نام') || lower.includes('sleep')) { voice_clip = "BYE"; setCommand("SLEEP"); }
      else if (lower.includes('اصح') || lower.includes('wake')) { voice_clip = "HELLO"; setCommand("WAKE"); }
      else if (lower.includes('قصة') || lower.includes('نكتة') || lower.includes('story') || lower.includes('joke')) voice_clip = "GOOD";
      else voice_clip = "LISTEN";

      return {
        reply: reply,
        display: enforceEnglishScreenText(reply.substring(0, 20), "Lola: Thinking!"),
        mood: "HAPPY",
        voice_clip: voice_clip
      };
    }
  } catch (e) {
    // Graceful fallback to local engine
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
    weatherContext = `Live Weather in Cairo: ${w.temp}°C, condition: ${w.condition} (${w.conditionEn}).`;
  }

  // 1. Try Primary Active Key on ZenMux (No Gemini Trial Consumption!)
  const primaryResult = await callPrimaryLLM(message, weatherContext);
  if (primaryResult) return primaryResult;

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
