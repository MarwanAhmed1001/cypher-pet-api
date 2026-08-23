const axios = require('axios');

async function testOpenRouterFree() {
  const keys = [
    process.env.OPENROUTER_API_KEY,
    "sk-or-v1-free-demo-key-12345"
  ];

  for (const k of keys) {
    if (!k) continue;
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'deepseek/deepseek-r1:free',
        messages: [{ role: 'user', content: 'ازيك يا لولا احكيلي حكاية' }]
      }, {
        headers: { 'Authorization': `Bearer ${k}` },
        timeout: 5000
      });
      console.log("SUCCESS OpenRouter Free:", res.data.choices[0].message.content);
      return;
    } catch (e) {
      console.error("OpenRouter error:", e.response ? e.response.status : e.message);
    }
  }
}

testOpenRouterFree();
