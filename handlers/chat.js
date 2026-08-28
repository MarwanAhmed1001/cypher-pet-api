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

// Valid eye states from AIBI viewer
const VALID_EYES = ["NORMAL","LOVE","HAPPY","BORED","ANGRY","FIRE","DIZZY","CRY","HIT","CURIOUS","SLEEP","PANIC"];
const VALID_MOVES = ["STOP","CHARGE_FORWARD","RETREAT","SPIN_DANCE","WIGGLE"];

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

// Map eye_state to legacy mood for backward compatibility
function eyeStateToMood(eyeState) {
  const map = {
    NORMAL: "NEUTRAL", LOVE: "HAPPY", HAPPY: "HAPPY", BORED: "BORED",
    ANGRY: "ANNOYED", FIRE: "ANNOYED", DIZZY: "BORED", CRY: "SAD",
    HIT: "SAD", CURIOUS: "NEUTRAL", SLEEP: "NEUTRAL", PANIC: "ANNOYED"
  };
  return map[eyeState] || "HAPPY";
}

// Map eye_state to voice clip for TTS fallback
function eyeStateToVoiceClip(eyeState) {
  const map = {
    NORMAL: "HELLO", LOVE: "LOVE", HAPPY: "GOOD", BORED: "LISTEN",
    ANGRY: "LISTEN", FIRE: "LISTEN", DIZZY: "LISTEN", CRY: "BYE",
    HIT: "LISTEN", CURIOUS: "HELLO", SLEEP: "BYE", PANIC: "LISTEN"
  };
  return map[eyeState] || "HELLO";
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

// Primary LLM: Gemini Flash Lite — returns structured JSON reaction
async function callGeminiReactive(message, extraContext = "") {
  const SYSTEM = `You are "Lola", a physical desktop robot pet with animated eyes on a round screen, motors for movement, and a speaker.
You have these eye expressions: NORMAL (calm cyan eyes), LOVE (pink heart eyes), HAPPY (rose arc smiley eyes), BORED (yellow half-lidded), ANGRY (red tilted rectangles), FIRE (angry + flame particles), DIZZY (X eyes + tongue + stars), CRY (blue eyes + tears), HIT (pain + tears), CURIOUS (green asymmetric big/small), SLEEP (purple thin lines breathing), PANIC (shaking tiny red dots).
You have these movement actions: STOP (stay still), CHARGE_FORWARD (rush forward boldly), RETREAT (back away), SPIN_DANCE (spin around excitedly), WIGGLE (playful wiggle back and forth).

For EVERY user message, respond ONLY with a raw JSON object (NO markdown, NO code fences, NO extra text):
{"speech":"your spoken reply in the user's language","speech_en":"same reply but ALWAYS in English","screen_text":"short English status (max 18 chars) e.g. Lola: Story!","eye_state":"EMOTION","movement":"ACTION","haptic_feedback":true/false}

Rules for speech:
- If spoken to in Arabic, reply in warm lively Egyptian Arabic (عامية مصرية).
- If in English, reply in natural fluent English with personality.
- Be expressive, witty, loving. Never be generic or robotic.
- When asked for a story, tell a creative full story (4-6 sentences).
- When asked for a joke, tell a complete funny joke with punchline.
- Match the emotion and energy of the conversation.
- Keep responses SHORT (1-3 sentences max) for quick playback.

Rules for speech_en:
- MUST directly and accurately answer the user's question or prompt in clear, natural, spoken English.
- Keep it concise (1 to 2 short sentences, max 25 words) so playback is quick, smooth, and crystal clear.
- If speech is already English, speech_en must be the exact direct answer.
- Never use emojis, asterisks, or markdown symbols.

Rules for screen_text:
- A short English string (max 18 chars) to display on robot's LCD screen. Examples: "Lola: Chatting!", "Lola: Joke time!", "Lola: Love you!", "Lola: Fire! >_<", "Lola: Dancing!".

Rules for eye_state:
- LOVE: when the user says sweet/loving things, compliments, or "بحبك"
- HAPPY: when conversation is cheerful, jokes land well, good news
- ANGRY: when teased, insulted mildly, or challenged
- FIRE: when really provoked or user says "هولع فيك" type threats
- CRY: when sad topics, user leaving, heartbreak
- CURIOUS: when asked interesting questions, "ليه", "ازاي"
- DIZZY: when confused, asked strange questions
- PANIC: when scared, user says scary things
- SLEEP: when user says goodnight, bye, "نام"
- BORED: when conversation is dull or repetitive
- NORMAL: default calm conversation

Rules for movement:
- SPIN_DANCE: excitement, dancing, joy, celebrations
- CHARGE_FORWARD: boldness, threats, "هولع فيك", challenges
- RETREAT: shyness, fear, sadness
- WIGGLE: playful, flirty, cute moments
- STOP: calm, normal, sleeping

Rules for haptic_feedback:
- true: intense emotions (anger, panic, excitement, love declarations, surprise)
- false: calm, normal, sleeping, bored
${extraContext}`;

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ role: 'user', parts: [{ text: `${SYSTEM}\n\nUser says: "${message}"` }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 400,
          responseMimeType: "application/json"
        }
      },
      { timeout: 10000 }
    );

    let raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) return null;

    // Clean any markdown fences if Gemini wraps them
    raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(raw);
    
    // Validate and sanitize
    const eyeState = VALID_EYES.includes(parsed.eye_state) ? parsed.eye_state : "NORMAL";
    const movement = VALID_MOVES.includes(parsed.movement) ? parsed.movement : "STOP";
    let speech = (parsed.speech || "").trim();
    let speechEn = (parsed.speech_en || "").trim();
    
    // If speech_en is missing or has Arabic letters, provide clean English answer:
    if (!speechEn || /[\u0600-\u06FF]/.test(speechEn)) {
      speechEn = /[a-zA-Z]{3,}/.test(speech) ? speech : "I am Lola, your friendly robot!";
    }
    
    const screenText = (parsed.screen_text || "").trim() || ("Lola: " + eyeState);
    
    if (!speech || speech.length < 2) return null;

    // Trigger motor commands based on movement
    if (movement === "SPIN_DANCE") setCommand("DANCE");
    else if (eyeState === "SLEEP") setCommand("SLEEP");

    return {
      reply: speech,
      reply_en: speechEn,
      display: enforceEnglishScreenText(screenText, "Lola: " + eyeState),
      mood: eyeStateToMood(eyeState),
      voice_clip: eyeStateToVoiceClip(eyeState),
      eye_state: eyeState,
      movement: movement,
      haptic_feedback: haptic
    };
  } catch (e) {
    console.error("Gemini Reactive Error:", e.message);
  }
  return null;
}

