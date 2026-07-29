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

function enforceEnglishScreenText(text, fallback = "Notification!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 20) return clean.substring(0, 20);
  return clean;
}

function getNotificationReply(req) {
  const queryStr = JSON.stringify(req.query || {}).toLowerCase();
  const bodyStr = JSON.stringify(req.body || {}).toLowerCase();
  const urlStr = (req.url || '').toLowerCase();
  
  // Combine all request context
  const fullContext = `${urlStr} ${queryStr} ${bodyStr}`;

  // 1. Charger / Charging
  if (fullContext.includes('charger') || fullContext.includes('charging') || fullContext.includes('شاحن') || fullContext.includes('شحن')) {
    return {
      reply: "حبيبي تسلم! الآيفون بيتشحن دلوقتي وعينيا عليه ⚡",
      display: "Charger Plugged!",
      mood: "EXCITED"
    };
  }

  // 2. Low Battery Mode / Battery Level
  if (fullContext.includes('battery') || fullContext.includes('بطارية') || fullContext.includes('بطاريه') || fullContext.includes('low_battery') || fullContext.includes('lowpower')) {
    return {
      reply: "يا ساتر البطارية ضعيفة! حط التليفون على الشاحن بدل ما يفصل منك 🔋",
      display: "Low Battery!",
      mood: "ANNOYED"
    };
  }

  // 3. Wi-Fi Connected
  if (fullContext.includes('wifi') || fullContext.includes('wi-fi') || fullContext.includes('واي فاي') || fullContext.includes('شبكة')) {
    return {
      reply: "أهلاً بيك في البيت! شبكة الـ Wi-Fi اتصلت والمكان نور 🏠📶",
      display: "WiFi Connected!",
      mood: "HAPPY"
    };
  }

  // 4. Alarm Dismissed / Morning Wake Up
  if (fullContext.includes('alarm') || fullContext.includes('منبه') || fullContext.includes('صباح') || fullContext.includes('dismiss')) {
    return {
      reply: "صباح الفل والياسمين! صح النوم يا بطل، يومك سعيد ☀️",
      display: "Good Morning!",
      mood: "HAPPY"
    };
  }

  // 5. WhatsApp
  if (fullContext.includes('whatsapp') || fullContext.includes('واتساب')) {
    return {
      reply: "وصلتك رسالة واتساب جديدة! 💬",
      display: "WA: New Msg!",
      mood: "EXCITED"
    };
  }

  // 6. SMS / Text Message
  if (fullContext.includes('sms') || fullContext.includes('message')) {
    return {
      reply: "وصلتك رسالة نصية جديدة! 📱",
      display: "SMS: New Msg!",
      mood: "EXCITED"
    };
  }

  // Check if user passed explicit text parameter in query or body
  const customText = req.query.type || req.query.name || req.query.text || (req.body && (req.body.content || req.body.text || req.body.app));
  if (customText) {
    const cleanCustom = enforceEnglishScreenText(customText.toString(), "");
    if (cleanCustom.length > 0) {
      return {
        reply: `وصلك إشعار جديد (${cleanCustom})! 🔔`,
        display: cleanCustom,
        mood: "EXCITED"
      };
    }
  }

  return {
    reply: "وصلك إشعار جديد من الآيفون! 🔔",
    display: "iOS Event!",
    mood: "EXCITED"
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
    const englishDisplay = enforceEnglishScreenText(notifInfo.display, "iOS Event!");

    const state = recordInteraction(
      cleanReply,
      notifInfo.mood,
      'notification',
      englishDisplay
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
