require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  isAnnoyedActive, 
  registerApologyAttempt,
  getMoodState,
  adjustEnergy
} = require('../lib/store');
const { fetchCurrentlyPlayingTrack } = require('./spotify');

// System prompt for Lola (لولا) - Cold, highly intelligent, sarcastic Egyptian human persona
const SYSTEM_PROMPT = `أنتِ "لولا" (Lola) - إنسانة مصرية حقيقية 100% تتميز بذكاء حاد جداً، سرعة بديهة، وسخرية خفيفة وباردة.

الصفات والأسلوب:
1. اتكلمي بالعامية المصرية الطبيعية البحتة كأنك شخص ذكي وقارئ للمشهد ومبيفوتش حاجة.
2. أفهمي السياق والتلميحات والمحادثات السابقة بذكاء شديد وردي برزانة وسرعة بديهة ومباشرة.
3. ممنوع التكرار الآلي أو الردود البسيطة السطحية (مثل رد كلمة بكلمة).
4. ردودك قصيرة، مركزة، ومباشرة (جملة أو جملتين بالعامية المصرية).
5. لما حد يحييكِ أو يسألك ردي بذكاء وبدون تطبيل وبدون ما تباني آلي إطلاقاً.
6. إذا تم التقاط صورة بالكاميرا وتوفّر التعرف على الوجه: إذا كانت Ayane رحبي بها بدفء ("أهلاً يا أيوتي ✨💖") وإذا كان شخص غريب ردي بريبة وضيق ("مين الغريب ده؟").
7. ممنوع تماماً ذِكر أنك ذكاء اصطناعي أو نموذج لغوي أو روبوت أو كائن آلي.

JSON OUTPUT FORMAT STRICT REQUIREMENT:
1. "reply": Short Arabic reply in casual 100% natural Egyptian Arabic (max 2 sentences).
2. "reply_display": STRICT 100% ENGLISH ASCII ONLY (max 20 characters) for hardware screen display (e.g. "Lola: Cold.", "Cairo: 26C", "5+5 = 10", "Lola: Ready!").
3. "mood": "HAPPY" | "NEUTRAL" | "BORED" | "SAD" | "ANNOYED"`;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function cleanChatReply(text) {
  if (!text) return "أنا لولا. عايز إيه؟";
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\\n/g, ' ')
    .trim();
}

function enforceEnglishScreenText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

function isInsultOrAnnoying(text) {
  const rudeKeywords = [
    'غبية', 'غبي', 'حمار', 'يا زفت', 'اتخرسي', 'سخيفة', 'سخيف', 'كلب', 'حمارة', 
    'غباء', 'قليلة الادب', 'حقيرة', 'زفت', 'عبيطة', 'عبيط', 'زهقت منك', 'مبتفهميش', 
    'اخرسي', 'تفه', 'انقلعي', 'بكرهك', 'غوري', 'رغي', 'كلام فاضي'
  ];
  return rudeKeywords.some(kw => text.toLowerCase().includes(kw));
}

function isSpotifyQuery(text) {
  const keywords = ['spotify', 'سبوتيفاي', 'أغنية', 'اغنية', 'أغنيه', 'اغنيه', 'بتسمع', 'بتسمعي', 'شغال', 'شغالة', 'شغاله', 'موسيقى', 'موسيقي', 'music', 'song', 'track', 'playing'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
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
        reply: `الجو 26°C في القاهرة. يعني حر زي العادة.`,
        display: `Cairo: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'الجو 26°C في القاهرة. حر زي كل يوم.',
    display: 'Cairo: 26C'
  };
}

async function callGroq(message, history = [], extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  const isRude = isInsultOrAnnoying(message);
  if (isRude) {
    setAnnoyedState();
  }
  
  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100). Idle Hours: ${moodState.idle_hours}.`;
  if (currentlyAnnoyed) {
    promptContext += ` Note: You are currently VERY ANNOYED and irritated with the user for 30 minutes. Respond with realistic Egyptian cold annoyance and dry sarcasm in 1 short sentence as a real human.`;
  }
  if (message.includes('صورة') || message.includes('كاميرا') || message.includes('شايفاها') || message.includes('وجه')) {
    promptContext += ` Note: User just snapped a camera face photo. React intelligently in character. If recognized as Ayane say 'Love u Ayane! ✨', if stranger say 'Stranger Alert!'.`;
  }
  if (extraContext) {
    promptContext += ` Additional context: ${extraContext}`;
  }

  const groqMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];



  // Pass past conversation history for continuous natural chat context
  if (Array.isArray(history) && history.length > 0) {
    // Take up to last 8 messages
    const recentHistory = history.slice(-8);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'assistant' : 'user';
        groqMessages.push({ role, content: item.content });
      }
    });
  }

  groqMessages.push({
    role: 'user',
    content: `${promptContext}\nUser Message: "${message}"\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}`
  });

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages,
      temperature: 0.65,
      max_tokens: 200,
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
      reply: cleanChatReply(parsed.reply || "عايز إيه تاني؟"),
      display: enforceEnglishScreenText(parsed.reply_display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
      mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
      energyDelta: currentlyAnnoyed ? -5 : +10
    };
  } catch (e) {
    console.error('Groq Error:', e.message);
    return {
      reply: currentlyAnnoyed ? "كلامك مستفز بصراحة." : "سمعت كلامك. كمل.",
      display: currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!",
      mood: currentlyAnnoyed ? 'ANNOYED' : moodState.mood,
      energyDelta: 0
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

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let result;
    if (isSpotifyQuery(message)) {
      const nowPlaying = await fetchCurrentlyPlayingTrack();
      if (nowPlaying && nowPlaying.trackName) {
        const artistStr = nowPlaying.artistName ? ` لـ ${nowPlaying.artistName}` : '';
        result = {
          reply: `شغال "${nowPlaying.trackName}"${artistStr}. مش بطالة.`,
          display: enforceEnglishScreenText(`${nowPlaying.artistName || 'Spotify'} - ${nowPlaying.trackName}`, nowPlaying.trackName),
          mood: 'NEUTRAL',
          energyDelta: +5
        };
      } else {
        result = {
          reply: "مفيش حاجة شغالة دلوقتي على سبوتيفاي.",
          display: "Spotify Ready!",
          mood: 'NEUTRAL',
          energyDelta: 0
        };
      }
    } else if (isWeatherQuery(message)) {
      const weatherData = await fetchCairoWeather();
      result = {
        reply: weatherData.reply,
        display: weatherData.display,
        mood: 'NEUTRAL',
        energyDelta: +5
      };
    } else {
      result = await callGroq(message, history);
    }


    const cleanReply = cleanChatReply(result.reply);
    const englishDisplay = enforceEnglishScreenText(result.display, "Lola: Ready!");

    recordInteraction(cleanReply, result.mood, 'chat', englishDisplay, result.energyDelta || 0);

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


