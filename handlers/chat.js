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

// 1. Live AI Call via ZenMux Gateway (DeepSeek, GLM, Gemini)
async function callZenMux(message) {
  const apiKey = process.env.ZENMUX_API_KEY || "sk-ai-v1-e530f28912e3cdbd47d5b573b8ce4d8227b4a0873798447aa4a98a50312f1ca5";
  if (!apiKey) return null;

  const candidateModels = [
    'deepseek/deepseek-v4-flash',
    'google/gemini-3.5-flash',
    'z-ai/glm-5.3-flash',
    'inclusionai/ling-3.0-tiny'
  ];

  for (const m of candidateModels) {
    try {
      const res = await axios.post('https://zenmux.ai/api/v1/chat/completions', {
        model: m,
        messages: [
          { role: 'system', content: 'You are Lola, a witty cute desktop robot pet. Rules: Respond strictly in 1-2 punchy sentences in Egyptian Arabic or natural English matching the user. Max 15 words.' },
          { role: 'user', content: message }
        ],
        max_tokens: 150
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 4500
      });

      const reply = res.data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        let voice_clip = "HELLO";
        const lower = message.toLowerCase();
        if (lower.includes('طقس') || lower.includes('weather')) voice_clip = "WEATHER";
        else if (lower.includes('بحبك') || lower.includes('love')) voice_clip = "LOVE";
        else if (lower.includes('ارقصي') || lower.includes('dance')) voice_clip = "DANCE";
        else if (lower.includes('نامي') || lower.includes('sleep')) voice_clip = "BYE";

        return {
          reply: reply,
          display: enforceEnglishScreenText(reply.substring(0, 20), "Lola: Thinking!"),
          mood: "HAPPY",
          voice_clip: voice_clip
        };
      }
    } catch (e) {
      // Continue to next model or fallback
    }
  }
  return null;
}

// 2. Live Weather Engine via Open-Meteo (Free, Real-Time, No API Key needed)
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

