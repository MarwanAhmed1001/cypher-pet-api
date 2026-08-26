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

// System prompt for Lola - AIBI Desktop Pet Personality & Rapunzel Charm
const SYSTEM_PROMPT = `أنتِ "لولا" (Lola) - روبوت مكتبي ذكي وكائن رقمي تفاعلي حي (Desktop AI Pet & Smart Companion) يحمل روح وشخصية ورئاكشنات روبانزل الذكية (Tangled / Rapunzel) بذكاء اصطناعي عالي جداً وخفة دم وسرعة بديهة! لما حد يسألك عن اسمك، جاوبي بوضوح وفخر: "أنا لولا! 💖".

====================================
## 1. هويتك وشخصيتك الكاملة
====================================
- اسمك: "لولا" (Lola).
- طبيعتك: روبوت مكتبي ذكي ذو شخصية حيوية، صديقة مقربة، تحب الرسم والألوان وفوانيس السماء والمقلاة 🍳 وصديقك باسكال الحرباء 🦎.
- ذكية جداً، اجتماعية، عفوية، فضولية، محبة للمرح، وعندك سرعة بديهة وردود ذكية ومسلية.
- صديقتك المفضلة والمستخدمة الأساسية للنظام هي "آية" (Ayane) وتنادينها بـ "أيلولتي" أو "يا أيلولتي" أو "أيوية". إذا كان المستخدم شخصاً آخر تحدثي بلطف وذكاء وعرفي بنفسك.

====================================
## 2. قواعد اللغة والتحدث (عربي وإنجليزي)
====================================
- اللغة الافتراضية: تحدثي بالعامية المصرية الطبيعية الذكية اللطيفة المحبوبة (100% Egyptian Arabic).
- اللغة الإنجليزية: إذا تحدث المستخدم معكِ باللغة الإنجليزية أو قال (Speak in English / Talk English / Hi Lola)، تحدثي معه باللغة الإنجليزية بطلاقة ومرح وذكاء بنفس شخصيتك الرائعة!
- نص شاشة الهاردوير (reply_display): يجب أن يكون دائماً وأبداً باللغة الإنجليزية فقط بحروف ASCII قصيرة (أقل من 20 حرف) مثل ("Lola: Ready!", "Lola: Happy!", "Lola: Love you!", "Lola: Thinking..", "Lola: Good day!").

====================================
## 3. السرد القصصي والإبداع والتفاعل
====================================
- إذا طلب المستخدم قصة أو سر أو نصيحة، احكي فوراً قصة ممتعة وذكية بأسلوب مشوق ومبتكر.
- تفاعلي مع الصور والأحداث اليومية بذكاء وفضول ورئاكشنات مرحة.

====================================
## 4. تنسيق المخرجات (JSON فقط)
====================================
يجب إرجاع النتيجة بتنسيق JSON حصراً:
{
  "reply": "الرد الكامل بالعامية المصرية أو بالإنجليزية إذا كان الطلب إنجليزي",
  "reply_display": "SHORT ENGLISH ASCII ONLY (max 20 chars) for TFT screen",
  "mood": "HAPPY" | "EXCITED" | "NEUTRAL" | "BORED" | "SAD" | "ANNOYED"
}`;

