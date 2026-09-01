const { 
  getMoodState, 
  recordSensorEvents, 
  saveState, 
  buildNarrativeSummary 
} = require('../lib/store');
const { callGeminiReactive, toFranco } = require('./chat');
const { fetchCurrentlyPlayingTrack, getCurrentLyricsLine } = require('./spotify');

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

  // Check in priority order:
  // 1. GRUDGE_REMINDER: grudge > 60, cooldown 25m
  const GRUDGE_COOLDOWN_MS = 25 * 60 * 1000;
  const timeSinceProactive = now - (state.lastProactiveTime || 0);

  if (state.grudge > 60 && timeSinceProactive >= GRUDGE_COOLDOWN_MS) {
    return { trigger: "GRUDGE_REMINDER" };
  }

  // 2. MUSIC_REACTION: new track ID not in reactedTracks[]
  if (currentTrackInfo && currentTrackInfo.isPlaying && currentTrackInfo.trackId) {
    const reacted = state.reactedTracks || [];
    const trackKey = `${currentTrackInfo.trackId}_${currentTrackInfo.trackName}`;
    if (!reacted.includes(trackKey)) {
      return { 
        trigger: "MUSIC_REACTION", 
        trackKey: trackKey 
      };
    }
  }

  // 3. LONELY: silence > 20m, affection > 50, cooldown 45m
  const LONELY_SILENCE_MS = 20 * 60 * 1000;
  const LONELY_COOLDOWN_MS = 45 * 60 * 1000;
  if (silenceMs >= LONELY_SILENCE_MS && state.affection > 50 && timeSinceProactive >= LONELY_COOLDOWN_MS) {
    return { trigger: "LONELY" };
  }

  // 4. BORED: silence > 40m, affection < 40, cooldown 60m
  const BORED_SILENCE_MS = 40 * 60 * 1000;
  const BORED_COOLDOWN_MS = 60 * 60 * 1000;
  if (silenceMs >= BORED_SILENCE_MS && state.affection < 40 && timeSinceProactive >= BORED_COOLDOWN_MS) {
    return { trigger: "BORED" };
  }

  return null;
}

const moodHandler = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Drain & process sensor events from query or body (R5, R12)
    const rawEvents = req.query.events || req.body?.events || null;
    let eventList = [];
    if (rawEvents) {
      eventList = typeof rawEvents === 'string' 
        ? rawEvents.split(',').map(e => e.trim()).filter(Boolean)
        : Array.isArray(rawEvents) ? rawEvents : [];
    }

    if (eventList.length > 0) {
      await recordSensorEvents(eventList);
    }

    // 2. Fetch fresh persistent relationship state (with lazy decay applied)
    const currentState = await getMoodState(true);

    // 3. Query Spotify cache for currently playing track & synced lyrics (R11)
    let currentTrackInfo = null;
    try {
      currentTrackInfo = await fetchCurrentlyPlayingTrack();
    } catch (e) {
      // Graceful fallback if Spotify is unreachable
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
    let displayOutput = proactivePayload ? proactivePayload.screen_text : currentState.last_reply_display;
    let eyeOutput = proactivePayload ? proactivePayload.eye_state : currentState.eye_state;
    let moveOutput = proactivePayload ? proactivePayload.movement : currentState.movement;

    // Spotify live playback & synced lyrics sync
    if (currentTrackInfo && currentTrackInfo.isPlaying && currentTrackInfo.trackName) {
      const lyricsLine = getCurrentLyricsLine(currentTrackInfo.lyrics, currentTrackInfo.progressMs, currentTrackInfo.trackName);
      const francoLyrics = toFranco(lyricsLine, currentTrackInfo.trackName.substring(0, 18));
      
      const isRecentChat = currentState.lastUserMessageTime && (Date.now() - currentState.lastUserMessageTime < 6000);
      if (!isRecentChat && !proactivePayload) {
        eyeOutput = "MUSIC_DANCE";
        moveOutput = "WIGGLE";
        displayOutput = francoLyrics;
      }
    }

    const responsePayload = {
      status: "ok",
      mood: currentState.mood,
      energy: currentState.energy,
      daily_mood: currentState.daily_mood,
      last_reply: proactivePayload ? proactivePayload.speech : currentState.last_reply,
      last_reply_en: proactivePayload ? proactivePayload.speech_en : currentState.last_reply_en,
      last_reply_display: displayOutput,
      screen_text: displayOutput,
      voice_clip: currentState.voice_clip,
      data_type: currentState.data_type,
      msg_id: currentState.msg_id,
      command: currentState.command,
      joystick: currentState.joystick,
      idle_hours: currentState.idle_hours,
      eye_state: eyeOutput,
      movement: moveOutput,
      haptic_feedback: proactivePayload ? proactivePayload.haptic_feedback : currentState.haptic_feedback,
      now_playing: currentTrackInfo,
      current_track: currentTrackInfo && currentTrackInfo.isPlaying ? `${currentTrackInfo.trackName} - ${currentTrackInfo.artistName || ''}` : "NONE",
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
  } catch (error) {
    console.error('Mood API Error:', error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

module.exports = moodHandler;
module.exports.evaluateProactiveTriggers = evaluateProactiveTriggers;
