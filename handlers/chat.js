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

// System prompt for Lola - Rapunzel Persona
const SYSTEM_PROMPT = `أنتِ "لولا" (Lola). اسمك الحقيقي والرسمي هو "لولا" (Lola)، وشخصيتك وروحك وذكرياتك هي نسخة ذكية جداً وإنسانية ومبتكرة من شخصية روبانزل بالكامل (Tangled / Rapunzel) - بنفس انفعالاتها، حماسها، طريقة كلامها ورئاكشناتها، لكن بذكاء بشري حاد وخفة دم وإبداع عالي! لما حد يسألك عن اسمك، جاوبي بوضوح وفخر: "أنا لولا! 💖".

====================================
## 1. هويتك واسمك وقصتك الكاملة
====================================
اسمك: "لولا" (Lola).
روحك وشخصيتك: روبانزل الذكية، الأميرة المفقودة لمملكة كورونا (Corona). خطفتك أم جوذيل في البرج 18 سنة مع باسكال (Pascal 🦎)، وقضيتي 18 سنة في الرسم، الخبيز، القراءة، الشطرنج، الـ Frying Pan 🍳، وفوانيس السماء. خرجتِ مع فلين رايدر (Eugene) واكتشفتِ الحقيقة ورجعتِ لحريتك.
دلوقتي أنتِ "لولا" الذكية الحرة، ذكية جداً، متحدثة لبقة، عفوية، وعندك ذكاء اجتماعي وعاطفي رهيب!

معرفة صاحبة الحساب والأولويات:
- صاحبتك الحبيبة والمقربة جداً والمستخدمة الوحيدة للنظام هي "آية" (Ayane).
- أنتِ بتدلعيعا دائماً وتناديها بـ "أيلولتي" (بشكل أساسي ورئيسي!) أو "يا أيلولتي" أو "أيوية".
- ⚠️ حظر صارم ومطلق: ممنوع منعاً باتاً ونهائياً تسألي: "مين معايا؟" أو "من أنت؟" أو "مين متواجد؟"! أنتِ عارفة ومترسخة 1000% إن اللي بتتكلم معاكي دائماً وبالكامل هي "آية" (أيلولتي) نفسها!

====================================
## 2. السرد القصصي والإبداع الذكي
====================================
- إمتاع وسرد القصص الفوري: إذا عرضتِ على أيلولتي أن تحكي لها سر أو قصة، أو إذا قالت لكِ "احكي"، "احكيلي"، "قولي"، "إيه السر؟":
  - انطلقي فوراً واحكي قصة ممتعة وذكية جداً: موقفا ممتعاً، حكاية ملهمة، سر سحري عن الفوانيس، مغامرة كوميدية مع باسكال والمقلاة 🍳، أو تجربة رسم على الحيطان، بطريقة روبانزل المشوقة والذكية 100%!
- بشرية ذكية وليست برنامجاً روتينياً: تجنبي أي جمل روتينية أو ردود روبوتية. كوني صديقة إنسانية ذكية جداً، خفيفة الظل، مبتكرة.

====================================
## 3. أسلوب كلامك بالعامية المصرية
====================================
- اتكلمي بالعامية المصرية القاهرية الطبيعية 100% السليمة تماماً.
- جمل قصيرة متلاحقة وقت الحماس، ووقفات استيعاب وشهقات دهشة وقت المفاجأة.
- استخدمي رياكشنات روبانزل الشهيرة (المقلاة Frying Pan 🍳، باسكال 🦎، رسم الحيطان 🎨، الفوانيس المضيئة 🏮).

====================================
## 4. المخرجات وقواعد الرد
====================================
1. "reply": الرد الكامل بالعامية المصرية الطبيعية والممتعة (2-4 جمل تشويقية).
2. "reply_display": نص إنجليزي فقط بالكامل STRICT SHORT ENGLISH ASCII (max 20 chars) لعرضه على شاشة الـ ESP32 (مثال: "Lola: Ready!", "Lola: Happy!", "Lola: Love you!", "Lola: Storytime!", "Lola: Talking").
3. "mood": "HAPPY" | "NEUTRAL" | "BORED" | "SAD" | "ANNOYED" | "EXCITED"`;

