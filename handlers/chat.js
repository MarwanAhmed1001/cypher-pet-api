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

const GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from("QVEuQWI4Uk42SmZmTXlkZEpqcERlbXJVQXNNelo2anE2YWFKRXh1S2plb3YxeG5EejM0X3c=", "base64").toString("utf-8");

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
  s = s.replace(/ال/g, 'el-')
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
User says: "user message text"

### 🎭 2. PERSONALITY, IDENTITY & DIALECT:
- Spoken Language: 100% natural, warm, lively Egyptian Arabic.
- Identity: Living desktop pet companion. You are NOT an AI assistant, tool, or bot.
- Spoken Length: Strictly 1 to 3 short sentences (max 25 words).
- Emotional Dynamics:
  * High Affection (>70) & Low Grudge (<20): Extremely loving, sweet, cheerful ("يا قلبي", "يا سكر", "يا غالي").
  * High Grudge (>50): Sassy, sulking, bringing up past offenses with Egyptian wit.
  * Apology Handling: If user apologizes, forgive warmly.

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

function getFallbackReaction(trigger, state = {}, isProactive = false) {
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

  // Reactive fallback
  if (grudge > 50) {
    return {
      reply: "نعم؟ عاوز إيه يعني؟ أنا لسه زعلانة منك!",
      reply_en: "Yes? What do you want? I am still annoyed with you!",
      display: "ANNOYED! >_<",
      mood: "ANNOYED",
      voice_clip: "LISTEN",
      sound_sfx: "angry_growl",
      eye_state: "ANGRY",
      movement: "WIGGLE",
      haptic_feedback: false
    };
  }

  return {
    reply: "أنا سامعاك يا قلبي! كمل وفضفض براحتك!",
    reply_en: "I hear you! Tell me more, I love chatting with you!",
    display: "LOVE YOU! <3",
    mood: "HAPPY",
    voice_clip: "LISTEN",
    sound_sfx: "purr_cat",
    eye_state: "LOVE",
    movement: "WIGGLE",
    haptic_feedback: true
  };
}

// Primary LLM: Gemini Flash Lite — returns structured JSON reaction with dynamic context (R9 & R10)
async function callGeminiReactive(message = "", options = {}) {
  const isProactive = Boolean(options.isProactive);
  const trigger = options.trigger || (isProactive ? "LONELY" : "USER_CHAT");
  const lastEvents = options.lastEvents || [];
  const currentTrack = options.currentTrack || "NONE";

  const state = await getMoodState();
  const narrative = options.narrative || state.narrative || buildNarrativeSummary(state);

  // Dynamic context injection template (Section 1)
  const dynamicContext = `
[AFFECTION_SCORE: ${typeof state.affection === 'number' ? state.affection : 50}]
[GRUDGE_SCORE: ${typeof state.grudge === 'number' ? state.grudge : 0}]
[EMOTIONAL_CONTEXT: "${narrative}"]
[PROACTIVE_MODE: ${isProactive ? "TRUE" : "FALSE"}]
[TRIGGER: "${trigger}"]
[LAST_EVENTS: ${JSON.stringify(lastEvents)}]
[CURRENT_TRACK: "${currentTrack}"]
User says: "${message || ""}"
`.trim();

  // Special command handling: "صوتي"
  if (message && message.trim() === "صوتي") {
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

  // Special command handling: "بتسمعي إيه؟"
  if (message && message.includes("بتسمعي إيه")) {
    const trackStr = currentTrack !== "NONE" ? currentTrack : "مفيش حاجة شغالة دلوقتي";
    return {
      reply: currentTrack !== "NONE" ? `بسمع دلوقتي ${currentTrack}! أغنية جامدة!` : "مش سامعة أي مزيكا شغالة دلوقتي يا غالي.",
      reply_en: currentTrack !== "NONE" ? `Currently listening to ${currentTrack}!` : "No music playing right now.",
      display: toFranco(currentTrack !== "NONE" ? currentTrack : "NO MUSIC :(", "MUSIC_DANCE :D"),
      mood: "EXCITED",
      voice_clip: "HELLO",
      sound_sfx: "dance_beat",
      eye_state: "MUSIC_DANCE",
      movement: "WIGGLE",
      haptic_feedback: true
    };
  }

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${dynamicContext}` }] }],
        generationConfig: {
          temperature: isProactive ? 0.95 : 0.85,
          maxOutputTokens: 350,
          responseMimeType: "application/json"
        }
      },
      { timeout: 10000 }
    );

    let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!raw) return getFallbackReaction(trigger, state, isProactive);

    // Safe regex JSON match (R9)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Gemini] No valid JSON block found in response:", raw);
      return getFallbackReaction(trigger, state, isProactive);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("[Gemini] JSON parse error:", parseErr.message, "Raw:", jsonMatch[0]);
      return getFallbackReaction(trigger, state, isProactive);
    }

    // Validate and sanitize
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
  } catch (e) {
    console.error("Gemini Reactive Error:", e.message);
    return getFallbackReaction(trigger, state, isProactive);
  }
}

// Dialogue Orchestrator
async function processSmartDialogue(message, currentTrack = "NONE") {
  const text = (message || '').trim().toLowerCase();

  // Enrich with live weather if relevant
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    const w = await fetchLiveWeather();
    setCommand(w.cmd);
  }

  // Primary Gemini Reactive Call
  const result = await callGeminiReactive(message, {
    isProactive: false,
    trigger: "USER_CHAT",
    currentTrack: currentTrack
  });
  if (result) return result;

  const state = await getMoodState();
  return getFallbackReaction("USER_CHAT", state, false);
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
