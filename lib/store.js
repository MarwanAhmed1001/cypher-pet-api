// In-memory mood accumulator & state store for Lola API
// Uses /tmp file-backed persistence so all Vercel serverless instances share state
const fs = require('fs');
const path = require('path');
const VALID_MOODS = ["HAPPY", "NEUTRAL", "BORED", "SAD", "ANNOYED", "EXCITED", "SHAKE"];

const STATE_FILE = '/tmp/lola_state.json';

function cleanEnglishText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

const DEFAULT_STATE = {
  last_reply: "أنا لولا! 💖 عاملة إيه يا أيلولتي؟ مبسوطة جداً إننا سوا، تعالي نتكلم ونتعرف على بعض أكتر! 🌸✨",
  last_reply_display: "Lola: Ready!",
  energy: 50,
  mood: "HAPPY",
  daily_mood: "HAPPY",
  data_type: "chat",
  msg_id: `msg_init_${Date.now()}`,
  last_interaction_time: Date.now(),
  annoyed_until: 0,
  apologize_count: 0,
  spotify_refresh_token: "",
  joystick: { left: 0, right: 0 },
  last_joystick_time: 0,
  history: []
};

// Load state from /tmp file (shared across serverless instances)
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      // Merge with defaults for any missing keys
      return { ...DEFAULT_STATE, ...parsed };
    }
  } catch (e) {
    console.error('[Store] Failed to load state:', e.message);
  }
  return { ...DEFAULT_STATE };
}

// Save state to /tmp file
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
  } catch (e) {
    console.error('[Store] Failed to save state:', e.message);
  }
}

// globalState is loaded fresh from disk on every require, and saved after every mutation
let globalState = loadState();


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
  const hoursIdle = (now - globalState.last_interaction_time) / (1000 * 60 * 60);
  if (hoursIdle >= 3) {
    const hoursToDecay = Math.floor(hoursIdle - 2); // Decay starts after 3 hours
    const totalDecay = hoursToDecay * 5;
    globalState.energy = Math.max(0, 50 - totalDecay); // Drops towards lower energy
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
  const apolKeywords = ['sorry', 'apologize', 'my bad', 'آسف', 'أسف', 'اعتذر', 'أعتذر', 'سامحني', 'حقك عليا', 'حقك علي', 'خلاص متزعلش'];
  return apolKeywords.some(kw => text.toLowerCase().includes(kw));
}

function recordInteraction(reply, mood, dataType, replyDisplay = '', energyDelta = 0) {
  globalState = loadState();
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
  globalState.last_reply_display = cleanEnglishText(replyDisplay, "Lola: Ready!");
  globalState.data_type = dataType;
  globalState.msg_id = `msg_${Date.now()}`;

  globalState.history.push({
    mood: globalState.mood,
    timestamp: Date.now()
  });

  globalState.daily_mood = calculateDominantMood();
  saveState(globalState);

  return {
    reply: globalState.last_reply,
    reply_display: globalState.last_reply_display,
    mood: globalState.mood,
    energy: globalState.energy,
    daily_mood: globalState.daily_mood,
    data_type: globalState.data_type,
    msg_id: globalState.msg_id,
    annoyed_until: globalState.annoyed_until
  };
}

function setSpotifyRefreshToken(token) {
  globalState = loadState();
  globalState.spotify_refresh_token = token;
  saveState(globalState);
}

function getSpotifyRefreshToken() {
  return globalState.spotify_refresh_token || process.env.SPOTIFY_REFRESH_TOKEN || '';
}

function setAnnoyedState() {
  globalState = loadState();
  globalState.energy = 5;
  globalState.annoyed_until = Date.now() + (90 * 1000);
  globalState.apologize_count = 0;
  globalState.mood = "ANNOYED";
  saveState(globalState);
}

function clearAnnoyedState() {
  globalState = loadState();
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.energy = 50;
  globalState.mood = "NEUTRAL";
  saveState(globalState);
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
  globalState = loadState();
  const lower = (text || '').toLowerCase();
  if (lower.includes('اسفة') || lower.includes('آسفة') || lower.includes('سوري') || lower.includes('بحبك') || lower.includes('سامحيني')) {
    clearAnnoyedState();
    return { forgiven: true, count: 1 };
  }
  return { forgiven: false, count: 0 };
}

function setJoystick(left, right) {
  globalState = loadState();
  globalState.joystick = {
    left: Math.max(-255, Math.min(255, parseInt(left) || 0)),
    right: Math.max(-255, Math.min(255, parseInt(right) || 0))
  };
  globalState.last_joystick_time = Date.now();
  saveState(globalState);
}

function getMoodState() {
  globalState = loadState();
  resetDailyHistoryIfNewDay();
  applyEnergyDecay();
  const activeAnnoyed = isAnnoyedActive();
  
  if (Date.now() - globalState.last_joystick_time > 2000) {
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
    last_reply_display: cleanEnglishText(globalState.last_reply_display, "Lola: Ready!"),
    data_type: globalState.data_type,
    msg_id: globalState.msg_id,
    command: currentCommand,
    joystick: globalState.joystick,
    idle_hours: Math.floor((Date.now() - globalState.last_interaction_time) / (1000 * 60 * 60))
  };
}


function setCommand(cmd) {
  globalState = loadState();
  globalState.active_command = cmd;
  globalState.command_expiry = Date.now() + 15000;
  globalState.last_interaction_time = Date.now();
  globalState.msg_id = 'msg_' + Date.now();
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
  saveState(globalState);
}


function clearAllMemory() {
  globalState = { ...DEFAULT_STATE };
  globalState.energy = 80;
  globalState.mood = "HAPPY";
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.last_reply = "أنا لولا! 💖 عاملة إيه يا أيلولتي؟ مبسوطة إننا سوا وجاهزة نتكلم ونتعرف على بعض أكتر! 🌸✨";
  globalState.last_reply_display = "Lola: Fresh Start!";
  globalState.history = [];
  globalState.last_interaction_time = Date.now();
  globalState.msg_id = `msg_${Date.now()}`;
  saveState(globalState);
  return { success: true, message: "All memory wiped! Fresh start ready." };
}

module.exports = {
  recordInteraction,
  getMoodState,
  setAnnoyedState,
  clearAnnoyedState,
  isAnnoyedActive,
  registerApologyAttempt,
  adjustEnergy,
  setCommand,
  setSpotifyRefreshToken,
  getSpotifyRefreshToken,
  clearAllMemory,
  VALID_MOODS
};


