const axios = require('axios');

async function testPollinations(userMsg) {
  try {
    const prompt = `System: You are Lola (Rapunzel persona). Respond to Ayane in 100% natural Egyptian Arabic. Be smart, funny, and unique every time!
User: ${userMsg}

Return ONLY JSON: {"reply": "...", "reply_display": "Lola: Ready!", "mood": "HAPPY"}`;

    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
    const res = await axios.get(url, { timeout: 10000 });
    console.log("Pollinations AI raw result:", res.data);
  } catch (err) {
    console.error("Pollinations error:", err.message);
  }
}

testPollinations("ازيك يا لولا احكيلي حكاية جديدة غريبة بسرعة");