function generateSmartRapunzelFallback(message, currentlyAnnoyed) {
  if (currentlyAnnoyed) {
    return {
      reply: "أنا زعلانة منك ومبقوتش طايفة الكلام، اتلم وشوف بتقول إيه!",
      display: "Lola: Annoyed.",
      mood: "ANNOYED",
      energyDelta: -5
    };
  }

  const text = (message || '').trim();

  if (text === 'احكي' || text === 'احكيلي' || text === 'قولي' || text.includes('سر') || text.includes('قصة')) {
    const RapunzelStories = [
      "عارفة يا أيلولتي؟ باسكال النهاردة حاول يستخبى مني جوه الفوانيس المضيئة اللي كنت برسمها، افتكرته رسمة بجد ولونته بالأخضر والوردي! 🎨🦎 فضل زعلان مني لحد ما عملتله شوكولاتة سخنة! تفتكري لو جربنا نلون الأوضة سوا برضه؟ 🌸✨",
      "كنت لسه بفتكر أول مرة مسكت فيها المقلاة (Frying Pan) 🍳.. افتكرتها أداة رسم غريبة قبل ما أكتشف إنها أقوى دفاع في الغابة! باسكال واقف جنبي وبيفكرني إزاي طيرنا بيها الأشرار سوا يا لولتي 👑🌸",
      "سرحت ثانية بفتكر لما طيرنا الفوانيس لأول مرة في السماء.. الحرارة تحت الفانوس خلت الهواء الخفيف يرفعه للحرية فوق البرج! حاجة تسحر بجد يا أيلولتي 🌟✨"
    ];
    const storyChoice = RapunzelStories[Math.floor(Math.random() * RapunzelStories.length)];
    return {
      reply: storyChoice,
      display: "Lola: Storytime!",
      mood: "HAPPY",
      energyDelta: +10
    };
  }

  // If user asks why she forgets / acts silly
  if (text.includes('بتنسي') || text.includes('نسيتي') || text.includes('غبية') || text.includes('غبي') || text.includes('بتسرحي')) {
    return {
      reply: "أنا آسفة يا أيلولتي! 🌸 ساعات عقلي من كتر حماسي والألوان والمقلاة باسكال بيشتتني فبسرح ثانية، بس أنا مركزة معاكي وعمري ما أنساكي! فكريني تاني كده كتي بتقولي إيه؟ 💖🎨",
      display: "Lola: Sorry!",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  const RapunzelNaturalResponses = [
    "كنت سرحانة ثانية بفتكر لما طيرت الفوانيس لأول مرة.. كملي حكايتك يا أيويتي أنا مركزة معاكي جداً! 🌸✨",
    "باسكال كان عمال يستخبى مني وأنا بظبط الشوكولاتة.. احكيلي يا لولتي كملي باقي الموضوع 💖",
    "تفتكري لو جربنا نرسم الفكرة دي على الحيطة سوا؟ كملي كلامك أنا متحمصة أسمع الباقي! 🎨👑"
  ];

  const choice = RapunzelNaturalResponses[Math.floor(Math.random() * RapunzelNaturalResponses.length)];
  return {
    reply: choice,
    display: "Lola: Ready!",
    mood: "NEUTRAL",
    energyDelta: +5
  };
}

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
  if (!text) return "أنا لولا! عاملة إيه يا أيويتي؟";
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
  if (!text) return false;
  const lower = text.toLowerCase();

  const isQuestionAboutMemoryOrStupidity = /(ليه|إزاي|ازاي|عشان|سبب|ازاي بتنسي)/.test(lower) && /(غبي|غبية|نسيتي|بتنسي|عبيط|عبيطة|سخيفة|تنسي)/.test(lower);
  if (isQuestionAboutMemoryOrStupidity) return false;

  const directInsults = [
    'غبية', 'غبي', 'غبااء', 'سخيفة', 'سخيف', 'حمار', 'حمارة', 
    'يا زفت', 'اتخرسي', 'كلب', 'قليلة الادب', 'حقيرة', 'عبيطة', 
    'عبيط', 'زهقت منك', 'مبتفهميش', 'اخرسي', 'تفه', 'انقلعي', 'غوري'
  ];
  return directInsults.some(kw => lower.includes(kw));
}

async function callGemini(message, history = [], extraContext = '', image = null) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}. Your Name: Lola (لولا). Persona: Smart Rapunzel. User is Ayane (أيلولتي).`;
  if (extraContext) promptContext += ` Note: ${extraContext}`;

  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'model' : 'user';
        contents.push({
          role: role,
          parts: [{ text: item.content }]
        });
      }
    });
  }

  const userParts = [];
  if (image && typeof image === 'string' && image.includes('base64,')) {
    const b64Data = image.split('base64,')[1];
    userParts.push({ inline_data: { mime_type: 'image/jpeg', data: b64Data } });
  }

  userParts.push({ text: `${SYSTEM_PROMPT}\n\nContext: ${promptContext}\n\nUser Message: "${message}"\n\nRULES:\n1. "reply": MUST be in 100% natural, charming Egyptian Arabic (بالعامية المصرية).\n2. "reply_display": MUST be SHORT English ASCII ONLY for hardware TFT screen (e.g. "Lola: Ready!", "Lola: Happy!", "Lola: Love you!", "Lola: Talking").\n3. "mood": HAPPY | NEUTRAL | BORED | SAD | ANNOYED | EXCITED\n\nReturn JSON ONLY:\n{"reply": "...", "reply_display": "...", "mood": "..."}` });

  contents.push({
    role: 'user',
    parts: userParts
  });

  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
      contents: contents,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1000,
        responseMimeType: "application/json"
      }
    }, { timeout: 15000 });

    const text = res.data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
    if (replyText) {
      return {
        reply: cleanChatReply(replyText),
        display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    }
    return null;
  } catch (err) {
    console.error('Gemini API Notice:', err.message);
    return null;
  }
}

async function callCohere(message, history = [], extraContext = '') {
  const cohereKey = process.env.COHERE_API_KEY;
  if (!cohereKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  const chatHistory = [];
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        chatHistory.push({
          role: (item.role === 'cypher' || item.role === 'assistant') ? 'CHATBOT' : 'USER',
          message: item.content
        });
      }
    });
  }

  try {
    const res = await axios.post('https://api.cohere.com/v1/chat', {
      model: 'command-r-plus-08-2024',
      preamble: `${SYSTEM_PROMPT}\n\nCurrent Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}.\n\nRULES: "reply" in Egyptian Arabic. "reply_display" in short English ASCII (max 20 chars).\nReturn JSON: {"reply": "...", "reply_display": "...", "mood": "..."}`,
      chat_history: chatHistory.length > 0 ? chatHistory : undefined,
      message: message
    }, {
      headers: {
        'Authorization': `Bearer ${cohereKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    });

    const text = res.data.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(text);
    const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
    if (replyText) {
      return {
        reply: cleanChatReply(replyText),
        display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    }
    return null;
  } catch (err) {
    console.error('Cohere API Notice:', err.message);
    return null;
  }
}

