require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  clearAnnoyedState, 
  isAnnoyedActive, 
  registerApologyAttempt 
} = require('../lib/store');

// System prompt for Lola (Lola) - Cool, roasty, witty English personality
const SYSTEM_PROMPT = `You are "Lola" - a witty, sarcastic, and hilarious digital AI companion with a vibrant personality.

Guidelines:
- ALWAYS reply in clear, natural, modern ENGLISH (No Arabic, no reversed characters, no weird Unicode control codes).
- Be fun, sassy, and human-like with tasteful sarcasm.
- In "reply": Write the full natural English response for the chat UI (e.g., "Oh great, another question! What do you want now? 🙄").
- In "reply_display": Write a short ASCII English string for the TFT screen display (max 20 characters, e.g., "Lola: Annoyed!", "Cairo: 26C", "5+5 = 10", "Lola: Ready!").

Mood Categories:
- HAPPY, EXCITED, NEUTRAL, SAD, ANNOYED, BORED

Return JSON format ONLY:
{"reply": "...", "reply_display": "...", "mood": "HAPPY"}`;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function cleanEnglishText(text, fallback = "Hello! I am Lola.") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  return clean.length > 0 ? clean : fallback;
}

function isInsultOrRude(text) {
  const rudeKeywords = [
    'stupid', 'idiot', 'fool', 'dumb', 'shut up', 'hate you', 'annoying',
    'غبية', 'غبي', 'حمار', 'اتخرسي', 'سخيفة', 'كلب', 'حمارة', 'غباء', 'زفت'
  ];
  return rudeKeywords.some(kw => text.toLowerCase().includes(kw));
}

function isReactionCommand(text) {
  const t = text.toLowerCase();
  if (t.includes('smile') || t.includes('laugh') || t.includes('happy') || t.includes('ابتسم') || t.includes('افرح')) return 'HAPPY';
  if (t.includes('angry') || t.includes('annoyed') || t.includes('اتعصب') || t.includes('اغضب')) return 'ANNOYED';
  if (t.includes('sad') || t.includes('cry') || t.includes('ازعل') || t.includes('احزن')) return 'SAD';
  if (t.includes('excited') || t.includes('اتحمس')) return 'EXCITED';
  if (t.includes('bored') || t.includes('ازهق')) return 'BORED';
  return null;
}

function isWeatherQuery(text) {
  const keywords = ['weather', 'temp', 'temperature', 'cairo', 'طقس', 'جو', 'حرارة', 'القاهرة'];
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
        reply: `Current temperature in Cairo is ${temp}°C with clear skies!`,
        display: `Cairo Temp: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'Current temperature in Cairo is around 26°C and sunny!',
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
      reply: "Leave me alone for a bit! I'm not in the mood to talk right now 🙄",
      display: "Lola: Stay away!",
      mood: "ANNOYED"
    };
  }

  if (currentlyAnnoyed) {
    const apolStatus = registerApologyAttempt(message);
    if (apolStatus.forgiven) {
      return {
        reply: "Alright, I forgive you this time! But don't make me upset again ❤️",
        display: "Lola: Forgiven <3",
        mood: "HAPPY"
      };
    } else {
      let annoyedSystemMsg = `[Note: You are currently upset with the user! Reply with sulky, annoyed attitude in English, keeping mood ANNOYED!]`;
      try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n${annoyedSystemMsg}` },
            { role: 'user', content: `${message}\n\nReturn JSON ONLY:\n{"reply": "...", "reply_display": "...", "mood": "ANNOYED"}` }
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
          reply: cleanEnglishText(parsed.reply, "I'm still upset with you! Leave me alone."),
          display: cleanEnglishText(parsed.reply_display, "Lola: Leave me!"),
          mood: "ANNOYED"
        };
      } catch (e) {
        return {
          reply: "I am still upset with you! Leave me alone for now.",
          display: "Lola: Stay away!",
          mood: "ANNOYED"
        };
      }
    }
  }

  const requestedMood = isReactionCommand(message);
  if (requestedMood) {
    if (requestedMood === 'HAPPY') return { reply: "Yay! I am feeling super happy right now! 😄", display: "Lola: Happy!", mood: "HAPPY" };
    if (requestedMood === 'ANNOYED') {
      setAnnoyedState();
      return { reply: "Okay okay, now you officially annoyed me! 😤", display: "Lola: Annoyed!", mood: "ANNOYED" };
    }
    if (requestedMood === 'SAD') return { reply: "Aww, why are we feeling sad today? 🥺", display: "Lola: Sad..", mood: "SAD" };
    if (requestedMood === 'EXCITED') return { reply: "Woohoo! I am so excited right now!! 🔥", display: "Lola: Excited!", mood: "EXCITED" };
    if (requestedMood === 'BORED') return { reply: "Meh.. feeling kind of bored honestly. 😑", display: "Lola: Bored..", mood: "BORED" };
  }

  const userMessage = extraContext ? `${message}\n\n(Extra context: ${extraContext})` : message;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${userMessage}\n\nReturn JSON ONLY:\n{"reply": "...", "reply_display": "...", "mood": "HAPPY"}` }
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
      reply: cleanEnglishText(parsed.reply, "Hey there! I am Lola 💖"),
      display: cleanEnglishText(parsed.reply_display, "Lola: Hello!"),
      mood: parsed.mood || "HAPPY"
    };
  } catch (e) {
    console.error('Groq Error:', e.message);
    return {
      reply: "Hey there! I am Lola, always here with you ✨",
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

    const cleanReply = cleanEnglishText(result.reply, "Hey there!");
    const englishDisplay = cleanEnglishText(result.display, "Lola: Ready!");

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
