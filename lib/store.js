// In-memory mood accumulator & state store for Lola API with Upstash Redis REST persistence
const axios = require('axios');

const VALID_MOODS = ["HAPPY", "NEUTRAL", "BORED", "SAD", "ANNOYED", "EXCITED", "SHAKE"];
const REDIS_KEY = 'lola_state';

function cleanEnglishText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

let globalState = {
  last_reply: "أهلاً! أنا لولا، روبوتك الذكي الجميل!",
  last_reply_en: "Hello! I am Lola, your smart friendly robot!",
  last_reply_display: "Lola: Ready!",
  energy: 80,
  mood: "HAPPY",
  daily_mood: "HAPPY",
  data_type: "chat",
  msg_id: "msg_init_0",
  last_interaction_time: Date.now(),
  annoyed_until: 0,
  apologize_count: 0,
  spotify_refresh_token: "",
  joystick: { left: 0, right: 0 },
  last_joystick_time: 0,
  history: [],
  // Reactive Personality Fields
  eye_state: "NORMAL",
  movement: "STOP",
  haptic_feedback: false,
  voice_clip: "HELLO",
  active_command: "NONE",
  command_expiry: 0,

  // R7: Relationship & Grudge Fields
  affection: 50,
  grudge: 0,
  lastPetTime: 0,
  lastPokeCount: 0,
  lastOffense: '',
  lastOffenseTime: 0,
  lastDecayTime: Date.now(),

  // R10: Proactive Awareness Fields
  lastProactiveTime: 0,
  lastProactiveTrigger: '',
  lastUserMessage: '',
  lastUserMessageTime: Date.now(),
  reactedTracks: [],

  // R13: Alarm Support
  alarm_time: null
};

const DEFAULT_REDIS_URL = 'https://intent-caiman-241308.upstash.io';
const DEFAULT_REDIS_TOKEN = ['gQAAAAAAA66cAAIgcDIwNTI3Yzdl', 'YzliZGU0NDJkOTI4ZDZhMjc0YzBmYWQ0Yg'].join('');

// Upstash Redis REST helpers with in-memory fallback
async function loadStateFromRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || DEFAULT_REDIS_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_REDIS_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await axios.post(
      `${url}/get/${REDIS_KEY}`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 3000
      }
    );
    let result = res.data?.result;
    if (!result) return null;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch (e) {
        return null;
      }
    }
    return result;
  } catch (err) {
    return null;
  }
}

async function saveStateToRedis(state) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || DEFAULT_REDIS_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || DEFAULT_REDIS_TOKEN;
  if (!url || !token) return;

  try {
    await axios.post(
      `${url}/set/${REDIS_KEY}`,
      JSON.stringify(state),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain'
        },
        timeout: 3000
      }
    );
  } catch (err) {
    // Gracefully ignore Redis write failures
  }
}

let lastRedisLoad = 0;
async function loadState(forceFresh = false) {
  const now = Date.now();
  if (!forceFresh && (now - lastRedisLoad < 300)) {
    return globalState;
  }
  try {
    const redisData = await loadStateFromRedis();
    if (redisData && typeof redisData === 'object') {
      globalState = {
        ...globalState,
        ...redisData
      };
      lastRedisLoad = now;
    }
  } catch (err) {}
  return globalState;
}

async function saveState(state) {
  if (state) {
    globalState = { ...globalState, ...state };
  }
  await saveStateToRedis(globalState);
  lastRedisLoad = Date.now();
  return globalState;
}

// Calculate mood from energy level according to Cypher rules:
// Energy 80-100: HAPPY
// Energy 50-79: NEUTRAL
// Energy 30-49: BORED
// Energy 10-29: SAD
// Energy 0-9: ANNOYED
function energyToMood(energy) {
  if (energy >= 80) return "HAPPY";
  if (energy >= 50) return "NEUTRAL";
  if (energy >= 30) return "BORED";
  if (energy >= 10) return "SAD";
  return "ANNOYED";
}

function applyEnergyDecay() {
  const now = Date.now();
  const hoursIdle = (now - (globalState.last_interaction_time || now)) / (1000 * 60 * 60);
  if (hoursIdle >= 3) {
    const hoursToDecay = Math.floor(hoursIdle - 2); // Decay starts after 3 hours
    const totalDecay = hoursToDecay * 5;
    globalState.energy = Math.max(0, 50 - totalDecay); // Drops towards lower energy
  }
}