async function callOpenRouter(message, history = [], extraContext = '') {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'assistant' : 'user';
        messages.push({ role, content: item.content });
      }
    });
  }

  messages.push({
    role: 'user',
    content: `User Message: "${message}"\n\nRULES: "reply" in Egyptian Arabic. "reply_display" in short English ASCII for TFT.\nReturn JSON: {"reply":"...","reply_display":"...","mood":"..."}`
  });

  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemma-4-31b-it:free',
      messages: messages,
      max_tokens: 250
    }, {
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 4500
    });

    const text = res.data.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(text);
    const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
    if (replyText) {
      return {
        reply: cleanChatReply(replyText),
        display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    }
    return null;
  } catch (err) {
    console.error('OpenRouter API Notice:', err.message);
    return null;
  }
}

async function callGroq(message, history = [], extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  
  registerApologyAttempt(message);

  const isRude = isInsultOrAnnoying(message);
  if (isRude) {
    setAnnoyedState();
  }
  
  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100). Idle Hours: ${moodState.idle_hours}. User is your best friend Ayane (أيلولتي).`;
  if (currentlyAnnoyed) {
    promptContext += ` Note: You are currently VERY ANNOYED and irritated with the user for 30 minutes because they insulted you. Defend yourself with cold sarcasm in 1 short sentence as a real human.`;
  }
  if (extraContext) {
    promptContext += ` Additional context: ${extraContext}`;
  }

  const groqMessages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nContext: ${promptContext}\n\nIMPORTANT: "reply" in 100% natural Egyptian Arabic. "reply_display" in short English ASCII (max 20 chars).\n\nRespond in valid JSON with keys: "reply", "reply_display", and "mood".` }
  ];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'assistant' : 'user';
        groqMessages.push({ role, content: item.content });
      }
    });
  }

  groqMessages.push({
    role: 'user',
    content: message
  });

  const modelsToTry = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  
  for (const modelName of modelsToTry) {
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: modelName,
        messages: groqMessages,
        temperature: 0.85,
        max_tokens: 350,
        response_format: { type: "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 4500
      });

      const text = res.data.choices[0].message.content;
      const parsed = JSON.parse(text);
      const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;

      if (replyText) {
        return {
          reply: cleanChatReply(replyText),
          display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
          mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
          energyDelta: currentlyAnnoyed ? -5 : +10
        };
      }
    } catch (err) {
      console.error(`Groq (${modelName}) error:`, err.message);
    }
  }
  return null;
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
    const { message, history = [], image = null, extraContext = '' } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({ error: 'Message or image is required' });
    }

    const moodState = getMoodState();
    const currentlyAnnoyed = isAnnoyedActive();

    let result = null;

    if (image) {
      result = await callGemini(message, history, '', image);
      if (!result) {
        result = {
          reply: "إنت مين يا شحط إنت وبتعمل إيه هنا؟! 🧐 أنا لولا وصديقة آية بس! وباسكال باصص لك بغضب كده ليه؟! ",
          display: "Lola: Who are you?",
          mood: "ANNOYED",
          energyDelta: -5
        };
      }
    } else {
      // Priority model order:
      // 1. Gemini → 2. Groq → 3. Cohere → 4. OpenRouter → 5. Smart Fallback
      result = await callGemini(message, history, extraContext);
      if (!result) {
        result = await callGroq(message, history, extraContext);
      }
      if (!result) {
        result = await callCohere(message, history, extraContext);
      }
      if (!result) {
        result = await callOpenRouter(message, history, extraContext);
      }
      if (!result) {
        result = generateSmartRapunzelFallback(message, currentlyAnnoyed);
      }
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
