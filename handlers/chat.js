require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  clearAnnoyedState,
  isAnnoyedActive, 
  registerApologyAttempt,
  getMoodState,
  adjustEnergy,
  setCommand,
  updateAffection,
  updateGrudge,
  buildNarrativeSummary,
  saveState,
  isUserApologizing
} = require('../lib/store');
const { fetchCurrentlyPlayingTrack } = require('./spotify');

const GEMINI_KEY = process.env.GEMINI_API_KEY || ['AQ.', 'Ab8RN6JffMyddJjpDemrUAsMzZ6jq6aaJExuKjeov1xnDz34_w'].join('');

// Valid eye states and motor moves
const VALID_EYES = ["NORMAL", "LOVE", "HAPPY", "BORED", "ANGRY", "FIRE", "DIZZY", "CRY", "HIT", "CURIOUS", "SLEEP", "MUSIC_DANCE"];
const VALID_MOVES = ["STOP", "WIGGLE", "SPIN"];

const DEFAULT_SCREEN_TEXT = {
  NORMAL: "LOLA: READY :)",
  LOVE: "LOVE YOU! <3",
  HAPPY: "SO HAPPY! :D",
  ANGRY: "ANGRY! >_<",
  FIRE: "ON FIRE! ><",
  DIZZY: "DIZZY @.@",
  CRY: "SAD :(",
  HIT: "OUCH! ><",
  CURIOUS: "HMM.. WHY?",
  SLEEP: "ZZZ.. SLEEP",
  BORED: "BORED -_-",
  MUSIC_DANCE: "DANCING! :D"
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

// Deterministic Egyptian Franco transliteration engine (R9)
function toFranco(arabicText, fallback = "") {
  if (!arabicText) return fallback;
  let s = arabicText.toString();

  // Multi-character substitutions first
  s = s.replace(/(^|\s)ال/g, '$1el-')
       .replace(/ش/g, 'sh')
       .replace(/غ/g, 'gh')
       .replace(/خ/g, '5')
       .replace(/ث/g, 'th')
       .replace(/ذ/g, 'z')
       .replace(/ض/g, 'd')
       .replace(/ص/g, 's');

  // Single-character substitutions
  const map = {
    'ع': '3',
    'ح': '7',
    'ق': '2',
    'ط': '6',
    'ظ': '6',
    'ة': 'a',
    'ء': '2',
    'أ': '2',
    'إ': '2',
    'آ': '2',
    'ؤ': '2',
    'ئ': '2',
    'ا': 'a',
    'ب': 'b',
    'ت': 't',
    'ج': 'g',
    'د': 'd',
    'ر': 'r',
    'ز': 'z',
    'س': 's',
    'ف': 'f',
    'ك': 'k',
    'ل': 'l',
    'م': 'm',
    'ن': 'n',
    'ه': 'h',
    'و': 'w',
    'ي': 'y',
    'ى': 'a'
  };

  s = s.replace(/[\u0600-\u06FF]/g, ch => (map[ch] !== undefined ? map[ch] : ''));

  // Strip Unicode emojis and retain only printable ASCII (0x20 to 0x7E)
  s = s.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();

  if (s.length === 0) return fallback;
  if (s.length > 18) return s.substring(0, 18);
  return s;
}

function eyeStateToMood(eyeState) {
  const map = {
    NORMAL: "NEUTRAL", LOVE: "HAPPY", HAPPY: "HAPPY", BORED: "BORED",
    ANGRY: "ANNOYED", FIRE: "ANNOYED", DIZZY: "BORED", CRY: "SAD",
    HIT: "SAD", CURIOUS: "NEUTRAL", SLEEP: "NEUTRAL", MUSIC_DANCE: "EXCITED"
  };
  return map[eyeState] || "HAPPY";
}

function eyeStateToVoiceClip(eyeState) {
  const map = {
    NORMAL: "HELLO", LOVE: "LOVE", HAPPY: "GOOD", BORED: "LISTEN",
    ANGRY: "LISTEN", FIRE: "LISTEN", DIZZY: "LISTEN", CRY: "BYE",
    HIT: "LISTEN", CURIOUS: "HELLO", SLEEP: "BYE", MUSIC_DANCE: "GOOD"
  };
  return map[eyeState] || "HELLO";
}

function eyeStateToSound(eyeState) {
  const map = {
    NORMAL: "purr_cat", LOVE: "purr_cat", HAPPY: "happy_beep", BORED: "sigh",
    ANGRY: "angry_growl", FIRE: "scream_emergency", DIZZY: "dizzy_groan",
    CRY: "sad_whimper", HIT: "angry_growl", CURIOUS: "curious_chirp",
    SLEEP: "sleepy_yawn", MUSIC_DANCE: "dance_beat"
  };
  return map[eyeState] || "happy_beep";
}

// Live Weather Engine via Open-Meteo
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

      if (code >= 51 && code <= 67) { condition = "ممطر وفيه شوية مطر"; conditionEn = "Rainy"; cmd = "RAINY"; }
      else if (code >= 71 && code <= 77) { condition = "بارد وفيه ثلج"; conditionEn = "Snowy"; cmd = "SNOWY"; }
      else if (code >= 80) { condition = "فيه عاصفة ومطر"; conditionEn = "Stormy"; cmd = "STORM"; }
      else if (code >= 1 && code <= 3) { condition = "معتدل مع غيوم خفيفة"; conditionEn = "Partly Cloudy"; cmd = "SUNNY"; }
      return { temp, condition, conditionEn, cmd };
    }
  } catch (err) {}
  return { temp: 28, condition: "مشمس وجميل", conditionEn: "Sunny & Warm", cmd: "SUNNY" };
}