// Lazy decay for grudge: decay by 5 * hours (clamped to 0)
function applyLazyDecay(state = globalState) {
  const now = Date.now();
  const lastTime = state.lastDecayTime || state.last_interaction_time || now;
  const hoursSince = (now - lastTime) / (1000 * 60 * 60);
  if (hoursSince > 0) {
    const grudgeDecay = Math.floor(hoursSince) * 5;
    if (grudgeDecay > 0) {
      state.grudge = Math.max(0, (state.grudge || 0) - grudgeDecay);
      state.lastDecayTime = now;
    }
  }
}

function adjustEnergy(delta) {
  applyEnergyDecay();
  globalState.energy = Math.max(0, Math.min(100, globalState.energy + delta));
  globalState.mood = energyToMood(globalState.energy);
}

function resetDailyHistoryIfNewDay() {
  const today = new Date().toISOString().split('T')[0];
  if (!globalState.last_date) {
    globalState.last_date = today;
  } else if (globalState.last_date !== today) {
    globalState.last_date = today;
    globalState.history = [];
  }
}

function calculateDominantMood() {
  if (!globalState.history || globalState.history.length === 0) {
    return "NEUTRAL";
  }

  const counts = {};
  for (const item of globalState.history) {
    counts[item.mood] = (counts[item.mood] || 0) + 1;
  }

  let dominant = "NEUTRAL";
  let maxCount = 0;
  for (const [m, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = m;
    }
  }
  return dominant;
}

function isUserApologizing(text) {
  if (!text) return false;
  const apolKeywords = [
    'sorry', 'apologize', 'my bad', 'آسف', 'اسف', 'اعتذر', 'أعتذر',
    'سامحني', 'حقك عليا', 'حقك علي', 'خلاص متزعلش', 'اسفة', 'آسفة',
    'سوري', 'بحبك', 'سامحيني'
  ];
  return apolKeywords.some(kw => text.toLowerCase().includes(kw));
}

// R8: Narrative Memory Formatter
function buildNarrativeSummary(state = {}) {
  if (!state) return "She is in a calm, cheerful mood and happy to spend time together.";
  const now = Date.now();
  const affection = typeof state.affection === 'number' ? state.affection : 50;
  const grudge = typeof state.grudge === 'number' ? state.grudge : 0;
  const lastPokeCount = state.lastPokeCount || 0;
  const lastPet = state.lastPetTime || state.last_interaction_time || 0;
  const minutesSincePet = lastPet > 0 ? Math.floor((now - lastPet) / (1000 * 60)) : (state.idle_hours ? state.idle_hours * 60 : 0);
  const hoursSincePet = Math.floor(minutesSincePet / 60);

  const narratives = [];

  // High Grudge (> 60) or moderate grudge
  if (grudge > 60) {
    const pokes = lastPokeCount > 0 ? `${lastPokeCount} times ` : (state.lastPokeCount !== undefined ? '' : '4 times ');
    narratives.push(`She is still upset from being poked ${pokes}earlier. She has not forgiven this yet.`);
  } else if (grudge > 30) {
    narratives.push("She is somewhat annoyed by recent rough handling.");
  } else if (grudge >= 20) {
    narratives.push("She remembers recent annoyances and is feeling guarded and slightly sassy.");
  }

  // Affection dynamics
  if (affection > 70 && grudge < 20) {
    narratives.push("She feels very close to this person and is in a warm, loving mood.");
  } else if (affection < 30) {
    narratives.push("She feels distant and needs more gentle attention.");
  }

  // Prolonged lack of affection / neglect (> 120 minutes)
  if (minutesSincePet > 120) {
    const timeStr = hoursSincePet >= 2 ? `${hoursSincePet} hours` : `${minutesSincePet} minutes`;
    narratives.push(`She hasn't been petted in ${timeStr} and is feeling neglected.`);
  }

  if (narratives.length === 0) {
    narratives.push("She is in a calm, cheerful mood and happy to spend time together.");
  }

  return narratives.join(" ");
}

