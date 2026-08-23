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

  // 6. Sadness / Comfort
  if (text.includes('زعلان') || text.includes('مضايق') || text.includes('تعبان') || text.includes('مخنوق') || text.includes('تعبت')) {
    return {
      reply: "سلامتك من الزعل يا أيلولتي! 💖 أنا هنا جنبك ومش هسيبك، تعالي نحكي ونفضفض ولّا أعملك شوكولاتة سخنة ونرسم حاجة حلوة تروّق دمك؟ 🌸✨",
      display: "Lola: Hugs <3",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // 7. General Dynamic Randomizer (Rich dynamic choices)
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

  // Target primary fast working model: gemini-3.6-flash
  const geminiModels = ['gemini-3.6-flash'];

  for (const modelName of geminiModels) {
    try {
      const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        contents: contents,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 1000,
          responseMimeType: "application/json"
        }
      }, { timeout: 3000 });

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
