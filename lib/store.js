// In-memory mood accumulator & state store for Lola API
const VALID_MOODS = ["HAPPY", "NEUTRAL", "BORED", "SAD", "ANNOYED", "EXCITED"];

function cleanEnglishText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

let globalState = {
  last_reply: "أنا لولا. عايز إيه؟",
  last_reply_display: "Lola: Ready!",
  energy: 50, // Baseline energy (50-79 = NEUTRAL)
  mood: "NEUTRAL",
  daily_mood: "NEUTRAL",
  data_type: "chat",
  msg_id: `msg_init_${Date.now()}`,
  last_interaction_time: Date.now(),
  annoyed_until: 0,
  apologize_count: 0,
  spotify_refresh_token: "",
  history: []
};


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
  resetDailyHistoryIfNewDay();

  globalState.last_interaction_time = Date.now();

  if (energyDelta !== 0) {
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
  globalState.spotify_refresh_token = token;
}

function getSpotifyRefreshToken() {
  return globalState.spotify_refresh_token || process.env.SPOTIFY_REFRESH_TOKEN || '';
}

function setAnnoyedState() {
  globalState.energy = 5; // Drops to ANNOYED range (0-9)
  globalState.annoyed_until = Date.now() + (30 * 60 * 1000); // 30 minutes duration
  globalState.apologize_count = 0;
  globalState.mood = "ANNOYED";
}



function clearAnnoyedState() {
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.energy = 50; // Returns to NEUTRAL
  globalState.mood = "NEUTRAL";
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
    globalState.apologize_count++;
    if (globalState.apologize_count >= 2) {
      clearAnnoyedState();
      return { forgiven: true, count: globalState.apologize_count };
    }
    return { forgiven: false, count: globalState.apologize_count };
  }
  return { forgiven: false, count: globalState.apologize_count };
}

function getMoodState() {
  resetDailyHistoryIfNewDay();
  applyEnergyDecay();
  const activeAnnoyed = isAnnoyedActive();
  
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
    idle_hours: Math.floor((Date.now() - globalState.last_interaction_time) / (1000 * 60 * 60))
  };
}


function setCommand(cmd) {
  globalState.active_command = cmd;
  globalState.command_expiry = Date.now() + 15000; // Keep active for 15s for ESP32 hardware polling
  globalState.last_interaction_time = Date.now();
  if (cmd === "SLEEP") {
    globalState.mood = "SLEEP";
  } else if (cmd === "WAKE") {
    globalState.mood = "NEUTRAL";
  } else if (cmd === "SHAKE") {
    globalState.mood = "TOUCH";
  } else if (cmd === "ALARM") {
    setAnnoyedState();
  }

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
  VALID_MOODS
};


