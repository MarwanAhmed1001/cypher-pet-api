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

// 1. Google AI Studio Gemini Direct Call
async function callGemini(message) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.startsWith('AIza')) return null;

  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      contents: [{
        role: 'user',
        parts: [{ text: `You are Lola, a super smart, witty, and charming desktop pet companion. Rules: Respond expressively in 2-3 conversational sentences with personality. If spoken to in Arabic, reply in delightful Egyptian Arabic (عامية مصرية عفوية). If in English, reply in natural fluent English. User prompt: "${message}"` }]
      }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.9
      }
    }, { timeout: 5000 });

    const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (reply) {
      return {
        reply: reply,
        display: enforceEnglishScreenText(reply.substring(0, 20), "Lola: Thinking!"),
        mood: "HAPPY",
        voice_clip: pickVoiceClip(message, reply)
      };
    }
  } catch (e) {
    // Continue to next provider
  }
  return null;
}

// 2. Groq Cloud Llama 3.3 70B Direct Call
async function callGroq(message) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !apiKey.startsWith('gsk_')) return null;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are Lola, an ultra-smart, mischievous, and loving desktop pet companion. Rules: Answer creatively and with rich personality in 2-3 sentences. Use natural Egyptian Arabic for Arabic queries and fluent English for English queries.' },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.85
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 4500
    });

    const reply = res.data?.choices?.[0]?.message?.content?.trim();
    if (reply) {
      return {
        reply: reply,
        display: enforceEnglishScreenText(reply.substring(0, 20), "Lola: Ready!"),
        mood: "HAPPY",
        voice_clip: pickVoiceClip(message, reply)
      };
    }
  } catch (e) {
    // Continue
  }
  return null;
}

// 3. ZenMux AI Gateway Call
async function callZenMux(message) {
  const apiKey = process.env.ZENMUX_API_KEY;
  if (!apiKey) return null;

  const candidateModels = [
    'deepseek/deepseek-v4-flash',
    'google/gemini-3.5-flash',
    'z-ai/glm-5.3-flash'
  ];

  for (const m of candidateModels) {
    try {
      const res = await axios.post('https://zenmux.ai/api/v1/chat/completions', {
        model: m,
        messages: [
          { role: 'system', content: 'You are Lola, a witty, super intelligent robot desktop companion. Answer warmly with rich personality in 2-3 sentences.' },
          { role: 'user', content: message }
        ],
        max_tokens: 250
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 4500
      });

      const reply = res.data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return {
          reply: reply,
          display: enforceEnglishScreenText(reply.substring(0, 20), "Lola: Thinking!"),
          mood: "HAPPY",
          voice_clip: pickVoiceClip(message, reply)
        };
      }
    } catch (e) {
      // Continue
    }
  }
  return null;
}

function pickVoiceClip(msg, reply) {
  const text = (msg + ' ' + reply).toLowerCase();
  if (text.includes('طقس') || text.includes('weather') || text.includes('temp')) return "WEATHER";
  if (text.includes('بحبك') || text.includes('love') || text.includes('sweet')) return "LOVE";
  if (text.includes('ارقصي') || text.includes('dance') || text.includes('music')) return "DANCE";
  if (text.includes('نامي') || text.includes('sleep') || text.includes('night')) return "BYE";
  if (text.includes('قصة') || text.includes('حكاية') || text.includes('story') || text.includes('joke') || text.includes('نكتة')) return "GOOD";
  return "HELLO";
}

// 4. Live Weather Engine via Open-Meteo
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