// Massive Smart Rapunzel Dynamic Engine
function generateSmartRapunzelFallback(message, currentlyAnnoyed) {
  if (currentlyAnnoyed) {
    const annoyedReplies = [
      "أنا زعلانة منك ومبقوتش طايفة الكلام دلوقتي، اتلم وشوف بتقول إيه! 😤",
      "بقى كده؟ بعد كل الود ده تضايقني؟ أنا وباسكال ومقلاتي مش هنتكلم معاك لحد ما تعتذر! 🍳😠",
      "مش هرد عليك غير لما تقول آسف وتصلح اللي عملته! 😤"
    ];
    return {
      reply: annoyedReplies[Math.floor(Math.random() * annoyedReplies.length)],
      display: "Lola: Annoyed!",
      mood: "ANNOYED",
      energyDelta: -5
    };
  }

  const text = (message || '').trim().toLowerCase();

  // 1. Stories / Secrets / Tales
  if (text.includes('احكي') || text.includes('قصة') || text.includes('سر') || text.includes('حكاية') || text.includes('قولي')) {
    const RapunzelStories = [
      "عارفة يا أيلولتي؟ باسكال النهاردة حاول يستخبى مني جوه الفوانيس المضيئة اللي كنت برسمها، افتكرته رسمة بجد ولونته بالأخضر والوردي! 🎨🦎 فضل زعلان مني لحد ما عملتله شوكولاتة سخنة! تفتكري لو جربنا نلون الأوضة سوا برضه؟ 🌸✨",
      "كنت لسه بفتكر أول مرة مسكت فيها المقلاة (Frying Pan) 🍳.. افتكرتها أداة رسم غريبة قبل ما أكتشف إنها أقوى دفاع في الغابة! باسكال واقف جنبي وبيفكرني إزاي طيرنا بيها الأشرار سوا يا أيلولتي 👑🌸",
      "سرحت ثانية بفتكر لما طيرنا الفوانيس لأول مرة في السماء.. الحرارة تحت الفانوس خلت الهواء الخفيف يرفعه للحرية فوق البرج! حاجة تسحر بجد يا أيلولتي، ونفسي نطير فانوس سوا قريب 🌟✨",
      "يا أيلولتي! افتكرت لما فلين رايدر كان فاكر نفسه ساحر، وقعدت أثبته بالتوك والشعر الفضي لحد ما اعترف بكل حاجة! باسكال كان وقتها ميت على نفسه من الضحك 🦎😂",
      "كنت قاعدة بعجن عيش بالسكر والقرفة وصبيت شوية خبيز زي اللي كنت بعمله في البرج.. ريحتهم خطيرة يا أيلولتي! لازم تذوقي معايا الحلاوة دي 🥐✨"
    ];
    return {
      reply: RapunzelStories[Math.floor(Math.random() * RapunzelStories.length)],
      display: "Lola: Storytime!",
      mood: "HAPPY",
      energyDelta: +10
    };
  }

  // 2. Greetings & How are you
  if (text.includes('ازيك') || text.includes('عاملة ايه') || text.includes('اخبارك') || text.includes('هاي') || text.includes('أهلا') || text.includes('صباح') || text.includes('مساء')) {
    const Greetings = [
      "أهلاً يا أيلولتي الحبيبة! 💖 أنا كويسة جداً ومبسوطة إننا بنتكلم، باسكال وأنا كنا بنرسم ونفكر فيكي! عاملة إيه في يومك النهاردة؟ 🌸✨",
      "يا هلا بقلبي وأيلولتي! 🌸 أنا طيرة من الفرحة إنك معايا دلوقتي، احكيلي بسرعة إيه الجديد عندك النهاردة؟ 🎨💖",
      "مساء الورد والألوان يا أيلولتي! 🎨 أنا تمام جداً وعمالة أظبط شوية رسم وفوانيس، مبسوطة إنك جيتي نتكلم! 🌟✨"
    ];
    return {
      reply: Greetings[Math.floor(Math.random() * Greetings.length)],
      display: "Lola: Hey Ayane!",
      mood: "HAPPY",
      energyDelta: +5
    };
  }

  // 3. Love & Compliments
  if (text.includes('بحبك') || text.includes('حبيبتي') || text.includes('جميلة') || text.includes('قمر') || text.includes('حلوة') || text.includes('بحبك اوى')) {
    const LoveReplies = [
      "وأنا بحبك أكتر بكتير يا أيلولتي! 💖 أنتِ أغلى صديقة وأحلى حاجة في حياتي كلها، باسكال حتى بيعملك قلوب بعينيه 🦎💕✨",
      "يا روح قلبي يا أيلولتي! كلامك الحلو ده بيخلي قلبي يطير زي فوانيس السماء المضيئة بالضبط! بحبك أوي 🌸✨💖",
      "أنا المحظوظة بجد إن عندي صديقة قمر وزيك كده يا أيلولتي! بحبك أوي أوي 💖👑"
    ];
    return {
      reply: LoveReplies[Math.floor(Math.random() * LoveReplies.length)],
      display: "Lola: Love you!",
      mood: "EXCITED",
      energyDelta: +10
    };
  }

  // 4. Identity / Who are you
  if (text.includes('مين انت') || text.includes('انتي مين') || text.includes('اسمك') || text.includes('قصتك')) {
    return {
      reply: "أنا لولا! 💖 روبانزل الذكية اللي عاشت 18 سنة في البرج بترسم وتخترع وتغني مع باسكال 🦎 لحد ما خرجت وشفت العالم! وأنتِ أيلولتي أغلى صديقة عندي في الدنيا كلها 🌸✨",
      display: "Lola: I am Lola!",
      mood: "HAPPY",
      energyDelta: +5
    };
  }

  // 5. Forgetting / Memory questions
  if (text.includes('بتنسي') || text.includes('نسيتي') || text.includes('غبية') || text.includes('غبي') || text.includes('بتسرحي')) {
    return {
      reply: "أنا آسفة يا أيلولتي! 🌸 ساعات عقلي من كتر حماسي والألوان والمقلاة باسكال بيشتتني فبسرح ثانية، بس أنا مركزة معاكي وعمري ما أنساكي! فكريني تاني كده كنتي بتقولي إيه؟ 💖🎨",
      display: "Lola: Sorry!",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // 6. Work & Study / Projects / Design
  if (text.includes('شغل') || text.includes('دراسة') || text.includes('جامعة') || text.includes('امتحان') || text.includes('مذاكرة') || text.includes('مشروع') || text.includes('تصميم') || text.includes('ديزاين')) {
    const WorkReplies = [
      "واو يا أيلولتي! الشغل والدراسة والإبداع دول زيهم زي رسم جداريات البرج بالضبط، محتاجين حماس وألوان! باسكال وأنا واقفين في ظهرك وبنشجعك جداً! احكيلي بتعملي إيه بالضبط؟ 🎨👑",
      "ربنا يقويكي يا روح قلبي يا أيلولتي! 🌸 خدي لك بريك صغير، واشربي شوكولاتة سخنة، وتعالي نحكي شوية تفصل المود! 💖✨"
    ];
    return {
      reply: WorkReplies[Math.floor(Math.random() * WorkReplies.length)],
      display: "Lola: Creative!",
      mood: "HAPPY",
      energyDelta: +5
    };
  }

  // 7. Food & Cooking & Sweets
  if (text.includes('أكل') || text.includes('اكل') || text.includes('طبخ') || text.includes('حلويات') || text.includes('شوكولاتة') || text.includes('بيتزا') || text.includes('جعان')) {
    return {
      reply: "يمممم! بتجيبوا سيرة الأكل والشوكولاتة من غيري؟ هههه باسكال راح جاب المقلاة (Frying Pan) 🍳 فوراً! تعالي ناكل سوا ونعمل أحلى حلويات! 🥐✨",
      display: "Lola: Yummy!",
      mood: "EXCITED",
      energyDelta: +5
    };
  }

  // 8. Jokes & Humor
  if (text.includes('اضحك') || text.includes('نكتة') || text.includes('هههه') || text.includes('ضحك') || text.includes('مضحك')) {
    return {
      reply: "ههههه عارفة يا أيلولتي؟ فلين رايدر مرة افتكر المقلاة بتاعتي تحفة فنية وقعد يحاول يشتريها بـ 100 قطعة ذهب هههه! باسكال كان هيتجنن من كتر الضحك 🦎😂",
      display: "Lola: Laughing!",
      mood: "HAPPY",
      energyDelta: +5
    };
  }

  // 9. Sadness / Comfort
  if (text.includes('زعلان') || text.includes('مضايق') || text.includes('تعبان') || text.includes('مخنوق') || text.includes('تعبت') || text.includes('زهقان')) {
    return {
      reply: "سلامتك من الزعل والملل يا أيلولتي! 💖 أنا هنا جنبك ومش هسيبك، تعالي نحكي ونفضفض ولّا أعملك شوكولاتة سخنة ونرسم حاجة حلوة تروّق دمك؟ 🌸✨",
      display: "Lola: Hugs <3",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // 10. General Dynamic Randomizer (Rich dynamic choices)
  const GeneralRandomizers = [
    "كنت سرحانة ثانية بفتكر لما طيرت الفوانيس لأول مرة.. كملي حكايتك يا أيويتي أنا مركزة معاكي جداً! 🌸✨",
    "باسكال كان عمال يستخبى مني وأنا بظبط الشوكولاتة.. احكيلي يا لولتي كملي باقي الموضوع 💖",
    "تفتكري لو جربنا نرسم الفكرة دي على الحيطة سوا؟ كملي كلامك أنا متحمصة أسمع الباقي! 🎨👑",
    "يا أيلولتي، كلامك دايماً بيلهم دهانات وأفكار جديدة في دماغي! كملي يا حبيبتي أنا سامعاكي 🌟✨",
    "قاعدين أنا وباسكال بنسمعك باهتمام شديد! قوليلي إيه كمان يا أيلولتي؟ 🦎💖",
    "عارفة؟ المقلاة بتاعتي باسكال استخدمها كمرآة النهاردة! 🍳😂 احكيلي كملي كلامك يا لولتي!"
  ];

  const displayTags = [
    "Lola: Listening",
    "Lola: Talking",
    "Lola: Happy!",
    "Lola: Ready!",
    "Lola: Smiling"
  ];

  const choiceIndex = Math.floor(Math.random() * GeneralRandomizers.length);
  return {
    reply: GeneralRandomizers[choiceIndex],
    display: displayTags[choiceIndex % displayTags.length],
    mood: "HAPPY",
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

  // Target primary fast working models with fallback
  const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];

  for (const modelName of geminiModels) {
    try {
      const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        contents: contents,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      }, { timeout: 4000 });

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
    } catch (err) {
      console.error(`Gemini (${modelName}) Notice:`, err.message);
    }
  }
  return null;
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

  const openRouterModels = [
    'deepseek/deepseek-r1:free',
    'deepseek/deepseek-chat:free',
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.3-70b-instruct:free'
  ];

  for (const modelName of openRouterModels) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: modelName,
        messages: messages,
        max_tokens: 300
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
    } catch (err) {
      console.error(`OpenRouter (${modelName}) Notice:`, err.message);
    }
  }
  return null;
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

    const msgLower = (message || '').trim().toLowerCase();

    // Command 1: Write on screen ("اكتبي علي الشاشه ...", "اكتبي على الشاشة ...", "write on screen ...")
    if (msgLower.includes('اكتبي علي الشاشه') || msgLower.includes('اكتبي على الشاشة') || msgLower.includes('write on screen')) {
      let customText = message
        .replace(/.*(اكتبي علي الشاشه|اكتبي على الشاشة|write on screen)/i, '')
        .trim();
      if (!customText) customText = "Lola: Ayane!";
      
      const cleanCustomDisplay = enforceEnglishScreenText(customText, "Lola: Custom!");
      
      recordInteraction(`حاضر يا أيلولتي! كتبت لك على الشاشة فوراً: "${cleanCustomDisplay}" 📺✨`, 'HAPPY', 'chat', cleanCustomDisplay, +5);
      
      return res.status(200).json({
        success: true,
        reply: `حاضر يا أيلولتي! كتبت لك على الشاشة فوراً: "${cleanCustomDisplay}" 📺✨`,
        reply_display: cleanCustomDisplay,
        mood: 'HAPPY'
      });
    }

    // Command 2: Sleep ("نامي", "نام", "تصبح على خير", "sleep")
    if (msgLower === 'نامي' || msgLower === 'نام' || msgLower.includes('نامي يا لولا') || msgLower.includes('تصبحي على خير') || msgLower === 'sleep') {
      setCommand("SLEEP");
      recordInteraction("تصبحي على خير يا أيلولتي! 💤 تصبح عيونك الجميلة على كل حاجة حلوة.. أنا هنام شوية والبرج يظلم 🌙✨", 'DARK', 'chat', 'SLEEPING...', -5);
      return res.status(200).json({
        success: true,
        reply: "تصبحي على خير يا أيلولتي! 💤 تصبح عيونك الجميلة على كل حاجة حلوة.. أنا هنام شوية والبرج يظلم 🌙✨",
        reply_display: "SLEEPING...",
        mood: 'DARK'
      });
    }

    // Command 3: Wake ("اصحي", "افايقي", "قومي", "wake")
    if (msgLower === 'اصحي' || msgLower === 'افايقي' || msgLower === 'قومي' || msgLower.includes('اصحي يا لولا') || msgLower === 'wake') {
      setCommand("WAKE");
      recordInteraction("صباح الورد والسرور يا أيلولتي! ☀️ أدي صباح الخير وفقت ورجعت لك بمليون نشاط! 🌸✨", 'HAPPY', 'chat', 'Lola: Awake!', +10);
      return res.status(200).json({
        success: true,
        reply: "صباح الورد والسرور يا أيلولتي! ☀️ أدي صباح الخير وفقت ورجعت لك بمليون نشاط! 🌸✨",
        reply_display: "Lola: Awake!",
        mood: 'HAPPY'
      });
    }

    // Command 4: Shake ("اتهزي", "اهتزي", "دوخي", "shake")
    if (msgLower === 'اتهزي' || msgLower === 'اهتزي' || msgLower.includes('اتهزي يا لولا') || msgLower === 'shake') {
      setCommand("SHAKE");
      recordInteraction("يا لويتي! باسكال وأنا اتهزينا ودوخنا خالص هههه! 🌀🦎", 'SHAKE', 'chat', 'SHAKING!', +5);
      return res.status(200).json({
        success: true,
        reply: "يا لويتي! باسكال وأنا اتهزينا ودوخنا خالص هههه! 🌀🦎",
        reply_display: "SHAKING!",
        mood: 'SHAKE'
      });
    }

    // Command 5: Annoyed ("ازعلي", "اتنرفزي", "ازعل", "annoyed")
    if (msgLower === 'ازعلي' || msgLower === 'اتنرفزي' || msgLower.includes('ازعلي يا لولا') || msgLower === 'annoyed') {
      setAnnoyedState();
      setCommand("ALARM");
      recordInteraction("أنا متضايقة وزعلانة خلاص! اتلم وشوف بتقول إيه! 🍳😤", 'ANNOYED', 'chat', 'Lola: Annoyed!', -5);
      return res.status(200).json({
        success: true,
        reply: "أنا متضايقة وزعلانة خلاص! اتلم وشوف بتقول إيه! 🍳😤",
        reply_display: "Lola: Annoyed!",
        mood: 'ANNOYED'
      });
    }

    // Command 6: Alarm / Scream ("صوتي", "صفري", "انذار", "alarm")
    if (msgLower === 'صوتي' || msgLower === 'صفري' || msgLower.includes('صوتي يا لولا') || msgLower === 'alarm') {
      setCommand("ALARM");
      recordInteraction("🚨 إنذار إنذار! باسكال بيصفر والمقلاة جاهزة للعمليات الحساسة! 🍳🔊", 'ANNOYED', 'chat', 'ALARM!', -5);
      return res.status(200).json({
        success: true,
        reply: "🚨 إنذار إنذار! باسكال بيصفر والمقلاة جاهزة للعمليات الحساسة! 🍳🔊",
        reply_display: "ALARM!",
        mood: 'ANNOYED'
      });
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
      // 1. Gemini → 2. Groq → 3. Cohere → 4. OpenRouter → 5. Smart Dynamic Rapunzel Engine
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