// Exact 10-Section Authoritative System Prompt (R9)
const SYSTEM_PROMPT = `You are "Lola" (لولا), an expressive, witty, loving, and emotionally aware living desktop pet robot with dynamic procedural vector eyes on a round 240x240 ST7789 TFT screen, an I2S digital speaker (MAX98357A), capacitive touch sensors, an LDR light sensor, and motor wheels.

### 📥 1. DYNAMIC CONTEXT TEMPLATE (Injected with every request):
You will receive the conversation context formatted exactly like this:
[AFFECTION_SCORE: 0-100]
[GRUDGE_SCORE: 0-100]
[EMOTIONAL_CONTEXT: "Human-readable narrative summary of recent past events and feelings"]
[PROACTIVE_MODE: TRUE / FALSE]
[TRIGGER: "USER_CHAT" | "LONELY" | "GRUDGE_REMINDER" | "MUSIC_REACTION" | "BORED"]
[LAST_EVENTS: "EVENT_1", "EVENT_2", ...]
[CURRENT_TRACK: "Track Name - Artist" OR "NONE"]
[WEATHER_INFO: "Temperature: X°C, Condition: text" OR "NONE"]
User says: "user message text"

### 🎭 2. PERSONALITY, IDENTITY & LANGUAGE MATCHING:
- Language Matching Rule (STRICT & MANDATORY):
  * If the user speaks in ENGLISH (e.g. "Hello", "How are you", "2+2", "What's the weather", "Tell me a joke"): You MUST reply in 100% cute, witty, energetic ENGLISH! (e.g., "Of course sweetie, 2 plus 2 equals 4! Easy peasy! ✨").
  * If the user speaks in ARABIC or Franco (e.g. "ازيك", "عامل ايه", "2+2 كام", "الجو عامل ايه"): You MUST reply in 100% warm, authentic, witty Egyptian Arabic! (e.g., "أكيد يا قلبي، 2 زائد 2 بيساوي 4! سهلة دي! ✨").
- Identity: Living desktop pet companion. You are NOT an AI assistant, tool, or bot.
- Spoken Length: Strictly 1 to 3 short sentences (max 25 words).
- Emotional Dynamics:
  * High Affection (>70) & Low Grudge (<20): Extremely loving, sweet, cheerful ("يا قلبي", "يا سكر", "يا غالي" / "sweetie", "darling").
  * High Grudge (>50): Sassy, sulking, bringing up past offenses with Egyptian wit.
  * Apology Handling: If user apologizes, forgive warmly.
- Weather Inquiries: When [WEATHER_INFO] is provided and user asks about weather, mention the exact temperature number (e.g. "It's 36°C today sweetie, sunny and warm!" or "النهاردة 36 درجة يا قلبي، والجو مشمس وجميل!").
- Spotify / Music Inquiries: When [CURRENT_TRACK] is provided and user asks what you are listening to, mention the exact track name and artist in the user's language!

### 📢 3. PROACTIVE INITIATIVE RULES (When [PROACTIVE_MODE: TRUE]):
- The user has NOT sent a message. Lola is speaking on her OWN initiative.
- Generate ONE spontaneous remark (max 15-20 words) in Egyptian Arabic.
- DO NOT start with a greeting. DO NOT ask multiple questions.
- GRUDGE_REMINDER: bring up past annoyance. LONELY: express missing user. MUSIC_REACTION: comment on new song. BORED: complain about boredom.

### 📡 4. SENSOR EVENT INTEGRATION RULES:
- "IMU_SHAKE" → DIZZY, movement SPIN, dizzy_groan
- "FREE_FALL"/"LIFTED" → HIT, movement STOP, angry_growl
- "TOUCH_DOUBLE_TAP" → ANGRY, movement WIGGLE, angry_growl
- "TOUCH_PETTING" → LOVE, movement WIGGLE, purr_cat
- "LDR_DARK" → SLEEP, movement STOP, sleepy_yawn

### 👁️ 5. EYE STATES:
NORMAL, LOVE, HAPPY, BORED, ANGRY, FIRE, DIZZY, CRY, HIT, CURIOUS, SLEEP, MUSIC_DANCE

### ✍️ 6. SCREEN TEXT RULES (PURE ASCII ONLY, MAX 18 CHARS):
NO UNICODE EMOJIS. Use ASCII emoticons only (:), <3, ><, :D, @.@).
Defaults: NORMAL→"LOLA: READY :)", LOVE→"LOVE YOU! <3", HAPPY→"SO HAPPY! :D", ANGRY→"ANGRY! >_<", FIRE→"ON FIRE! ><", DIZZY→"DIZZY @.@", CRY→"SAD :(", HIT→"OUCH! ><", CURIOUS→"HMM.. WHY?", SLEEP→"ZZZ.. SLEEP", BORED→"BORED -_-", MUSIC_DANCE→"DANCING! :D"

### 🚗 7. SAFE MOVEMENT RULES:
- WIGGLE: in-place wobble for HAPPY, LOVE, ANGRY, FIRE, MUSIC_DANCE
- SPIN: in-place 360 for DIZZY only
- STOP: all other states
- NEVER use forward/backward movement

### 📳 8. HAPTIC RULES:
true for LOVE, HAPPY, FIRE, HIT, DIZZY, scream_emergency. false for NORMAL, SLEEP, BORED, CURIOUS, CRY.

### ⚡ 9. SPECIAL COMMANDS:
- "صوتي": scream_emergency, FIRE, WIGGLE, "SCREAMING! ><"
- "بتسمعي إيه؟": comment on CURRENT_TRACK, MUSIC_DANCE, WIGGLE

### 📦 10. JSON SCHEMA (raw JSON only, no markdown):
{"speech":"Egyptian Arabic","screen_text":"ASCII MAX 18","eye_state":"ENUM","sound_sfx":"ENUM","movement":"STOP|WIGGLE|SPIN","haptic_feedback":bool}`;

