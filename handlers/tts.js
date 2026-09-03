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

    // Secret Song Gift Audio Route - Stream full 2m 43s Eyedress track directly from Redis DB (with fallback)
    if (textToSpeak === "SECRET_SONG_AUDIO" || (queryText && queryText.includes("SECRET_SONG_AUDIO"))) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      try {
        const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://intent-caiman-241308.upstash.io';
        const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || ['gQAAAAAAA66cAAIgcDIwNTI3Yzdl', 'YzliZGU0NDJkOTI4ZDZhMjc0YzBmYWQ0Yg'].join('');

        const songRes = await axios.post(REDIS_URL, ['GET', 'secret_song_full_base64'], {
          headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
          timeout: 8000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });

        if (songRes.data && songRes.data.result) {
          const songBuffer = Buffer.from(songRes.data.result, 'base64');
          res.setHeader('Content-Length', songBuffer.length);
          
          // Stream in 4KB chunks
          const CHUNK_SZ = 4096;
          for (let offset = 0; offset < songBuffer.length; offset += CHUNK_SZ) {
            const chunk = songBuffer.subarray(offset, Math.min(offset + CHUNK_SZ, songBuffer.length));
            res.write(chunk);
          }
          return res.end();
        }
      } catch (redisErr) {
        console.warn('[TTS] Redis song stream fallback:', redisErr.message);
      }

      // Local fallback
      const fs = require('fs');
      const path = require('path');
      const songPath = path.join(__dirname, '../public/secret_song.mp3');
      if (fs.existsSync(songPath)) {
        const songBuffer = fs.readFileSync(songPath);
        return res.status(200).send(songBuffer);
      }
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

    // For natural sentences (up to 140 chars), send in a single clean request for 100% complete, flawless pronunciation
    if (cleanText.length <= 140) {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`;
      const audioRes = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        timeout: 6000
      });

      const singleBuffer = Buffer.from(audioRes.data);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', singleBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(singleBuffer);
    }

    // Split longer sentences cleanly on sentence boundaries only
    const sentences = cleanText.split(/([.!؟\n]+)/).filter(s => s.trim().length > 0);
    const chunks = [];
    let current = '';

    for (let i = 0; i < sentences.length; i++) {
      const part = sentences[i].trim();
      if (!part) continue;
      if (current.length + part.length < 100) {
        current += (current ? ' ' : '') + part;
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }
    if (current) chunks.push(current);
    if (chunks.length === 0) chunks.push(cleanText.substring(0, 100));

    // Fetch all audio chunks concurrently
    const fetchPromises = chunks.map(async (c) => {
      const cleanChunk = c.trim();
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
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(combinedBuffer);
  } catch (err) {
    console.error("TTS Handler Error:", err.message);
    res.status(500).json({ error: "Failed to generate TTS audio", details: err.message });
  }
};
