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
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

function getNotificationReply(app, type, content) {
  const appName = (app || '').toLowerCase();
  const typeStr = (type || '').toLowerCase();
  const textContent = (content || '').toLowerCase();
  
  // 1. Charger Connected / Charging
  if (appName.includes('charger') || appName.includes('شاحن') || typeStr.includes('charger') || textContent.includes('charger') || textContent.includes('شحن')) {
    return {
      reply: "حبيبي تسلم! الآيفون بيتشحن دلوقتي وعينيا عليه ⚡",
      display: "Charger Plugged!",
      mood: "EXCITED"
    };
  }

  // 2. Low Battery Mode / Battery Level
  if (appName.includes('battery') || appName.includes('بطارية') || textContent.includes('battery') || textContent.includes('بطارية')) {
    return {
      reply: "يا ساتر البطارية ضعيفة! حط التليفون على الشاحن بدل ما يفصل منك 🔋",
      display: "Low Battery!",
      mood: "ANNOYED"
    };
  }

  // 3. Wi-Fi Connected
  if (appName.includes('wifi') || appName.includes('واي فاي') || textContent.includes('wifi') || textContent.includes('بيت')) {
    return {
      reply: "أهلاً بيك في البيت! شبكة الـ Wi-Fi اتصلت والمكان نور 🏠📶",
      display: "WiFi Connected!",
      mood: "HAPPY"
    };
  }

  // 4. Alarm Dismissed / Morning Wake Up
  if (appName.includes('alarm') || appName.includes('منبه') || textContent.includes('alarm') || textContent.includes('منبه')) {
    return {
      reply: "صباح الفل والياسمين! صح النوم يا بطل، يومك سعيد ☀️",
      display: "Good Morning!",
      mood: "HAPPY"
    };
  }

  // 5. WhatsApp
  if (appName.includes('whatsapp') || appName.includes('واتساب')) {
    return {
      reply: content || "وصلتك رسالة واتساب جديدة! 💬",
      display: "WA: New Msg!",
      mood: "EXCITED"
    };
  }
  
  // 6. Telegram
  if (appName.includes('telegram') || appName.includes('تليجرام')) {
    return {
      reply: content || "جاتلك رسالة جديدة على تليجرام! 📱",
      display: "TG: New Msg!",
      mood: "EXCITED"
    };
  }

  // 7. Instagram
  if (appName.includes('instagram') || appName.includes('انستجرام')) {
    return {
      reply: content || "في إشعار جديد على إنستجرام! 📸",
      display: "IG: New Notif!",
      mood: "HAPPY"
    };
  }

  // Default fallback
  return {
    reply: content || `وصلك إشعار جديد من تطبيق ${app || 'النظام'}!`,
    display: enforceEnglishScreenText(`${app || 'App'} Notif!`, "App Notif!"),
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

  const { app, type, content } = req.body || {};

  try {
    const notifInfo = getNotificationReply(app, type, content);

    const cleanReply = (notifInfo.reply || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
    const englishDisplay = enforceEnglishScreenText(notifInfo.display, "Notification!");

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