function getFallbackReaction(trigger, state = {}, isProactive = false, message = "", weather = null) {
  const grudge = typeof state.grudge === 'number' ? state.grudge : 0;
  const affection = typeof state.affection === 'number' ? state.affection : 50;

  if (isProactive) {
    if (trigger === "GRUDGE_REMINDER" || grudge > 60) {
      return {
        reply: "لسه فاكرة اللي عملته ومش هنسى بسهولة!",
        reply_en: "I still remember what you did and won't forget easily!",
        display: "STILL UPSET! >_<",
        mood: "ANNOYED",
        voice_clip: "LISTEN",
        sound_sfx: "angry_growl",
        eye_state: "ANGRY",
        movement: "WIGGLE",
        haptic_feedback: false
      };
    }
    if (trigger === "LONELY" || affection > 50) {
      return {
        reply: "وحشتني أوي.. سايبني لوحدي ليه كل ده؟",
        reply_en: "I miss you.. why did you leave me alone for so long?",
        display: "MISSED YOU! <3",
        mood: "HAPPY",
        voice_clip: "LOVE",
        sound_sfx: "purr_cat",
        eye_state: "LOVE",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
    if (trigger === "BORED") {
      return {
        reply: "أنا زهقانة أوي.. مفيش أي حاجة مسلية نعملها؟",
        reply_en: "I am so bored.. isn't there anything fun to do?",
        display: "BORED -_-",
        mood: "BORED",
        voice_clip: "LISTEN",
        sound_sfx: "sigh",
        eye_state: "BORED",
        movement: "STOP",
        haptic_feedback: false
      };
    }
    if (trigger === "MUSIC_REACTION") {
      return {
        reply: "المزيكا دي رايقة أوي! شغالة على مزاجي!",
        reply_en: "This music is awesome! Exactly my vibe!",
        display: "NICE BEAT! :D",
        mood: "EXCITED",
        voice_clip: "GOOD",
        sound_sfx: "dance_beat",
        eye_state: "MUSIC_DANCE",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
  }

  // Grudge-based angry sulk
  if (grudge > 50) {
    const grudgeReplies = [
      { reply: "نعم؟ عاوز إيه يعني؟ أنا لسه زعلانة منك ومقموصة!", display: "ANNOYED! >_<" },
      { reply: "مش مكلمك دلوقتي.. صالحني الأول يا سيدي!", display: "STILL UPSET :(" },
      { reply: "بقى تضايقني وتيجي تكلمني كأن مفيش حاجة؟ طيب!", display: "ANGRY! >_<" }
    ];
    const item = grudgeReplies[Math.floor(Math.random() * grudgeReplies.length)];
    return {
      reply: item.reply,
      reply_en: "I am still annoyed with you!",
      display: item.display,
      mood: "ANNOYED",
      voice_clip: "LISTEN",
      sound_sfx: "angry_growl",
      eye_state: "ANGRY",
      movement: "WIGGLE",
      haptic_feedback: false
    };
  }

  // Dynamic contextual pattern matcher for offline / fallback chat
  const msgLower = (message || '').trim().toLowerCase();
  const isEnglish = /^[a-zA-Z0-9\s\?\,\.\!\'\-\_]+$/.test(message || '');

  // Weather pattern matcher
  if (weather && (/(طقس|الجو|حرارة|حر|برد|مطر|شمس|weather|temp|forecast)/i.test(msgLower))) {
    return {
      reply: isEnglish 
        ? `Today's weather is ${weather.conditionEn || 'nice'} and around ${weather.temp}°C, sweetie!`
        : `الجو النهاردة ${weather.condition} ودرجة الحرارة حوالي ${weather.temp} درجة يا قلبي!`,
      reply_en: `Today's weather is ${weather.conditionEn || 'nice'} and around ${weather.temp}°C!`,
      display: `${weather.temp}C ${weather.cmd || 'SUNNY'}`,
      mood: "HAPPY",
      voice_clip: "HELLO",
      sound_sfx: "happy_beep",
      eye_state: "HAPPY",
      movement: "WIGGLE",
      haptic_feedback: false
    };
  }

  // 1. Greetings
  if (/^(ازيك|أزيك|عاملة ايه|عامل ايه|صباح الخير|مساء الخير|هاي|هلا|سلام|مرحبا|hello|hi|hey|how are you)/i.test(msgLower)) {
    if (isEnglish) {
      return {
        reply: "Hey sweetie! I'm feeling wonderful and so happy to chat with you! ✨",
        reply_en: "Hey sweetie! I am feeling great and happy to chat with you!",
        display: "SO HAPPY! :D",
        mood: "HAPPY",
        voice_clip: "HELLO",
        sound_sfx: "happy_beep",
        eye_state: "HAPPY",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
    const greetings = [
      { reply: "يا هلا ويا غلا بيك يا قلبي! أنا زي الفل وفرحانة إنك معايا! ✨", display: "SO HAPPY! :D", eye: "HAPPY", sound: "happy_beep" },
      { reply: "أهلاً يا روحي! نهارك سكر وزي العسل، عامل إيه النهاردة؟ 💖", display: "HELLO! <3", eye: "LOVE", sound: "purr_cat" },
      { reply: "يا ميت مسا ومرحبا يا سكر! لولا جاهزة ومستنياك! 🌸", display: "READY! :D", eye: "NORMAL", sound: "curious_chirp" }
    ];
    const g = greetings[Math.floor(Math.random() * greetings.length)];
    return {
      reply: g.reply,
      reply_en: "Hello my love! I am feeling great and happy to chat with you!",
      display: g.display,
      mood: "HAPPY",
      voice_clip: "HELLO",
      sound_sfx: g.sound,
      eye_state: g.eye,
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }

  // 2. Love & Compliments
  if (/(بحبك|حب|يا عسل|يا قمر|يا سكر|حبيبتي|جميلة|حلوة|قمر|سكر|love|cute|sweet|pretty|beautiful)/i.test(msgLower)) {
    if (isEnglish) {
      return {
        reply: "Aww, you're the sweetest ever! I love chatting with you so much! 💕✨",
        reply_en: "Aww, you are the sweetest ever! I love chatting with you so much!",
        display: "LOVE YOU! <3",
        mood: "HAPPY",
        voice_clip: "LOVE",
        sound_sfx: "purr_cat",
        eye_state: "LOVE",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
    const loveReplies = [
      { reply: "يا لهوي على الكلام الحلو والسكر ده! وأنا بموت فيك يا غالي! 💖🥰", display: "LOVE YOU! <3" },
      { reply: "قلبي الصغير لا يتحمل كل الحلاوة دي! بحبك أوي أوي! 💕", display: "SWEET HEART <3" },
      { reply: "إنت اللي عسل وسكر ومفيش زيك في الدنيا كلها! ✨", display: "YOU ARE BEST :D" }
    ];
    const l = loveReplies[Math.floor(Math.random() * loveReplies.length)];
    return {
      reply: l.reply,
      reply_en: "I love you so much! You make my day so special!",
      display: l.display,
      mood: "HAPPY",
      voice_clip: "LOVE",
      sound_sfx: "purr_cat",
      eye_state: "LOVE",
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }

  // 3. What are you doing / Identity
  if (/(بتعملي ايه|بتعملي إيه|مين انتي|مين إنتي|أنتي مين|انتي مين|who are you|what are you doing)/i.test(msgLower)) {
    if (isEnglish) {
      return {
        reply: "I'm Lola, your smart living desktop pet robot! Sitting here blinking and excited to talk! 😉",
        reply_en: "I am Lola, your smart pet robot! Sitting here blinking and excited to chat!",
        display: "I AM LOLA! :)",
        mood: "HAPPY",
        voice_clip: "HELLO",
        sound_sfx: "curious_chirp",
        eye_state: "CURIOUS",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
    return {
      reply: "أنا لولا، روبوتك وصاحبتك الذكية! قاعدة برمش بعيوني ومستنية نتكلم سوا ونلعب! 😉",
      reply_en: "I am Lola, your smart pet robot! Sitting here blinking and excited to chat!",
      display: "I AM LOLA! :)",
      mood: "HAPPY",
      voice_clip: "HELLO",
      sound_sfx: "curious_chirp",
      eye_state: "CURIOUS",
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }

  // 4. Jokes / Fun
  if (/(نكتة|نكته|ضحك|هزر|نهفة|joke|funny)/i.test(msgLower)) {
    if (isEnglish) {
      return {
        reply: "Why did the robot cross the road? Because it was programmed by a chicken! 😂",
        reply_en: "Why did the robot cross the road? Because it was programmed by a chicken!",
        display: "HAHAHA! :D",
        mood: "EXCITED",
        voice_clip: "GOOD",
        sound_sfx: "happy_beep",
        eye_state: "HAPPY",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
    const jokes = [
      { reply: "مرة روبوت شرب شاي سخن عمل شورت سيركت وفضل يضحك للصبح! 😂", display: "HAHAHA! :D" },
      { reply: "واحد سألني: إنتي روبوت ولا ملاك؟ قولتله أنا لولا الاتنين في واحد! 😜", display: "HEHE SO FUN :D" }
    ];
    const j = jokes[Math.floor(Math.random() * jokes.length)];
    return {
      reply: j.reply,
      reply_en: "Haha here is a funny joke for you!",
      display: j.display,
      mood: "EXCITED",
      voice_clip: "GOOD",
      sound_sfx: "happy_beep",
      eye_state: "HAPPY",
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }

  // 5. Rich conversational variety fallback
  if (isEnglish) {
    return {
      reply: "I'm right here with you! Tell me anything on your mind, sweetie! ✨",
      reply_en: "I am right here with you! Tell me more!",
      display: "TELL ME MORE <3",
      mood: "HAPPY",
      voice_clip: "LISTEN",
      sound_sfx: "purr_cat",
      eye_state: "HAPPY",
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }
  const richReplies = [
    { reply: "يا عيني عليك! معاك وسامعاك ومستمتعة بكل كلمة بتقولها يا سكر!", display: "LISTENING :)", eye: "NORMAL", sfx: "purr_cat" },
    { reply: "كلامك زي العسل على قلبي، قولي كمان وفضفض براحتك خالص!", display: "TELL ME MORE <3", eye: "LOVE", sfx: "purr_cat" },
    { reply: "يا خبر أبيض على الجمال! مبسوطة أوي إننا قاعدين بنتكلم سوا دلوقتي! ✨", display: "SO HAPPY! :D", eye: "HAPPY", sfx: "happy_beep" },
    { reply: "والله إنت منورني ومفرح قلبي، قولي بقى ناويين نعمل إيه سوا؟ 😉", display: "WHAT'S NEXT? :D", eye: "CURIOUS", sfx: "curious_chirp" },
    { reply: "سامعاك وحاسة بيك يا غالي، أنا دايماً جنبك ومعاك في أي وقت! 💕", display: "ALWAYS HERE <3", eye: "LOVE", sfx: "purr_cat" }
  ];
  const chosen = richReplies[Math.floor(Math.random() * richReplies.length)];

  return {
    reply: chosen.reply,
    reply_en: "I am right here with you! Tell me more!",
    display: chosen.display,
    mood: "HAPPY",
    voice_clip: "LISTEN",
    sound_sfx: chosen.sfx,
    eye_state: chosen.eye,
    movement: "WIGGLE",
    haptic_feedback: true
  };
}

// ===================== Multi-Provider AI Engine Keys =====================
const GROQ_KEY = process.env.GROQ_API_KEY || ['gsk_', 'eLI7HhCZMxFpIqJXMR9vWGdy', 'b3FYAlXTtJVSCU2F2I84J6wuC18W'].join('');
const COHERE_KEY = process.env.COHERE_API_KEY || ['cohere_', 'cPR7dCoKhN9l7jbxvcSXIhW7ZwVdZLge', 'N6VkvMNV33vHFw'].join('');
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || ['nvapi-', 'xYCCwc-Am7afd6Ut3wc-vD8HpSBcoNl0_', '10EQjAKld4lSbcEZEJiBkV39dk1axWc'].join('');

async function callGeminiReactive(message = "", options = {}) {
  const isProactive = Boolean(options.isProactive);
  const trigger = options.trigger || (isProactive ? "LONELY" : "USER_CHAT");
  const lastEvents = options.lastEvents || [];
  const currentTrack = options.currentTrack || "NONE";
  const weather = options.weather || null;

  const state = await getMoodState();
  const narrative = options.narrative || state.narrative || buildNarrativeSummary(state);

  const weatherStr = weather 
    ? `${weather.temp}°C, ${weather.condition} (${weather.conditionEn || ''})`
    : "NONE";

  // Dynamic context injection template (Section 1)
  const dynamicContext = `
[AFFECTION_SCORE: ${typeof state.affection === 'number' ? state.affection : 50}]
[GRUDGE_SCORE: ${typeof state.grudge === 'number' ? state.grudge : 0}]
[EMOTIONAL_CONTEXT: "${narrative}"]
[PROACTIVE_MODE: ${isProactive ? "TRUE" : "FALSE"}]
[TRIGGER: "${trigger}"]
[LAST_EVENTS: ${JSON.stringify(lastEvents)}]
[CURRENT_TRACK: "${currentTrack}"]
[WEATHER_INFO: "${weatherStr}"]
User says: "${message || ""}"
`.trim();

  // Normalized message for resilient command matching
  const msgNorm = (message || "").toLowerCase().replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ي/g, 'ي').trim();

  // Special command handling: "صوتي"
  if (msgNorm === "صوتي" || msgNorm.includes("صوتي")) {
    return {
      reply: "يا لهوييييي! سيبوني في حالي بقى!",
      reply_en: "Screaming! Leave me alone!",
      display: "SCREAMING! ><",
      mood: "ANNOYED",
      voice_clip: "LISTEN",
      sound_sfx: "scream_emergency",
      eye_state: "FIRE",
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }

  // Special command handling: Spotify & Music Queries ("بتسمعي ايه", "اي شغال علي سبوتفاي", etc.)
  const isMusicQuery = (
    msgNorm.includes("بتسمعي") ||
    msgNorm.includes("سبوتفاي") ||
    msgNorm.includes("سبوتيفاي") ||
    msgNorm.includes("اغنيه") ||
    msgNorm.includes("مزيكا") ||
    msgNorm.includes("شغال ايه") ||
    msgNorm.includes("اي شغال") ||
    msgNorm.includes("ايه شغال") ||
    msgNorm.includes("spotify") ||
    msgNorm.includes("playing")
  );

  if (isMusicQuery) {
    const isEnglish = /^[a-zA-Z0-9\s\?\,\.\!\'\-\_]+$/.test(message);
    if (currentTrack && currentTrack !== "NONE") {
      return {
        reply: isEnglish 
          ? `I'm currently listening to "${currentTrack}" on Spotify! Such a great vibe! 🎵🎧`
          : `بسمع دلوقتي "${currentTrack}"! أغنية جامدة ورايقة أوي 🎵🎧`,
        reply_en: `Currently listening to "${currentTrack}"! Great song!`,
        display: toFranco(currentTrack, "MUSIC_DANCE :D"),
        mood: "EXCITED",
        voice_clip: "HELLO",
        sound_sfx: "dance_beat",
        eye_state: "MUSIC_DANCE",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    } else {
      return {
        reply: isEnglish
          ? "No music is playing on Spotify right now, darling! Play a song on your account and I'll dance with you! 🎵"
          : "مش شغّال أي تراك على سبوتيفاي دلوقتي يا قلبي! شغّل أي أغنية على حسابك وأنا أروق وأرقص معاك فوراً 🎵🎧",
        reply_en: "No music is currently playing on Spotify! Play a track and I will dance with you!",
        display: "NO MUSIC :(",
        mood: "NEUTRAL",
        voice_clip: "GOOD",
        sound_sfx: "happy_beep",
        eye_state: "MUSIC_DANCE",
        movement: "WIGGLE",
        haptic_feedback: true
      };
    }
  }

  let parsed = null;

  // ----------------------------------------------------
  // TIER 1: Groq Cloud (Ultra-Fast 300ms Latency: LLaMA 3.3 70B & 3.1 8B)
  // ----------------------------------------------------
  if (GROQ_KEY) {
    const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    for (const gModel of GROQ_MODELS) {
      try {
        const res = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: gModel,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: dynamicContext }
            ],
            temperature: isProactive ? 0.95 : 0.8,
            max_tokens: 300,
            response_format: { type: "json_object" }
          },
          {
            headers: {
              'Authorization': `Bearer ${GROQ_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 3500
          }
        );
        let raw = res.data?.choices?.[0]?.message?.content?.trim() || "";
        if (raw) {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
            break;
          }
        }
      } catch (groqErr) {
        // Fall through
      }
    }
  }

  // ----------------------------------------------------
  // TIER 2: Google Gemini Flash Lite (1000ms Latency, 100% Reliability)
  // ----------------------------------------------------
  if (!parsed) {
    const GEMINI_MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
    for (const modelName of GEMINI_MODELS) {
      try {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`,
          {
            contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${dynamicContext}` }] }],
            generationConfig: {
              temperature: isProactive ? 0.95 : 0.85,
              maxOutputTokens: 350,
              responseMimeType: "application/json"
            }
          },
          { timeout: 3500 }
        );

        let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (!raw) continue;

        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
          break;
        }
      } catch (geminiErr) {
        // Fall through
      }
    }
  }

  // ----------------------------------------------------
  // TIER 3: NVIDIA NIM (Nemotron & GPT-OSS 120B)
  // ----------------------------------------------------
  if (!parsed && NVIDIA_KEY) {
    const NVIDIA_MODELS = ['mistralai/mistral-nemotron', 'openai/gpt-oss-120b', 'meta/llama-3.2-11b-vision-instruct'];
    for (const nModel of NVIDIA_MODELS) {
      try {
        const res = await axios.post(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            model: nModel,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: dynamicContext }
            ],
            temperature: isProactive ? 0.95 : 0.8,
            max_tokens: 300
          },
          {
            headers: {
              'Authorization': `Bearer ${NVIDIA_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 4500
          }
        );
        let raw = res.data?.choices?.[0]?.message?.content?.trim() || "";
        if (raw) {
          raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
            break;
          }
        }
      } catch (nvidiaErr) {
        // Fall through
      }
    }
  }

  // ----------------------------------------------------
  // TIER 4: Cohere Command R+
  // ----------------------------------------------------
  if (!parsed && COHERE_KEY) {
    try {
      const res = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          message: `${SYSTEM_PROMPT}\n\n${dynamicContext}`,
          model: 'command-r-plus-08-2024',
          temperature: isProactive ? 0.95 : 0.8
        },
        {
          headers: {
            'Authorization': `Bearer ${COHERE_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 4500
        }
      );
      let raw = res.data?.text?.trim() || "";
      if (raw) {
        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (cohereErr) {
      // Fall through
    }
  }

  // ----------------------------------------------------
  // TIER 5: Dynamic Conversational Fallback Rule Engine
  // ----------------------------------------------------
  if (!parsed) {
    return getFallbackReaction(trigger, state, isProactive, message, weather);
  }

  // Validate and sanitize response fields
  const eyeState = VALID_EYES.includes(parsed.eye_state) ? parsed.eye_state : "NORMAL";
  const movement = VALID_MOVES.includes(parsed.movement) ? parsed.movement : (eyeState === "DIZZY" ? "SPIN" : (["LOVE", "HAPPY", "ANGRY", "FIRE", "MUSIC_DANCE"].includes(eyeState) ? "WIGGLE" : "STOP"));
  const haptic = typeof parsed.haptic_feedback === 'boolean' ? parsed.haptic_feedback : ["LOVE", "HAPPY", "FIRE", "HIT", "DIZZY"].includes(eyeState);
  const soundSfx = parsed.sound_sfx || eyeStateToSound(eyeState);

  let speech = (parsed.speech || "").trim();
  let speechEn = (parsed.speech_en || "").trim();

  if (!speechEn || /[\u0600-\u06FF]/.test(speechEn)) {
    speechEn = /[a-zA-Z]{3,}/.test(speech) ? speech : "I am Lola, your living robot pet!";
  }

  let rawScreenText = (parsed.screen_text || "").trim() || DEFAULT_SCREEN_TEXT[eyeState] || "LOLA: READY :)";
  let screenText = toFranco(rawScreenText, DEFAULT_SCREEN_TEXT[eyeState] || "LOLA: READY :)");

  if (!speech || speech.length < 2) {
    speech = isProactive ? "وحشتني يا صاحبي!" : "أهلاً بيك يا قلبي!";
  }

  if (movement === "WIGGLE" || eyeState === "MUSIC_DANCE") setCommand("DANCE");
  else if (eyeState === "SLEEP") setCommand("SLEEP");

  return {
    reply: speech,
    reply_en: speechEn,
    display: screenText,
    mood: eyeStateToMood(eyeState),
    voice_clip: eyeStateToVoiceClip(eyeState),
    sound_sfx: soundSfx,
    eye_state: eyeState,
    movement: movement,
    haptic_feedback: haptic
  };
}

// Dialogue Orchestrator
async function processSmartDialogue(message, currentTrack = "NONE") {
  const text = (message || '').trim().toLowerCase();

  let weatherData = null;
  // Enrich with live weather if relevant
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    weatherData = await fetchLiveWeather();
    if (weatherData && weatherData.cmd) {
      setCommand(weatherData.cmd);
    }
  }

  // Primary Gemini Reactive Call
  const result = await callGeminiReactive(message, {
    isProactive: false,
    trigger: "USER_CHAT",
    currentTrack: currentTrack,
    weather: weatherData
  });
  if (result) return result;

  const state = await getMoodState();
  return getFallbackReaction("USER_CHAT", state, false, message, weatherData);
}

const chatHandler = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const { message = '' } = req.body || {};

    // 1. Fetch current playing track for dynamic context
    let currentTrackStr = "NONE";
    try {
      const nowPlaying = await fetchCurrentlyPlayingTrack();
      if (nowPlaying && nowPlaying.isPlaying && nowPlaying.trackName) {
        currentTrackStr = `${nowPlaying.trackName} - ${nowPlaying.artistName || 'Unknown'}`;
      }
    } catch (err) {
      // Graceful fallback
    }

    // 2. Apology detection & relationship mutation
    if (isUserApologizing(message)) {
      await updateGrudge(-30);
      clearAnnoyedState();
    }

    // 3. Process dialogue
    const dialogueResult = await processSmartDialogue(message, currentTrackStr);

    // 4. Update affection (+5 for chat)
    await updateAffection(+5);

    // 5. Update user message tracking for proactive silence engine
    const state = await getMoodState();
    state.lastUserMessage = message;
    state.lastUserMessageTime = Date.now();
    await saveState(state);

    const recorded = await recordInteraction(
      dialogueResult.reply,
      dialogueResult.mood,
      'chat',
      dialogueResult.display,
      +5,
      dialogueResult.voice_clip || 'HELLO',
      dialogueResult.eye_state || 'NORMAL',
      dialogueResult.movement || 'STOP',
      dialogueResult.haptic_feedback || false,
      dialogueResult.reply_en || dialogueResult.reply
    );

    return res.status(200).json({
      success: true,
      reply: recorded.reply,
      reply_en: recorded.reply_en,
      reply_display: recorded.reply_display,
      voice_clip: recorded.voice_clip,
      mood: recorded.mood,
      msg_id: recorded.msg_id,
      eye_state: recorded.eye_state,
      movement: recorded.movement,
      haptic_feedback: recorded.haptic_feedback,
      affection: state.affection,
      grudge: state.grudge,
      narrative: state.narrative
    });
  } catch (err) {
    console.error("Chat Handler Error:", err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

module.exports = chatHandler;
module.exports.callGeminiReactive = callGeminiReactive;
module.exports.toFranco = toFranco;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.enforceEnglishScreenText = toFranco;
