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

// Generate fun Egyptian slang responses based on app & content
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
      reply: content || "في إشعار جديد على إنستجرام! حد عملك لايك أو بعتلك DMs 📸",
      display: "IG: New Notif!",
      mood: "HAPPY"
    };
  }

  if (appName.includes('facebook') || appName.includes('فيسبوك')) {
    return {
      reply: content || "جاتلك نوتيفيكيشن على الفيس! روح شوف مين عمل كومنت 📘",
      display: "FB: New Notif!",
      mood: "HAPPY"
    };
  }

  // Default fallback for any other app
  return {
    reply: content || `وصلك إشعار جديد من تطبيق ${app || 'النظام'}!`,
    display: `${(app || 'App').substring(0, 8)} Notif!`,
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

    const state = recordInteraction(
      notifInfo.reply,
      notifInfo.mood,
      'notification',
      notifInfo.display
    );

    return res.status(200).json({
      success: true,
      message: `Notification for ${app || 'app'} processed successfully`,
      reply: notifInfo.reply,
      reply_display: notifInfo.display,
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