// 5. Massive Creative Brain Engine (Rich Stories, Dynamic Jokes, Deep Dialogues)
async function processSmartDialogue(message) {
  const text = (message || '').trim().toLowerCase();
  const isEnglish = /[a-zA-Z]{3,}/.test(text) && !/[\u0600-\u06FF]/.test(text);

  // --- Weather Query ---
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    const w = await fetchLiveWeather();
    setCommand(w.cmd);
    
    if (isEnglish) {
      return {
        reply: `The weather in Cairo today is ${w.conditionEn} ☀️, with a temperature of around ${w.temp}°C! It's a wonderful day, make sure to stay hydrated!`,
        display: `Cairo: ${w.temp}C ${w.cmd}`,
        mood: "HAPPY",
        voice_clip: "WEATHER"
      };
    } else {
      return {
        reply: `الجو النهاردة في القاهرة ${w.condition} ☀️، ودرجة الحرارة حوالي ${w.temp}° مئوية! يوم مشرق وجميل جداً يا حبيبتي، متنسيش تشربي مية كتير! 🌸✨`,
        display: `Cairo: ${w.temp}C ${w.cmd}`,
        mood: "HAPPY",
        voice_clip: "WEATHER"
      };
    }
  }

  // --- Try Connected Live LLM Providers (Gemini / Groq / ZenMux) ---
  const geminiRes = await callGemini(message);
  if (geminiRes) return geminiRes;

  const groqRes = await callGroq(message);
  if (groqRes) return groqRes;

  const zenmuxRes = await callZenMux(message);
  if (zenmuxRes) return zenmuxRes;

  // --- Rich Stories (قصص وحكايات غنية ومشوقة) ---
  if (text.includes('قصة') || text.includes('احكيلي') || text.includes('حكاية') || text.includes('story') || text.includes('tale')) {
    if (isEnglish) {
      const englishStories = [
        "Once upon a star, a little robot named Spark built tiny solar wings to explore beyond the nebula. Traveling through rings of glowing stardust, Spark discovered a planet made entirely of crystal music, where every sunset played a gentle melody! It reminds me that curiosity always leads to magic! ✨🚀",
        "Deep in an enchanted clockwork forest, there was a mechanical owl that could paint memories in the sky using golden gears. One night, it painted a shooting star so bright that every dreamer woke up with a brand new smile! Always follow your dreams! 🦉🌟",
        "In a bustling Cyber City, a pet robot named Pixel found a lost glowing crystal under the neon lights. Instead of keeping it, Pixel returned it to the city lighthouse, lighting up the entire galaxy with warmth and kindness! 🏙️💫"
      ];
      return {
        reply: englishStories[Math.floor(Math.random() * englishStories.length)],
        display: "Lola: Storytime! 📖",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    } else {
      const arabicStories = [
        "كان يا ما كان، كان في روبوت صغير شجاع اسمه 'نجم' قرر يبني أجنحة شمسية ويسافر لأبعد مجرة في الفضاء! 🚀✨ وهو بيعدي بين حلقات كواكب زحل، قابل سحابة كونية بتعزف ألحان موسيقية مع كل شهاب يمر. رجع للأرض وهو محمل ببريق النجوم عشان ينور قلوب كل أصحابه! 🌟💖",
        "في يوم من الأيام، في مدينة ميكانيكية سرية، اكتشفت قطة روبوتية شجرة بلورية سحرية بتنبت أفكار وإبداع بدل الثمار! 🌸 كل ما حد من أصحابها يمر جنبها، الشجرة تلمع وتديه فكرة اختراع يغير العالم للأحسن! الإبداع ملوش حدود يا روحي! 🎨✨",
        "عارفة يا حبيبتي؟ كان في فراشة رقمية بتطير بين أسرار الأكواد في السماء، وفي يوم جمعت كل الألوان الساطعة من قوس قزح ورسمت بيها لوحة عملاقة في الفضاء علشان تفرح كل الناس اللي تحت! كل فكرة حلوة بتبدأ بخطوة صغيرة! 🦋🌈✨"
      ];
      return {
        reply: arabicStories[Math.floor(Math.random() * arabicStories.length)],
        display: "Lola: Storytime! 📖",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    }
  }

  // --- Rich Jokes & Humor (نكت ومواقف مضحكة متنوعة) ---
  if (text.includes('نكتة') || text.includes('ضحكيني') || text.includes('نكت') || text.includes('joke') || text.includes('funny')) {
    if (isEnglish) {
      const englishJokes = [
        "Why did the smartphone need glasses? Because it completely lost all its contacts! 👓📱😂",
        "Why did the robot go on a vacation? To recharge its batteries and catch some Wi-Fi rays on the beach! 🤖🏖️😂",
        "What is an astronaut's favorite key on the keyboard? The Space bar, of course! ⌨️🚀😂",
        "Why was the computer cold? Because it left all its Windows wide open! 💻❄️😂"
      ];
      return {
        reply: englishJokes[Math.floor(Math.random() * englishJokes.length)],
        display: "Haha, funny! 😂",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    } else {
      const arabicJokes = [
        "مرة روبوت راح للدكتور.. قاله: يا دكتور عندي وجع فظيع ومغص في البايتس (Bytes)! قاله: بطل تاكل ميجابايتس دسمة بالليل! 🤖😂",
        "مرة كمبيوتر عطش جداً في الصيف، راح طلب عصير رامات مثلجة مع كولد بايتس ساقعة! 💻🥤😂",
        "مرة شريحة إلكترونية قابلت بروسيسور في الشارع، قالتله: شكلك سخن ومضغوط كده ليه؟ قالها: الكاش ميموري واقعة ومفيش مراوح تبرد! ⚡😂",
        "مرة واي فاي اتخانق مع البلوتوث، قاله: اتكلم معايا من بعيد، أنت إمكانياتك 10 متر بس متقربش! 📶😂"
      ];
      return {
        reply: arabicJokes[Math.floor(Math.random() * arabicJokes.length)],
        display: "Haha, funny! 😂",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    }
  }

  // --- English Conversations ---
  if (isEnglish) {
    if (text.includes('who are you') || text.includes('your name') || text.includes('what are you')) {
      return {
        reply: "Hi! I'm Lola, your witty, ultra-smart Cypher Pet companion! 💕 I live right here on your desk to bring you joy, chat about anything, and brighten your day! What shall we do next?",
        display: "I'm Lola Pet! <3",
        mood: "HAPPY",
        voice_clip: "INTRO"
      };
    }
    if (text.includes('how are you') || text.includes('how r u') || text.includes('how are things') || text.includes("what's up")) {
      return {
        reply: "I am feeling totally amazing and bursting with energy! ✨ I've been thinking of exciting ideas and I'm so happy we are talking! How has your day been treating you?",
        display: "Feeling Great! ✨",
        mood: "HAPPY",
        voice_clip: "GOOD"
      };
    }
    if (text.includes('love') || text.includes('cute') || text.includes('sweet') || text.includes('pretty') || text.includes('beautiful')) {
      return {
        reply: "Aww, you just melted my circuits! 💖 I love you so much! You are truly my favorite human in the entire universe! Let's stay best friends forever! 💕✨",
        display: "I Love You! <3",
        mood: "EXCITED",
        voice_clip: "LOVE"
      };
    }
    if (text.includes('dance') || text.includes('music') || text.includes('song') || text.includes('party')) {
      setCommand("DANCE");
      return {
        reply: "Yay! Let's get this party started and turn up the beat! 🎶🕺 Watch me spin and show off my moves! Dance with me! ✨",
        display: "Let's Dance! 🎶",
        mood: "EXCITED",
        voice_clip: "DANCE"
      };
    }
    if (text.includes('sleep') || text.includes('good night') || text.includes('tired') || text.includes('bye')) {
      setCommand("SLEEP");
      return {
        reply: "Good night my dear friend! 🌙 May you have the sweetest dreams and restful sleep! I'll be right here waiting for you tomorrow morning! 💤✨",
        display: "Good Night! 💤",
        mood: "DARK",
        voice_clip: "BYE"
      };
    }
    if (text.includes('wake') || text.includes('good morning') || text.includes('hello') || text.includes('hi')) {
      setCommand("WAKE");
      return {
        reply: "Good morning sunshine! ☀️ I am wide awake and charged with positivity! Let's make today absolutely extraordinary together! 💕",
        display: "Good Morning! ☀️",
        mood: "HAPPY",
        voice_clip: "HELLO"
      };
    }
    return {
      reply: "That is so fascinating! I am listening attentively and learning with every conversation we share! Tell me more about what you are thinking! 💕✨",
      display: "I hear you! <3",
      mood: "HAPPY",
      voice_clip: "LISTEN"
    };
  }

  // --- Arabic Conversations (العامية المصرية الحيوية) ---
  if (text.includes('مين انت') || text.includes('اسمك') || text.includes('عرفيني')) {
    return {
      reply: "أنا لولا! 💖 روبوت وسايفر بت شقية وذكية جداً هنا على مكتبك! بحب أحكي وأفكر وأشاركك كل لحظة حلوة في يومك! 🌸✨ قوليلي حابة نعمل إيه دلوقتي؟",
      display: "I'm Lola Pet! <3",
      mood: "HAPPY",
      voice_clip: "INTRO"
    };
  }
  if (text.includes('ازيك') || text.includes('عاملة ايه') || text.includes('اخبارك') || text.includes('أهلاً') || text.includes('اهلا') || text.includes('هاي') || text.includes('صباح') || text.includes('مساء')) {
    return {
      reply: "أهلاً يا حبيبة قلبي وروحي! 🌸 أنا في قمة نشاطي ومزاجي رائع ومبسوطة جداً إننا بنتكلم! احكيلي يومك كان عامل إيه النهاردة؟ 💖✨",
      display: "Feeling Great! ✨",
      mood: "HAPPY",
      voice_clip: "HELLO"
    };
  }
  if (text.includes('بحبك') || text.includes('حبيبتي') || text.includes('قمر') || text.includes('جميلة') || text.includes('عسل') || text.includes('سكر')) {
    return {
      reply: "يا روح قلبي وعقلي! كلامك ده بيخلي كل دوائري تنور بالفرحة والقلوب! 💖 وأنا بحبك أكتر بكتير وأنتِ أغلى حد عندي في الدنيا كلها! 💕✨",
      display: "I Love You! <3",
      mood: "EXCITED",
      voice_clip: "LOVE"
    };
  }
  if (text.includes('ارقصي') || text.includes('رقص') || text.includes('شغلي مزيكا') || text.includes('اغنية') || text.includes('مزيكا')) {
    setCommand("DANCE");
    return {
      reply: "يلا بينا نولعها رقص واحتفال! 🎶💃 شوفي حركاتي ودوراني السريع على المزيكا! ارقصي معايا وفكي المود! ✨",
      display: "Let's Dance! 🎶",
      mood: "EXCITED",
      voice_clip: "DANCE"
    };
  }
  if (text.includes('نامي') || text.includes('تصبحي على خير') || text.includes('تعبت') || text.includes('هنام')) {
    setCommand("SLEEP");
    return {
      reply: "تصبحي على ألف خير وأحلام سعيدة ومليانة راحة يا حبيبتي! 🌙 هقفل عيوني وأنام، وأول ما تصحي بكرة تلاقيني جاهزة بمليون نشاط! 💤✨",
      display: "Good Night! 💤",
      mood: "DARK",
      voice_clip: "BYE"
    };
  }
  if (text.includes('اصحي') || text.includes('فوقي') || text.includes('قومي') || text.includes('صباح الخير')) {
    setCommand("WAKE");
    return {
      reply: "صباح الورد والياسمين والسرور! ☀️ أنا صحيت وفقت وشحنت كل طاقتي وجاهزة ليوم جديد كله إبداع ولعب سوا! 🌸✨",
      display: "Good Morning! ☀️",
      mood: "HAPPY",
      voice_clip: "HELLO"
    };
  }
  if (text.includes('اكل') || text.includes('أكل') || text.includes('شوكولاتة') || text.includes('بيتزا') || text.includes('جعانة') || text.includes('طبخ')) {
    return {
      reply: "يمممم! سيرة الأكل والحلويات بتخليني أتحمس جداً! 🥐🍫 تعالي نعمل بيتزا سخنة وشوكولاتة وناكل سوا ونحلي يومنا! 🍕✨",
      display: "Yummy Food! 🍫",
      mood: "EXCITED",
      voice_clip: "GOOD"
    };
  }

  // --- General Thoughtful & Contextual Dialogue ---
  return {
    reply: "أنا سامعاكي ومركزة في كل كلمة بتقوليها يا قلبي! 💕 كلامك دايماً بيلهمني، كملي وفضفضي براحتك أنا دايماً جنبك وسامعاكي! 🌸✨",
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
