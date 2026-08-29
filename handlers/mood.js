const { 
  getMoodState, 
  recordSensorEvents, 
  saveState, 
  buildNarrativeSummary 
} = require('../lib/store');
const { callGeminiReactive, toFranco } = require('./chat');
const { fetchCurrentlyPlayingTrack } = require('./spotify');

// Set CORS headers helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

// Proactive Awareness Initiative Evaluation (R10)
async function evaluateProactiveTriggers(state, currentTrackInfo) {
  const now = Date.now();
  const MIN_USER_SILENCE_MS = 5 * 60 * 1000; // 5 minutes minimum silence
  const lastUserMsgTime = state.lastUserMessageTime || state.last_interaction_time || 0;
  const silenceMs = now - lastUserMsgTime;

  // Pre-condition: user must be silent for > 5 minutes
  if (silenceMs < MIN_USER_SILENCE_MS) {
    return null;
  }

  const lastProactive = state.lastProactiveTime || 0;
  const timeSinceLastProactive = now - lastProactive;

  // Priority 1: GRUDGE_REMINDER (grudge > 60, cooldown 25 min)
  if (state.grudge > 60 && timeSinceLastProactive >= 25 * 60 * 1000) {
    return { trigger: "GRUDGE_REMINDER", cooldown: 25 * 60 * 1000 };
  }

  // Priority 2: MUSIC_REACTION (new track ID/name not in reactedTracks[])
  if (currentTrackInfo && currentTrackInfo.isPlaying && currentTrackInfo.trackName) {
    const trackKey = currentTrackInfo.trackId || `${currentTrackInfo.trackName} - ${currentTrackInfo.artistName || 'Unknown'}`;
    const reacted = state.reactedTracks || [];
    if (!reacted.includes(trackKey)) {
      return { trigger: "MUSIC_REACTION", trackKey };
    }
  }

  // Priority 3: LONELY (silence > 20 min, affection > 50, cooldown 45 min)
  if (silenceMs >= 20 * 60 * 1000 && state.affection > 50 && timeSinceLastProactive >= 45 * 60 * 1000) {
    return { trigger: "LONELY", cooldown: 45 * 60 * 1000 };
  }

  // Priority 4: BORED (silence > 40 min, affection < 40, cooldown 60 min)
  if (silenceMs >= 40 * 60 * 1000 && state.affection < 40 && timeSinceLastProactive >= 60 * 60 * 1000) {
    return { trigger: "BORED", cooldown: 60 * 60 * 1000 };
  }

  return null;
}

const moodHandler = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
  }

  try {
    const body = req.body || {};
    const query = req.query || {};

    // 1. Ingest incoming sensor events from ESP32
    const rawEvents = body.events || query.events || body.event || query.event || body.sensor_context || query.sensor_context;
    if (rawEvents) {
      await recordSensorEvents(rawEvents);
    }

    // 2. Fetch current mood and relationship state (lazy decay applied automatically)
    let currentState = await getMoodState();

    // 3. Check Spotify currently playing track
    let currentTrackInfo = null;
    try {
      currentTrackInfo = await fetchCurrentlyPlayingTrack();
    } catch (err) {
      // Graceful fallback
    }

    // 4. Proactive Awareness Engine evaluation
    let proactivePayload = null;
    const proactiveTrigger = await evaluateProactiveTriggers(currentState, currentTrackInfo);

    if (proactiveTrigger) {
      const trackNameStr = currentTrackInfo && currentTrackInfo.trackName 
        ? `${currentTrackInfo.trackName} - ${currentTrackInfo.artistName || ''}` 
        : "NONE";

      const geminiReaction = await callGeminiReactive("", {
        isProactive: true,
        trigger: proactiveTrigger.trigger,
        currentTrack: trackNameStr
      });

      if (geminiReaction) {
        proactivePayload = {
          triggered: true,
          trigger: proactiveTrigger.trigger,
          speech: geminiReaction.reply,
          speech_en: geminiReaction.reply_en,
          screen_text: geminiReaction.display,
          eye_state: geminiReaction.eye_state,
          sound_sfx: geminiReaction.sound_sfx || "purr_cat",
          movement: geminiReaction.movement || "STOP",
          haptic_feedback: geminiReaction.haptic_feedback || false
        };

        // Update proactive state in persistent store
        currentState.lastProactiveTime = Date.now();
        currentState.lastProactiveTrigger = proactiveTrigger.trigger;
        if (proactiveTrigger.trigger === "MUSIC_REACTION" && proactiveTrigger.trackKey) {
          if (!currentState.reactedTracks) currentState.reactedTracks = [];
          if (!currentState.reactedTracks.includes(proactiveTrigger.trackKey)) {
            currentState.reactedTracks.push(proactiveTrigger.trackKey);
          }
        }
        await saveState(currentState);
      }
    }

    // 5. Construct enriched response payload
    const responsePayload = {
      status: "ok",
      mood: currentState.mood,
      energy: currentState.energy,
      daily_mood: currentState.daily_mood,
      last_reply: proactivePayload ? proactivePayload.speech : currentState.last_reply,
      last_reply_en: proactivePayload ? proactivePayload.speech_en : currentState.last_reply_en,
      last_reply_display: proactivePayload ? proactivePayload.screen_text : currentState.last_reply_display,
      voice_clip: currentState.voice_clip,
      data_type: currentState.data_type,
      msg_id: currentState.msg_id,
      command: currentState.command,
      joystick: currentState.joystick,
      idle_hours: currentState.idle_hours,
      eye_state: proactivePayload ? proactivePayload.eye_state : currentState.eye_state,
      movement: proactivePayload ? proactivePayload.movement : currentState.movement,
      haptic_feedback: proactivePayload ? proactivePayload.haptic_feedback : currentState.haptic_feedback,
      affection: currentState.affection,
      grudge: currentState.grudge,
      lastPetTime: currentState.lastPetTime,
      lastPokeCount: currentState.lastPokeCount,
      lastOffense: currentState.lastOffense,
      lastOffenseTime: currentState.lastOffenseTime,
      alarm_time: currentState.alarm_time,
      proactive: proactivePayload,
      narrative: currentState.narrative || buildNarrativeSummary(currentState)
    };

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('Mood Handler Error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
};

module.exports = moodHandler;
module.exports.evaluateProactiveTriggers = evaluateProactiveTriggers;
