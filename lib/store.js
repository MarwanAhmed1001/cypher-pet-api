// In-memory mood accumulator & state store for Lola API
const VALID_MOODS = ["HAPPY", "SAD", "ANNOYED", "NEUTRAL", "EXCITED", "BORED"];

function cleanEnglishText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

let globalState = {
  last_reply: "Hello! I am Lola.",
  last_reply_display: "Lola: Ready!",
  mood: "NEUTRAL",
  daily_mood: "NEUTRAL",
  data_type: "chat",
  msg_id: `msg_init_${Date.now()}`,
  annoyed_until: 0,
  apologize_count: 0,
  history: []
};

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
  const apolKeywords = ['sorry', 'apologize', 'my bad', 'آسف', 'أسف', 'اعتذر', 'أعتذر', 'سامحيني', 'سامحنى', 'حقك عليا', 'حقك علي'];
  return apolKeywords.some(kw => text.toLowerCase().includes(kw));
}

function recordInteraction(reply, mood, dataType, replyDisplay = '') {
  resetDailyHistoryIfNewDay();

  const validatedMood = VALID_MOODS.includes(mood) ? mood : "NEUTRAL";
  
  globalState.last_reply = reply;
  globalState.last_reply_display = cleanEnglishText(replyDisplay, "Lola: Ready!");
  globalState.mood = validatedMood;
  globalState.data_type = dataType;
  globalState.msg_id = `msg_${Date.now()}`;

  globalState.history.push({
    mood: validatedMood,
    timestamp: Date.now()
  });

  globalState.daily_mood = calculateDominantMood();

  return {
    reply: globalState.last_reply,
    reply_display: globalState.last_reply_display,
    mood: globalState.mood,
    daily_mood: globalState.daily_mood,
    data_type: globalState.data_type,
    msg_id: globalState.msg_id,
    annoyed_until: globalState.annoyed_until
  };
}

function setAnnoyedState() {
  globalState.annoyed_until = Date.now() + (60 * 60 * 1000);
  globalState.apologize_count = 0;
  globalState.mood = "ANNOYED";
}

function clearAnnoyedState() {
  globalState.annoyed_until = 0;
  globalState.apologize_count = 0;
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
    if (globalState.apologize_count >= 3) {
      clearAnnoyedState();
      return { forgiven: true, count: globalState.apologize_count };
    }
    return { forgiven: false, count: globalState.apologize_count };
  }
  return { forgiven: false, count: globalState.apologize_count };
}

function getMoodState() {
  resetDailyHistoryIfNewDay();
  const activeAnnoyed = isAnnoyedActive();
  return {
    mood: activeAnnoyed ? "ANNOYED" : globalState.mood,
    daily_mood: globalState.daily_mood,
    last_reply: globalState.last_reply,
    last_reply_display: cleanEnglishText(globalState.last_reply_display, "Lola: Ready!"),
    data_type: globalState.data_type,
    msg_id: globalState.msg_id
  };
}

module.exports = {
  recordInteraction,
  getMoodState,
  setAnnoyedState,
  clearAnnoyedState,
  isAnnoyedActive,
  registerApologyAttempt,
  VALID_MOODS
};