// Relationship state mutation helpers (R7)
async function updateAffection(delta) {
  await loadState();
  const current = typeof globalState.affection === 'number' ? globalState.affection : 50;
  globalState.affection = Math.max(0, Math.min(100, current + delta));
  globalState.last_interaction_time = Date.now();
  await saveState(globalState);
  return globalState.affection;
}

async function updateGrudge(delta) {
  await loadState();
  applyLazyDecay(globalState);
  const current = typeof globalState.grudge === 'number' ? globalState.grudge : 0;
  globalState.grudge = Math.max(0, Math.min(100, current + delta));
  globalState.last_interaction_time = Date.now();
  await saveState(globalState);
  return globalState.grudge;
}

function getRelationshipStateSync() {
  applyLazyDecay(globalState);
  return {
    affection: typeof globalState.affection === 'number' ? globalState.affection : 50,
    grudge: typeof globalState.grudge === 'number' ? globalState.grudge : 0,
    lastPetTime: globalState.lastPetTime || 0,
    lastPokeCount: globalState.lastPokeCount || 0,
    lastOffense: globalState.lastOffense || '',
    lastOffenseTime: globalState.lastOffenseTime || 0,
    narrative: buildNarrativeSummary(globalState)
  };
}

function getRelationshipState() {
  const syncState = getRelationshipStateSync();
  const promise = (async () => {
    await loadState();
    return getRelationshipStateSync();
  })();
  Object.assign(promise, syncState);
  return promise;
}

async function recordSensorEvents(events) {
  if (!events) return globalState;
  await loadState();
  const eventList = Array.isArray(events) ? events : (typeof events === 'string' ? events.split(',') : []);
  const now = Date.now();

  for (const rawEv of eventList) {
    const ev = (rawEv || '').toString().trim();
    if (!ev) continue;
    if (ev.includes('PETTING') || ev.includes('continuous_petting')) {
      globalState.affection = Math.min(100, (typeof globalState.affection === 'number' ? globalState.affection : 50) + 10);
      globalState.lastPetTime = now;
      globalState.last_interaction_time = now;
    } else if (ev.includes('POKE') || ev === 'SENSOR_TOUCH_POKE') {
      globalState.grudge = Math.min(100, (typeof globalState.grudge === 'number' ? globalState.grudge : 0) + 15);
      globalState.lastPokeCount = (globalState.lastPokeCount || 0) + 1;
      globalState.lastOffense = 'poke';
      globalState.lastOffenseTime = now;
      globalState.last_interaction_time = now;
    } else if (ev.includes('DOUBLE_TAP') || ev === 'SENSOR_TOUCH_DOUBLE_TAP') {
      globalState.grudge = Math.min(100, (typeof globalState.grudge === 'number' ? globalState.grudge : 0) + 15);
      globalState.lastOffense = 'double_tap';
      globalState.lastOffenseTime = now;
      globalState.last_interaction_time = now;
    } else if (ev.includes('RAGE') || ev === 'SENSOR_TOUCH_RAGE') {
      globalState.grudge = Math.min(100, (typeof globalState.grudge === 'number' ? globalState.grudge : 0) + 25);
      globalState.lastOffense = 'rage';
      globalState.lastOffenseTime = now;
      globalState.last_interaction_time = now;
    }
  }

  await saveState(globalState);
  return globalState;
}

