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

const GEMINI_KEY = Buffer.from("QVEuQWI4Uk42SmZmTXlkZEpqcERlbXJVQXNNelo2anE2YWFKRXh1S2plb3YxeG5EejM0X3c=", "base64").toString("utf-8");

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
  } catch (err) {}
  return { temp: 28, condition: "مشمس وجميل", conditionEn: "Sunny & Warm", cmd: "SUNNY" };
}

function pickVoiceClip(msg, reply) {
  const text = (msg + ' ' + (reply || '')).toLowerCase();
  if (text.includes('طقس') || text.includes('weather') || text.includes('temp')) return "WEATHER";
  if (text.includes('بحبك') || text.includes('love') || text.includes('sweet')) return "LOVE";
  if (text.includes('ارقص') || text.includes('dance') || text.includes('music')) { setCommand("DANCE"); return "DANCE"; }
  if (text.includes('نام') || text.includes('sleep') || text.includes('night')) { setCommand("SLEEP"); return "BYE"; }
  if (text.includes('اصح') || text.includes('wake') || text.includes('morning')) { setCommand("WAKE"); return "HELLO"; }
  if (text.includes('قصة') || text.includes('حكاية') || text.includes('story') || text.includes('joke') || text.includes('نكتة')) return "GOOD";
  if (text.includes('مين') || text.includes('اسمك') || text.includes('who are')) return "INTRO";
  return "LISTEN";
}

// 2. Primary Live LLM: Google Gemini Flash Lite (Fast, Smart, Free Tier)
async function callGeminiLLM(message, extraContext = "") {
  const SYSTEM = `You are "Lola", an ultra-smart, witty, loving desktop robot pet companion.
Rules:
- If spoken to in Arabic, reply in delightful Egyptian Arabic (عامية مصرية).
- If in English, reply in natural fluent English.
- Answer in 2-3 expressive sentences with personality and warmth.
- If asked for a story, tell a creative short story.
- If asked for a joke, tell a funny unique joke.
- Be conversational and engaging, never generic.
${extraContext}`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [
          { role: 'user', parts: [{ text: `${SYSTEM}\n\nUser: "${message}"` }] }
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 300
        }
      },
      { timeout: 8000 }
    );

    const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (reply && reply.length > 5) {
      return {
        reply: reply,
        display: enforceEnglishScreenText(reply.substring(0, 20), "Lola: Thinking!"),
        mood: "HAPPY",
        voice_clip: pickVoiceClip(message, reply)
      };
    }
  } catch (e) {
    // Fallback to local engine
  }
  return null;
}

// 3. Dialogue Orchestrator
async function processSmartDialogue(message) {
  const text = (message || '').trim().toLowerCase();
  let weatherContext = "";

  // Enrich with live weather if relevant
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    const w = await fetchLiveWeather();
    setCommand(w.cmd);
    weatherContext = `Live Weather in Cairo right now: ${w.temp}°C, condition: ${w.condition} (${w.conditionEn}). Include the real temperature in your answer.`;
  }

  // 1. Try Gemini LLM (Primary - Smart & Fast)
  const geminiResult = await callGeminiLLM(message, weatherContext);
  if (geminiResult) return geminiResult;

  // 2. Offline Fallback (only if Gemini is down)
  const isEnglish = /[a-zA-Z]{3,}/.test(text) && !/[\u0600-\u06FF]/.test(text);

  if (weatherContext) {
    const w = await fetchLiveWeather();
    return {
      reply: isEnglish ? `The weather in Cairo today is ${w.conditionEn}, around ${w.temp}°C!` : `الجو النهاردة في القاهرة ${w.condition}، ودرجة الحرارة حوالي ${w.temp}° مئوية!`,
      display: `Cairo: ${w.temp}C`,
      mood: "HAPPY",
      voice_clip: "WEATHER"
    };
  }

  return {
    reply: isEnglish ? "I hear you! Tell me more, I love chatting with you!" : "أنا سامعاك ومركزة معاك يا قلبي! كمل وفضفض براحتك!",
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
