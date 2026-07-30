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
  if (fullContext.includes('spotify') || fullContext.includes('سبوتيفاي') || fullContext.includes('music') || fullContext.includes('موسيقى') || title.length > 0) {
    let songInfoArabic = "";
    let songInfoDisplay = "";

    if (title && artist) {
      songInfoArabic = `بتسمع "${title}" لـ ${artist}. الذوق محتاج مراجعة.`;
      songInfoDisplay = enforceEnglishScreenText(`${artist} - ${title}`, `${title}`);
    } else if (title) {
      songInfoArabic = `شغال أغنية: "${title}". تمام، كمل.`;
      songInfoDisplay = enforceEnglishScreenText(`${title}`, "Spotify Music!");
    } else {
      songInfoArabic = "شغّلت سبوتيفاي... كأن مفيش وراك حاجة تانية تعملها.";
      songInfoDisplay = "Spotify Music!";
    }

    return {
      reply: songInfoArabic,
      display: songInfoDisplay,
      mood: "NEUTRAL"
    };
  }

  // 2. Charger / Charging
  if (fullContext.includes('charger') || fullContext.includes('charging') || fullContext.includes('شاحن') || fullContext.includes('شحن')) {
    return {
      reply: "أخيراً افتكرت تحطه على الشاحن قبل ما يفصل.",
      display: "Charger Plugged!",
      mood: "NEUTRAL"
    };
  }

  // 3. Low Battery Mode / Battery Level
  if (fullContext.includes('battery') || fullContext.includes('بطارية') || fullContext.includes('بطاريه') || fullContext.includes('low_battery') || fullContext.includes('lowpower')) {
    return {
      reply: "البطارية بتفوت، حط التليفون على الشاحن بدل العطلة دي.",
      display: "Low Battery!",
      mood: "ANNOYED"
    };
  }

  // 4. Wi-Fi Connected
  if (fullContext.includes('wifi') || fullContext.includes('wi-fi') || fullContext.includes('واي فاي') || fullContext.includes('شبكة')) {
    return {
      reply: "اتصلت بالشبكة. اتفضل كمل رغي.",
      display: "WiFi Connected!",
      mood: "NEUTRAL"
    };
  }

  // 5. Alarm Dismissed / Morning Wake Up
  if (fullContext.includes('alarm') || fullContext.includes('منبه') || fullContext.includes('صباح') || fullContext.includes('dismiss')) {
    return {
      reply: "صحيت؟ ياريت تكون هتسيبني في حالي.",
      display: "Alarm Off!",
      mood: "NEUTRAL"
    };
  }

  // 6. WhatsApp
  if (fullContext.includes('whatsapp') || fullContext.includes('واتساب')) {
    return {
      reply: "رسالة واتساب جديدة... ياترى مين بيوجع دماغه بيك.",
      display: "WA: New Msg!",
      mood: "NEUTRAL"
    };
  }

  // 7. SMS / Text Message
  if (fullContext.includes('sms') || fullContext.includes('message')) {
    return {
      reply: "وصلتك رسالة. روح شوفها وخلصنا.",
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
        reply: `إشعار جديد: ${cleanCustom}. مش مهم أوي يعني.`,
        display: cleanCustom,
        mood: "NEUTRAL"
      };
    }
  }

  return {
    reply: "إشعار جديد وصل. تليفونك مبيسكتش.",
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