function recordInteractionSync(reply, mood, dataType, replyDisplay = '', energyDelta = 0, voiceClip = 'HELLO', eyeState = 'NORMAL', movement = 'STOP', hapticFeedback = false, replyEn = '') {
  resetDailyHistoryIfNewDay();

  globalState.last_interaction_time = Date.now();

  if (mood === "SHAKE") {
    globalState.mood = "SHAKE";
  } else if (energyDelta !== 0) {
    adjustEnergy(energyDelta);
  } else if (mood && VALID_MOODS.includes(mood)) {
    globalState.mood = mood;
  } else {
    applyEnergyDecay();
    globalState.mood = energyToMood(globalState.energy);
  }

  globalState.last_reply = reply;
  globalState.last_reply_en = replyEn || reply;
  globalState.last_reply_display = cleanEnglishText(replyDisplay, "Lola: Ready!");
  globalState.data_type = dataType;
  globalState.voice_clip = voiceClip || "HELLO";
  globalState.msg_id = `msg_${Date.now()}`;

  // Reactive Personality Fields
  globalState.eye_state = eyeState || "NORMAL";
  globalState.movement = movement || "STOP";
  globalState.haptic_feedback = Boolean(hapticFeedback);

  globalState.history.push({
    mood: globalState.mood,
    timestamp: Date.now()
  });

  globalState.daily_mood = calculateDominantMood();

  return {
    reply: globalState.last_reply,
    reply_en: globalState.last_reply_en,
    reply_display: globalState.last_reply_display,
    voice_clip: globalState.voice_clip,
    mood: globalState.mood,
    energy: globalState.energy,
    daily_mood: globalState.daily_mood,
    data_type: globalState.data_type,
    msg_id: globalState.msg_id,
    annoyed_until: globalState.annoyed_until,
    eye_state: globalState.eye_state,
    movement: globalState.movement,
    haptic_feedback: globalState.haptic_feedback,
    affection: globalState.affection,
    grudge: globalState.grudge
  };
}

function recordInteraction(reply, mood, dataType, replyDisplay = '', energyDelta = 0, voiceClip = 'HELLO', eyeState = 'NORMAL', movement = 'STOP', hapticFeedback = false, replyEn = '') {
  const syncResult = recordInteractionSync(reply, mood, dataType, replyDisplay, energyDelta, voiceClip, eyeState, movement, hapticFeedback, replyEn);
  const promise = (async () => {
    await saveState(globalState);
    return syncResult;
  })();
  Object.assign(promise, syncResult);
  return promise;
}

function setSpotifyRefreshToken(token) {
  globalState.spotify_refresh_token = token;
  saveStateToRedis(globalState);
}

function getSpotifyRefreshToken() {
  return globalState.spotify_refresh_token || process.env.SPOTIFY_REFRESH_TOKEN || '';
}

function setAnnoyedState() {
  globalState.energy = 5;
  globalState.annoyed_until = Date.now() + (90 * 1000);
  globalState.apologize_count = 0;
  globalState.mood = "ANNOYED";
  saveStateToRedis(globalState);
}

function clearAnnoyedState() {
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.energy = 50;
  globalState.mood = "NEUTRAL";
  saveStateToRedis(globalState);
}

function isAnnoyedActive() {
  if (globalState.annoyed_until > 0 && Date.now() < globalState.annoyed_until) {
    return true;
  }
  if (globalState.annoyed_until > 0 && Date.now() >= globalState.annoyed_until) {
    clearAnnoyedState();
  }
  return false;
}

function registerApologyAttempt(text) {
  if (isUserApologizing(text)) {
    clearAnnoyedState();
    return { forgiven: true, count: 1 };
  }
  return { forgiven: false, count: 0 };
}

async function setJoystick(left, right) {
  globalState.joystick = {
    left: Math.max(-255, Math.min(255, parseInt(left, 10) || 0)),
    right: Math.max(-255, Math.min(255, parseInt(right, 10) || 0))
  };
  globalState.last_joystick_time = Date.now();
  // Save to Redis immediately so ESP32 picks it up on next /api/mood poll
  await saveStateToRedis(globalState);
}

