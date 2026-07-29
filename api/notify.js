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

function enforceEnglishScreenText(text, fallback = "iOS Event!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 20) return clean.substring(0, 20);
  return clean;
}

function getNotificationReply(reqBody) {
  // Inspect the entire JSON payload string for keywords
  const payloadStr = JSON.stringify(reqBody || {}).toLowerCase();
  
  const app = (reqBody.app || reqBody.name || reqBody.action || '').toString();
  const content = (reqBody.content || reqBody.text || reqBody.message || reqBody.type || '').toString();

  // 1. Charger Connected / Charging
  if (payloadStr.includes('charger') || payloadStr.includes('charging') || payloadStr.includes('شاحن') || payloadStr.includes('شحن')) {
    return {
      reply: "حبيبي تسلم! الآيفون بيتشحن دلوقتي وعينيا عليه ⚡",
      display: "Charger Plugged!",
      mood: "EXCITED"
    };
  }

  // 2. Low Battery Mode / Battery Level
  if (payloadStr.includes('battery') || payloadStr.includes('بطارية') || payloadStr.includes('بطاريه')) {
    return {
      reply: "يا ساتر البطارية ضعيفة! حط التليفون على الشاحن بدل ما يفصل منك 🔋",
      display: "Low Battery!",
      mood: "ANNOYED"
    };
  }

  // 3. Wi-Fi Connected
  if (payloadStr.includes('wifi') || payloadStr.includes('wi-fi') || payloadStr.includes('واي فاي') || payloadStr.includes('شبكة')) {
    return {
      reply: "أهلاً بيك في البيت! شبكة الـ Wi-Fi اتصلت والمكان نور 🏠📶",
      display: "WiFi Connected!",
      mood: "HAPPY"
    };
  }

  // 4. Alarm Dismissed / Morning Wake Up
  if (payloadStr.includes('alarm') || payloadStr.includes('منبه') || payloadStr.includes('صباح')) {
    return {
      reply: "صباح الفل والياسمين! صح النوم يا بطل، يومك سعيد ☀️",
      display: "Good Morning!",
      mood: "HAPPY"
    };
  }

  // 5. WhatsApp
  if (payloadStr.includes('whatsapp') || payloadStr.includes('واتساب')) {
    return {
      reply: content || "وصلتك رسالة واتساب جديدة! 💬",
      display: "WA: New Msg!",
      mood: "EXCITED"
    };
  }

  // 6. SMS / Message
  if (payloadStr.includes('sms') || payloadStr.includes('message')) {
    return {
      reply: content || "وصلتك رسالة نصية جديدة! 📱",
      display: "SMS: New Msg!",
      mood: "EXCITED"
    };
  }

  // 7. Telegram
  if (payloadStr.includes('telegram') || payloadStr.includes('تليجرام')) {
    return {
      reply: content || "جاتلك رسالة جديدة على تليجرام! 📱",
      display: "TG: New Msg!",
      mood: "EXCITED"
    };
  }

  // Custom English ASCII text from payload if provided
  let customScreenText = enforceEnglishScreenText(content || app, "");
  if (customScreenText.length > 0 && !customScreenText.toLowerCase().includes("notif")) {
    return {
      reply: content || `وصلك إشعار جديد! 🔔`,
      display: customScreenText,
      mood: "EXCITED"
    };
  }

  return {
    reply: content || "وصلك إشعار جديد من الآيفون! 🔔",
    display: "iOS Event!",
    mood: "EXCITED"
  };
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const body = req.body || {};

  try {
    const notifInfo = getNotificationReply(body);

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
