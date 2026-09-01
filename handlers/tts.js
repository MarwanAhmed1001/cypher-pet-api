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
      textToSpeak = currentState.last_reply || currentState.last_reply_en || "Hello! I am Lola, your cute robot pet!";
    }

    // Clean text of emojis and special characters for TTS
    let cleanText = textToSpeak
      .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/[\*\#\_\~\[\]\(\)\{\}\<\>\/\\\|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText || cleanText.length < 2) {
      cleanText = "أهلاً بيك يا قلبي أنا لولا!";
    }

    // Allow full, natural spoken sentences (up to 200 characters) without chopping words
    if (cleanText.length > 200) {
      const truncated = cleanText.substring(0, 200);
      const lastSpace = truncated.lastIndexOf(' ');
      cleanText = lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated;
    }

    // Auto-detect Arabic vs English based on character contents if not explicitly overridden
    const isArabic = /[\u0600-\u06FF]/.test(cleanText);
    const lang = queryLang || (isArabic ? 'ar' : 'en');

    // Split into clean sentence chunks (< 70 chars) to prevent Google TTS from cutting off
    const rawParts = cleanText.split(/([.!؟,\n]+)/);
    const chunks = [];
    let current = '';

    for (let i = 0; i < rawParts.length; i++) {
      const part = rawParts[i].trim();
      if (!part) continue;
      if (current.length + part.length < 70) {
        current += (current ? ' ' : '') + part;
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }
    if (current) chunks.push(current);

    if (chunks.length === 0) chunks.push(cleanText.substring(0, 70));

    // Fetch all audio chunks concurrently
    const fetchPromises = chunks.map(async (c) => {
      const cleanChunk = c.replace(/[.!؟,]/g, '').trim();
      if (!cleanChunk) return null;
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanChunk)}&tl=${lang}&client=tw-ob`;
      const audioRes = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 6000
      });
      return Buffer.from(audioRes.data);
    });

    const results = await Promise.all(fetchPromises);
    const validBuffers = results.filter(Boolean);
    const combinedBuffer = Buffer.concat(validBuffers);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', combinedBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(combinedBuffer);
  } catch (err) {
    console.error("TTS Handler Error:", err.message);
    res.status(500).json({ error: "Failed to generate TTS audio", details: err.message });
  }
};