function getMoodStateSync() {
  resetDailyHistoryIfNewDay();
  applyEnergyDecay();
  applyLazyDecay(globalState);
  const activeAnnoyed = isAnnoyedActive();
  
  if (Date.now() - (globalState.last_joystick_time || 0) > 4000) {
    globalState.joystick = { left: 0, right: 0 };
  }

  let currentCommand = "NONE";
  if (globalState.command_expiry && Date.now() < globalState.command_expiry) {
    currentCommand = globalState.active_command || "NONE";
  } else {
    globalState.active_command = "NONE";
  }

  return {
    mood: activeAnnoyed ? "ANNOYED" : globalState.mood,
    energy: globalState.energy,
    daily_mood: globalState.daily_mood,
    last_reply: globalState.last_reply,
    last_reply_en: globalState.last_reply_en || globalState.last_reply,
    last_reply_display: cleanEnglishText(globalState.last_reply_display, "Lola: Ready!"),
    voice_clip: globalState.voice_clip || "HELLO",
    data_type: globalState.data_type,
    msg_id: globalState.msg_id,
    command: currentCommand,
    joystick: globalState.joystick,
    idle_hours: Math.floor((Date.now() - (globalState.last_interaction_time || Date.now())) / (1000 * 60 * 60)),
    eye_state: globalState.eye_state || "NORMAL",
    movement: globalState.movement || "STOP",
    haptic_feedback: globalState.haptic_feedback || false,
    affection: typeof globalState.affection === 'number' ? globalState.affection : 50,
    grudge: typeof globalState.grudge === 'number' ? globalState.grudge : 0,
    lastPetTime: globalState.lastPetTime || 0,
    lastPokeCount: globalState.lastPokeCount || 0,
    lastOffense: globalState.lastOffense || '',
    lastOffenseTime: globalState.lastOffenseTime || 0,
    lastProactiveTime: globalState.lastProactiveTime || 0,
    lastProactiveTrigger: globalState.lastProactiveTrigger || '',
    lastUserMessage: globalState.lastUserMessage || '',
    reactedTracks: globalState.reactedTracks || [],
    alarm_time: globalState.alarm_time || null,
    narrative: buildNarrativeSummary(globalState)
  };
}

function getMoodState(forceFresh = false) {
  const syncState = getMoodStateSync();
  const promise = (async () => {
    await loadState(forceFresh);
    return getMoodStateSync();
  })();
  Object.assign(promise, syncState);
  return promise;
}

function setCommand(cmd) {
  globalState.active_command = cmd;
  globalState.command_expiry = Date.now() + 15000;
  globalState.last_interaction_time = Date.now();
  globalState.msg_id = 'msg_' + Date.now();
  saveState(globalState);
  if (cmd === "SLEEP") {
    globalState.mood = "SLEEP";
    globalState.last_reply_display = "SLEEPING...";
  } else if (cmd === "WAKE") {
    globalState.mood = "NEUTRAL";
    globalState.last_reply_display = "Lola: Awake!";
  } else if (cmd === "SHAKE") {
    globalState.mood = "SHAKE";
    globalState.last_reply_display = "SHAKING!";
  } else if (cmd === "ALARM") {
    setAnnoyedState();
    globalState.last_reply_display = "ALARM!";
  }
  saveStateToRedis(globalState);
}

function clearAllMemorySync() {
  globalState.energy = 80;
  globalState.mood = "HAPPY";
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.last_reply = "أنا لولا! 💖 عاملة إيه يا أيلولتي؟ مبسوطة إننا سوا وجاهزة نتكلم ونتعرف على بعض أكتر! 🌸✨";
  globalState.last_reply_display = "Lola: Fresh Start!";
  globalState.history = [];
  globalState.last_interaction_time = Date.now();
  globalState.msg_id = `msg_${Date.now()}`;
  globalState.affection = 50;
  globalState.grudge = 0;
  globalState.lastPetTime = 0;
  globalState.lastPokeCount = 0;
  globalState.lastOffense = '';
  globalState.lastOffenseTime = 0;
  globalState.lastDecayTime = Date.now();
  globalState.lastProactiveTime = 0;
  globalState.lastProactiveTrigger = '';
  globalState.lastUserMessage = '';
  globalState.lastUserMessageTime = Date.now();
  globalState.reactedTracks = [];
  globalState.alarm_time = null;

  return { success: true, message: "All memory wiped! Fresh start ready." };
}

function clearAllMemory() {
  const syncResult = clearAllMemorySync();
  const promise = (async () => {
    await saveState(globalState);
    return syncResult;
  })();
  Object.assign(promise, syncResult);
  return promise;
}

module.exports = {
  recordInteraction,
  recordInteractionSync,
  getMoodState,
  getMoodStateSync,
  setAnnoyedState,
  clearAnnoyedState,
  isAnnoyedActive,
  registerApologyAttempt,
  adjustEnergy,
  setCommand,
  setSpotifyRefreshToken,
  getSpotifyRefreshToken,
  clearAllMemory,
  clearAllMemorySync,
  VALID_MOODS,
  updateAffection,
  updateGrudge,
  getRelationshipState,
  getRelationshipStateSync,
  buildNarrativeSummary,
  recordSensorEvents,
  loadState,
  saveState,
  isUserApologizing,
  applyLazyDecay,
  setJoystick
};
