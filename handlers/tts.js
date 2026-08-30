const axios = require('axios');
const { getMoodState } = require('../lib/store');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { text: queryText, lang: queryLang } = req.query || {};
    let textToSpeak = queryText;

    if (!textToSpeak) {
      const currentState = await getMoodState();
      textToSpeak = currentState.last_reply_en || currentState.last_reply || "Hello! I am Lola, your cute robot pet!";
    }

    // Clean text of emojis and special characters for TTS
    let cleanText = textToSpeak
      .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\*\#\_\~\[\]\(\)\{\}\<\>\/\\\|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) cleanText = "Hello! I am Lola, your cute robot pet!";

    // Limit to 120 characters without cutting words (guarantees audio is ~12-16KB, well under 24KB buffer)
    if (cleanText.length > 120) {
      const truncated = cleanText.substring(0, 120);
      const lastSpace = truncated.lastIndexOf(' ');
      cleanText = lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated;
    }

    // Detect language strictly based on text content
    let lang = queryLang;
    if (!lang) {
      const isArabic = /[\u0600-\u06FF]/.test(cleanText);
      lang = isArabic ? 'ar' : 'en';
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`;

    const audioRes = await axios.get(ttsUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 8000
    });

    const buffer = Buffer.from(audioRes.data);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(buffer);
  } catch (err) {
    console.error("TTS Handler Error:", err.message);
    res.status(500).json({ error: "Failed to generate TTS audio", details: err.message });
  }
};
