// In-memory mood accumulator & state store for Lola API
// All API routes go through single Express function = shared in-memory state
const VALID_MOODS = ["HAPPY", "NEUTRAL", "BORED", "SAD", "ANNOYED", "EXCITED", "SHAKE"];

function cleanEnglishText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

let globalState = {
  last_reply: "Ø£Ù†Ø§ Ù„ÙˆÙ„Ø§! ðŸ’– Ø¹Ø§Ù…Ù„Ø© Ø¥ÙŠÙ‡ ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠØŸ Ù…Ø¨Ø³ÙˆØ·Ø© Ø¬Ø¯Ø§Ù‹ Ø¥Ù†Ù†Ø§ Ø³ÙˆØ§ØŒ ØªØ¹Ø§Ù„ÙŠ Ù†ØªÙƒÙ„Ù… ÙˆÙ†ØªØ¹Ø±Ù Ø¹Ù„Ù‰ Ø¨Ø¹Ø¶ Ø£ÙƒØªØ±! ðŸŒ¸âœ¨",
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
  const apolKeywords = ['sorry', 'apologize', 'my bad', 'Ø¢Ø³Ù', 'Ø£Ø³Ù', 'Ø§Ø¹ØªØ°Ø±', 'Ø£Ø¹ØªØ°Ø±', 'Ø³Ø§Ù…Ø­Ù†ÙŠ', 'Ø­Ù‚Ùƒ Ø¹Ù„ÙŠØ§', 'Ø­Ù‚Ùƒ Ø¹Ù„ÙŠ', 'Ø®Ù„Ø§Øµ Ù…ØªØ²Ø¹Ù„Ø´'];
  return apolKeywords.some(kw => text.toLowerCase().includes(kw));
}

function recordInteraction(reply, mood, dataType, replyDisplay = '', energyDelta = 0) {

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

  globalState.energy = 5;
  globalState.annoyed_until = Date.now() + (90 * 1000);
  globalState.apologize_count = 0;
  globalState.mood = "ANNOYED";

}

function clearAnnoyedState() {

  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.energy = 50;
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

  const lower = (text || '').toLowerCase();
  if (lower.includes('Ø§Ø³ÙØ©') || lower.includes('Ø¢Ø³ÙØ©') || lower.includes('Ø³ÙˆØ±ÙŠ') || lower.includes('Ø¨Ø­Ø¨Ùƒ') || lower.includes('Ø³Ø§Ù…Ø­ÙŠÙ†ÙŠ')) {
    clearAnnoyedState();
    return { forgiven: true, count: 1 };
  }
  return { forgiven: false, count: 0 };
}

function setJoystick(left, right) {

  globalState.joystick = {
    left: Math.max(-255, Math.min(255, parseInt(left) || 0)),
    right: Math.max(-255, Math.min(255, parseInt(right) || 0))
  };
  globalState.last_joystick_time = Date.now();

}

function getMoodState() {

  resetDailyHistoryIfNewDay();
  applyEnergyDecay();
  const activeAnnoyed = isAnnoyedActive();
  
  if (Date.now() - globalState.last_joystick_time > 4000) {
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

}


function clearAllMemory() {

  globalState.energy = 80;
  globalState.mood = "HAPPY";
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
  globalState.last_reply = "Ø£Ù†Ø§ Ù„ÙˆÙ„Ø§! ðŸ’– Ø¹Ø§Ù…Ù„Ø© Ø¥ÙŠÙ‡ ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠØŸ Ù…Ø¨Ø³ÙˆØ·Ø© Ø¥Ù†Ù†Ø§ Ø³ÙˆØ§ ÙˆØ¬Ø§Ù‡Ø²Ø© Ù†ØªÙƒÙ„Ù… ÙˆÙ†ØªØ¹Ø±Ù Ø¹Ù„Ù‰ Ø¨Ø¹Ø¶ Ø£ÙƒØªØ±! ðŸŒ¸âœ¨";
  globalState.last_reply_display = "Lola: Fresh Start!";
  globalState.history = [];
  globalState.last_interaction_time = Date.now();
  globalState.msg_id = `msg_${Date.now()}`;

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