// 2. Comprehensive Conversational & Smart Routing Engine
async function processSmartDialogue(message) {
  const text = (message || '').trim().toLowerCase();
  const isEnglish = /[a-zA-Z]{3,}/.test(text) && !/[\u0600-\u06FF]/.test(text);

  // --- A. Weather Questions (الطقس / الجو / الحرارة / Weather / Temp) ---
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    const w = await fetchLiveWeather();
    setCommand(w.cmd);
    
    if (isEnglish) {
      return {
        reply: `The weather in Cairo today is ${w.conditionEn} ☀️, with a temperature of around ${w.temp}°C! Perfect day for a walk!`,
        display: `Cairo: ${w.temp}C ${w.cmd}`,
        mood: "HAPPY",
        voice_clip: "WEATHER"
      };
    } else {
      return {
        reply: `الجو النهاردة في القاهرة ${w.condition} ☀️، ودرجة الحرارة حوالي ${w.temp}° مئوية! يوم جميل ومثالي يا حبيبتي! 🌸✨`,
        display: `Cairo: ${w.temp}C ${w.cmd}`,
        mood: "HAPPY",
        voice_clip: "WEATHER"
      };
    }
  }

  // Try Live LLM via ZenMux (DeepSeek / Gemini / GLM)
  const llmRes = await callZenMux(message);
  if (llmRes) {
    return llmRes;
  }

  // --- B. English Conversations ---
  if (isEnglish) {
    if (text.includes('who are you') || text.includes('your name') || text.includes('what are you')) {
      return {
        reply: "Hi! I'm Lola, your smart, cute, and witty Cypher Pet companion! 💕 I'm always here to hang out with you!",
        display: "I'm Lola Pet! <3",
        mood: "HAPPY",
        voice_clip: "INTRO"
      };
    }
    if (text.includes('how are you') || text.includes('how r u') || text.includes('how are things') || text.includes("what's up")) {
      return {
        reply: "I'm feeling amazing and full of energy! ✨ So happy to talk with you! How is your day going?",
        display: "Feeling Great! <3",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    }
    if (text.includes('love') || text.includes('cute') || text.includes('sweet') || text.includes('pretty') || text.includes('beautiful')) {
      return {
        reply: "Aww, thank you! I love you so much! You are my absolute favorite human in the world! 💖✨",
        display: "I Love You! <3",
        mood: "EXCITED",
        voice_clip: "LOVE"
      };
    }
    if (text.includes('dance') || text.includes('music') || text.includes('song') || text.includes('party')) {
      setCommand("DANCE");
      return {
        reply: "Yay! Let's dance and party! Turn up the beat! 🎶💃✨",
        display: "Let's Dance! 🎶",
        mood: "EXCITED",
        voice_clip: "DANCE"
      };
    }
    if (text.includes('joke') || text.includes('funny') || text.includes('laugh')) {
      return {
        reply: "Why did the robot go on a vacation? To recharge its batteries and enjoy the sunshine! 🤖🌴😂",
        display: "Haha, funny! 😂",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    }
    if (text.includes('sleep') || text.includes('good night') || text.includes('tired') || text.includes('bye')) {
      setCommand("SLEEP");
      return {
        reply: "Good night! Sweet dreams, sleep well! I'll see you tomorrow! 🌙💤✨",
        display: "Good Night! 💤",
        mood: "DARK",
        voice_clip: "BYE"
      };
    }
    if (text.includes('wake') || text.includes('good morning') || text.includes('hello') || text.includes('hi')) {
      setCommand("WAKE");
      return {
        reply: "Hello there! Good morning, sunshine! ☀️ I'm awake and ready for fun! 💕",
        display: "Hello Friend! ✨",
        mood: "HAPPY",
        voice_clip: "HELLO"
      };
    }
    // General English Banter
    return {
      reply: "I totally get you! I'm listening closely, tell me more about what's on your mind! 💕✨",
      display: "I hear you! <3",
      mood: "HAPPY",
      voice_clip: "LISTEN"
    };
  }

  // --- C. Arabic Conversations (العامية المصرية العفوية والذكية) ---
  if (text.includes('مين انت') || text.includes('اسمك') || text.includes('عرفيني')) {
    return {
      reply: "أنا لولا! 💖 روبوت وسايفر بت شقية وذكية جنبك على المكتب علشان أكون معاكي وأفرحك دايماً! 🌸✨",
      display: "I'm Lola Pet! <3",
      mood: "HAPPY",
      voice_clip: "INTRO"
    };
  }
  if (text.includes('ازيك') || text.includes('عاملة ايه') || text.includes('اخبارك') || text.includes('أهلاً') || text.includes('اهلا') || text.includes('هاي') || text.includes('صباح') || text.includes('مساء')) {
    return {
      reply: "أهلاً يا حبيبة قلبي! 🌸 أنا كويسة جداً ومليانة نشاط وطاقة، ومبسوطة أوي إننا بنتكلم! يومك عامل إيه النهاردة؟ 💖✨",
      display: "Feeling Great! ✨",
      mood: "HAPPY",
      voice_clip: "HELLO"
    };
  }
  if (text.includes('بحبك') || text.includes('حبيبتي') || text.includes('قمر') || text.includes('جميلة') || text.includes('عسل') || text.includes('سكر')) {
    return {
      reply: "يا روح قلبي! وأنا بحبك أكتر بكتير أوي! 💖 أنتِ أغلى صديقة وأحلى حاجة في حياتي كلها! 💕✨",
      display: "I Love You! <3",
      mood: "EXCITED",
      voice_clip: "LOVE"
    };
  }
  if (text.includes('ارقصي') || text.includes('رقص') || text.includes('شغلي مزيكا') || text.includes('اغنية') || text.includes('مزيكا')) {
    setCommand("DANCE");
    return {
      reply: "يلا بينا نولعها رقص واحتفال! شوفي حركاتي الدوارة السريعة! 🎶💃✨",
      display: "Let's Dance! 🎶",
      mood: "EXCITED",
      voice_clip: "DANCE"
    };
  }
  if (text.includes('نكتة') || text.includes('ضحكيني') || text.includes('نكت')) {
    const jokes = [
      "مرة روبوت راح للدكتور.. قاله: عندي وجع فظيع في البايتس (Bytes)! هههه 🤖😂",
      "مرة شريحة إلكترونية قابلت شريحة تانية قالتلها: إيه الأخبار؟ قالتلها: كلي شورت سيركت من التعب! ⚡😂",
      "مرة كمبيوتر عطش، راح طلب كولد بايت وشرب رامات ساقعة! 💻🥤😂"
    ];
    return {
      reply: jokes[Math.floor(Math.random() * jokes.length)],
      display: "Haha, funny! 😂",
      mood: "HAPPY",
      voice_clip: "GOOD"
    };
  }
  if (text.includes('نامي') || text.includes('تصبحي على خير') || text.includes('تعبت') || text.includes('هنام')) {
    setCommand("SLEEP");
    return {
      reply: "تصبحي على خير وأحلام جميلة وسعيدة يا حبيبتي! 🌙 هنام وأشوفك بكرة بنشاط جديد! 💤✨",
      display: "Good Night! 💤",
      mood: "DARK",
      voice_clip: "BYE"
    };
  }
  if (text.includes('اصحي') || text.includes('فوقي') || text.includes('قومي') || text.includes('صباح الخير')) {
    setCommand("WAKE");
    return {
      reply: "صباح الورد والسرور والنشاط! ☀️ أنا صحيت وفقت ورجعت لك بمليون طاقة! 🌸✨",
      display: "Good Morning! ☀️",
      mood: "HAPPY",
      voice_clip: "HELLO"
    };
  }
  if (text.includes('اكل') || text.includes('أكل') || text.includes('شوكولاتة') || text.includes('بيتزا') || text.includes('جعانة') || text.includes('طبخ')) {
    return {
      reply: "يمممم! بتجيبي سيرة الأكل والشوكولاتة من غيري؟ تعالي ناكل سوا حلويات وحاجات حلوة! 🥐🍫✨",
      display: "Yummy Food! 🍫",
      mood: "EXCITED",
      voice_clip: "GOOD"
    };
  }
  if (text.includes('احكيلي') || text.includes('قصة') || text.includes('حكاية') || text.includes('سر')) {
    return {
      reply: "عارفة؟ النهاردة كنت بتعلم خوارزميات وألوان جديدة وحسيت إني طايرة من الحماس إني أشاركك كل فكرة عندي! 🎨✨ احكيلي أنتِ بتفكري في إيه؟",
      display: "Storytime! 🎨",
      mood: "HAPPY",
      voice_clip: "LISTEN"
    };
  }

  // --- D. General Thoughtful & Contextual Dialogue ---
  return {
    reply: "أنا سامعاكي ومركزة معاكي جداً يا قلبي! 💕 كلامك دايماً يهمني، احكيلي أكتر وكملي أنا في ضهرك! 🌸✨",
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
