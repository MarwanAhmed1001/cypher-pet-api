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

function cleanEnglishText(text, fallback = "Notification!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  return clean.length > 0 ? clean : fallback;
}

function getNotificationReply(app, type, content) {
  const appName = (app || '').toLowerCase();
  
  if (appName.includes('whatsapp') || appName.includes('واتساب')) {
    return {
      reply: "You got a new WhatsApp message! Check your phone 💬",
      display: "WA: New Msg!",
      mood: "EXCITED"
    };
  }
  
  if (appName.includes('telegram') || appName.includes('تليجرام')) {
    return {
      reply: "New message received on Telegram! 📱",
      display: "TG: New Msg!",
      mood: "EXCITED"
    };
  }

  if (appName.includes('instagram') || appName.includes('انستجرام')) {
    return {
      reply: "New Instagram notification received! 📸",
      display: "IG: New Notif!",
      mood: "HAPPY"
    };
  }

  return {
    reply: `New notification received from ${app || 'system'}!`,
    display: cleanEnglishText(`${app || 'App'} Notif!`, "App Notif!"),
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

    const cleanReply = cleanEnglishText(notifInfo.reply, "New notification!");
    const englishDisplay = cleanEnglishText(notifInfo.display, "WA: New Msg!");

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