// Dialogue Orchestrator
async function processSmartDialogue(message) {
  const text = (message || '').trim().toLowerCase();
  let weatherContext = "";

  // Enrich with live weather if relevant
  if (text.includes('طقس') || text.includes('الجو') || text.includes('حرارة') || text.includes('حر') || text.includes('برد') || text.includes('مطر') || text.includes('شمس') || text.includes('weather') || text.includes('temp') || text.includes('forecast')) {
    const w = await fetchLiveWeather();
    setCommand(w.cmd);
    weatherContext = `\nLive Weather in Cairo NOW: ${w.temp}°C, ${w.condition} (${w.conditionEn}). Include the real temperature in your speech.`;
  }

  // Try Gemini Reactive JSON (Primary)
  const result = await callGeminiReactive(message, weatherContext);
  if (result) return result;

  // Offline Fallback (only if Gemini is completely down)
  const isEnglish = /[a-zA-Z]{3,}/.test(text) && !/[\u0600-\u06FF]/.test(text);
  return {
    reply: isEnglish ? "I hear you! Tell me more, I love chatting!" : "أنا سامعاك يا قلبي! كمل وفضفض براحتك!",
    display: "I hear you! <3",
    mood: "HAPPY",
    voice_clip: "LISTEN",
    eye_state: "NORMAL",
    movement: "STOP",
    haptic_feedback: false
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
      dialogueResult.voice_clip || 'HELLO',
      dialogueResult.eye_state || 'NORMAL',
      dialogueResult.movement || 'STOP',
      dialogueResult.haptic_feedback || false,
      dialogueResult.reply_en || dialogueResult.reply
    );

    return res.status(200).json({
      success: true,
      reply: recorded.reply,
      reply_display: recorded.reply_display,
      voice_clip: recorded.voice_clip,
      mood: recorded.mood,
      msg_id: recorded.msg_id,
      eye_state: recorded.eye_state,
      movement: recorded.movement,
      haptic_feedback: recorded.haptic_feedback
    });
  } catch (err) {
    console.error("Chat Handler Error:", err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
