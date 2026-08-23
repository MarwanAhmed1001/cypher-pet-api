const { recordInteraction } = require('../lib/store');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function enforceEnglishScreenText(text, fallback = "Cypher Event!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 22) return clean.substring(0, 22);
  return clean;
}

function getNotificationReply(req) {
  const query = req.query || {};
  const body = req.body || {};
  
  const queryStr = JSON.stringify(query).toLowerCase();
  const bodyStr = JSON.stringify(body).toLowerCase();
  const urlStr = (req.url || '').toLowerCase();
  const fullContext = `${urlStr} ${queryStr} ${bodyStr}`;

  const title = (query.title || body.title || query.song || body.song || query.track || body.track || '').toString().trim();
  const artist = (query.artist || body.artist || query.singer || body.singer || '').toString().trim();

  // 1. Spotify / Music
  if (fullContext.includes('spotify') || fullContext.includes('Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ') || fullContext.includes('music') || fullContext.includes('Ù…ÙˆØ³ÙŠÙ‚Ù‰') || title.length > 0) {
    let songInfoArabic = "";
    let songInfoDisplay = "";

    if (title && artist) {
      songInfoArabic = `Ø¨ØªØ³Ù…Ø¹ "${title}" Ù„Ù€ ${artist}. Ø§Ù„Ø°ÙˆÙ‚ Ù…Ø­ØªØ§Ø¬ Ù…Ø±Ø§Ø¬Ø¹Ø©.`;
      songInfoDisplay = enforceEnglishScreenText(`${artist} - ${title}`, `${title}`);
    } else if (title) {
      songInfoArabic = `Ø´ØºØ§Ù„ Ø£ØºÙ†ÙŠØ©: "${title}". ØªÙ…Ø§Ù…ØŒ ÙƒÙ…Ù„.`;
      songInfoDisplay = enforceEnglishScreenText(`${title}`, "Spotify Music!");
    } else {
      songInfoArabic = "Ø´ØºÙ‘Ù„Øª Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ... ÙƒØ£Ù† Ù…ÙÙŠØ´ ÙˆØ±Ø§Ùƒ Ø­Ø§Ø¬Ø© ØªØ§Ù†ÙŠØ© ØªØ¹Ù…Ù„Ù‡Ø§.";
      songInfoDisplay = "Spotify Music!";
    }

    return {
      reply: songInfoArabic,
      display: songInfoDisplay,
      mood: "NEUTRAL"
    };
  }

  // 2. Charger / Charging
  if (fullContext.includes('charger') || fullContext.includes('charging') || fullContext.includes('Ø´Ø§Ø­Ù†') || fullContext.includes('Ø´Ø­Ù†')) {
    return {
      reply: "Ø£Ø®ÙŠØ±Ø§Ù‹ Ø§ÙØªÙƒØ±Øª ØªØ­Ø·Ù‡ Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø­Ù† Ù‚Ø¨Ù„ Ù…Ø§ ÙŠÙØµÙ„.",
      display: "Charger Plugged!",
      mood: "NEUTRAL"
    };
  }

  // 3. Low Battery Mode / Battery Level
  if (fullContext.includes('battery') || fullContext.includes('Ø¨Ø·Ø§Ø±ÙŠØ©') || fullContext.includes('Ø¨Ø·Ø§Ø±ÙŠÙ‡') || fullContext.includes('low_battery') || fullContext.includes('lowpower')) {
    return {
      reply: "Ø§Ù„Ø¨Ø·Ø§Ø±ÙŠØ© Ø¨ØªÙÙˆØªØŒ Ø­Ø· Ø§Ù„ØªÙ„ÙŠÙÙˆÙ† Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø­Ù† Ø¨Ø¯Ù„ Ø§Ù„Ø¹Ø·Ù„Ø© Ø¯ÙŠ.",
      display: "Low Battery!",
      mood: "ANNOYED"
    };
  }

  // 4. Wi-Fi Connected
  if (fullContext.includes('wifi') || fullContext.includes('wi-fi') || fullContext.includes('ÙˆØ§ÙŠ ÙØ§ÙŠ') || fullContext.includes('Ø´Ø¨ÙƒØ©')) {
    return {
      reply: "Ø§ØªØµÙ„Øª Ø¨Ø§Ù„Ø´Ø¨ÙƒØ©. Ø§ØªÙØ¶Ù„ ÙƒÙ…Ù„ Ø±ØºÙŠ.",
      display: "WiFi Connected!",
      mood: "NEUTRAL"
    };
  }

  // 5. Alarm Dismissed / Morning Wake Up
  if (fullContext.includes('alarm') || fullContext.includes('Ù…Ù†Ø¨Ù‡') || fullContext.includes('ØµØ¨Ø§Ø­') || fullContext.includes('dismiss')) {
    return {
      reply: "ØµØ­ÙŠØªØŸ ÙŠØ§Ø±ÙŠØª ØªÙƒÙˆÙ† Ù‡ØªØ³ÙŠØ¨Ù†ÙŠ ÙÙŠ Ø­Ø§Ù„ÙŠ.",
      display: "Alarm Off!",
      mood: "NEUTRAL"
    };
  }

  // 6. WhatsApp
  if (fullContext.includes('whatsapp') || fullContext.includes('ÙˆØ§ØªØ³Ø§Ø¨')) {
    return {
      reply: "Ø±Ø³Ø§Ù„Ø© ÙˆØ§ØªØ³Ø§Ø¨ Ø¬Ø¯ÙŠØ¯Ø©... ÙŠØ§ØªØ±Ù‰ Ù…ÙŠÙ† Ø¨ÙŠÙˆØ¬Ø¹ Ø¯Ù…Ø§ØºÙ‡ Ø¨ÙŠÙƒ.",
      display: "WA: New Msg!",
      mood: "NEUTRAL"
    };
  }

  // 7. SMS / Text Message
  if (fullContext.includes('sms') || fullContext.includes('message')) {
    return {
      reply: "ÙˆØµÙ„ØªÙƒ Ø±Ø³Ø§Ù„Ø©. Ø±ÙˆØ­ Ø´ÙˆÙÙ‡Ø§ ÙˆØ®Ù„ØµÙ†Ø§.",
      display: "SMS: New Msg!",
      mood: "NEUTRAL"
    };
  }

  // Check if user passed explicit text parameter in query or body
  const customText = query.type || query.name || query.text || (body && (body.content || body.text || body.app));
  if (customText) {
    const cleanCustom = enforceEnglishScreenText(customText.toString(), "");
    if (cleanCustom.length > 0) {
      return {
        reply: `Ø¥Ø´Ø¹Ø§Ø± Ø¬Ø¯ÙŠØ¯: ${cleanCustom}. Ù…Ø´ Ù…Ù‡Ù… Ø£ÙˆÙŠ ÙŠØ¹Ù†ÙŠ.`,
        display: cleanCustom,
        mood: "NEUTRAL"
      };
    }
  }

  return {
    reply: "Ø¥Ø´Ø¹Ø§Ø± Ø¬Ø¯ÙŠØ¯ ÙˆØµÙ„. ØªÙ„ÙŠÙÙˆÙ†Ùƒ Ù…Ø¨ÙŠØ³ÙƒØªØ´.",
    display: "iOS Event!",
    mood: "NEUTRAL"
  };
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const notifInfo = getNotificationReply(req);

    const cleanReply = (notifInfo.reply || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    const englishDisplay = enforceEnglishScreenText(notifInfo.display, "Cypher Event!");

    const state = recordInteraction(
      cleanReply,
      notifInfo.mood,
      'notification',
      englishDisplay,
      -2 // Notifications add slight annoyance if frequent
    );

    return res.status(200).json({
      success: true,
      message: `Notification processed successfully`,
      reply: cleanReply,
      reply_display: englishDisplay,
      mood: notifInfo.mood,
      data: state
    });
  } catch (error) {
    console.error('Notification API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
};

