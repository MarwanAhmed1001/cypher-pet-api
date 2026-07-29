// In-memory mood accumulator & state store for Lola API
const VALID_MOODS = ["HAPPY", "SAD", "ANNOYED", "NEUTRAL", "EXCITED", "BORED"];

let globalState = {
  last_reply: "أهلاً بك! أنا لولا.",
  last_reply_display: "Lola: Ready!",
  mood: "NEUTRAL",
  daily_mood: "NEUTRAL",
  data_type: "chat",
  msg_id: 1,
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

function recordInteraction(reply, mood, dataType, replyDisplay = '') {
  resetDailyHistoryIfNewDay();

  const validatedMood = VALID_MOODS.includes(mood) ? mood : "NEUTRAL";
  
  globalState.last_reply = reply;
  globalState.last_reply_display = replyDisplay || reply;
  globalState.mood = validatedMood;
  globalState.data_type = dataType;
  globalState.msg_id = Date.now(); // Unique ID for each message!

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
    msg_id: globalState.msg_id
  };
}

function getMoodState() {
  resetDailyHistoryIfNewDay();
  return {
    mood: globalState.mood,
    daily_mood: globalState.daily_mood,
    last_reply: globalState.last_reply,
    last_reply_display: globalState.last_reply_display,
    data_type: globalState.data_type,
    msg_id: globalState.msg_id
  };
}

module.exports = {
  recordInteraction,
  getMoodState,
  VALID_MOODS
};
