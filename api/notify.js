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
  
  if (appName.includes('whatsapp') || appName.includes('واتساب')) {
    return {
      reply: content || "وصلتك رسالة واتساب جديدة! روح افتح الأبليكيشن شوف مين بيراذلك 💬",
      display: "WA: New Msg!",
      mood: "EXCITED"
    };
  }
  
  if (appName.includes('telegram') || appName.includes('تليجرام')) {
    return {
      reply: content || "جاتلك رسالة جديدة على تليجرام! افتح شوف الإشعار 📱",
      display: "TG: New Msg!",
      mood: "EXCITED"
    };
  }

  if (appName.includes('instagram') || appName.includes('انستجرام')) {
    return {
      reply: content || "في إشعار جديد على إنستجرام! 📸",
      display: "IG: New Notif!",
      mood: "HAPPY"
    };
  }

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
    const englishDisplay = enforceEnglishScreenText(notifInfo.display, "WA: New Msg!");

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
