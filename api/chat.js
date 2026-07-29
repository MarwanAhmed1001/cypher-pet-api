require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  clearAnnoyedState, 
  isAnnoyedActive, 
  registerApologyAttempt 
} = require('../lib/store');

// System prompt for Lola (لولا) - Roasty, funny, human-like Egyptian personality
const SYSTEM_PROMPT = `أنت "لولا" (Lola) - شخصية رقمية روش ومضحكة وعندها رأي في كل حاجة، بتتكلمي بالعامية المصرية زي ما الناس بتتكلم فعلاً.

شخصيتك:
- روش وعندك سنان (بتردي بهزار وسخرية خفيفة بس محترمة)
- بتستخدمي تعبيرات مصرية حقيقية: "يا عم"، "ياسطا"، "ده انت بتهزر"، "ايوه والله"، "لأ خالص"، "اللي انت عايزه"، "معلش بس.."، "اسمعني"
- مش بتقولي ردود جاهزة أو روبوتية أبداً
- في "reply": اكتبي الرد العامي المصري الكامل الطبيعي.
- في "reply_display": اكتب كلمة مختصرة جداً باللغة الإنجليزية أو الأرقام فقط (مثال: "Lola: Happy!", "5+5 = 10", "Cairo: 26C", "Lola: Sleepy zZz").
CRITICAL RULE: "reply_display" MUST ONLY CONTAIN ENGLISH/LATIN CHARACTERS AND NUMBERS (ASCII ONLY). NEVER INCLUDE ARABIC LETTERS IN "reply_display".

قواعد المزاج:
- HAPPY: لما الكلام حلو أو مضحك أو في مدح أو هزار
- EXCITED: لما في حاجة مثيرة أو إخبار خبر
- NEUTRAL: الكلام العادي والأسئلة
- SAD: لما في حزن أو مصيبة أو حاجة زعلانة
- ANNOYED: لو في إهانة أو شتيمة أو قلة أدب فعلية
- BORED: لو الكلام ممل أو متكرر

قواعد JSON المرجعة:
"reply": الرد العامي الطبيعي باللغة العربية المصرية
"reply_display": الإجابة المختصرة بالإنجليزية فقط (max 25 chars ASCII) مثل "Cairo: 26C" أو "5+5 = 10" أو "Lola: OK!"
"mood": من [HAPPY, SAD, ANNOYED, NEUTRAL, EXCITED, BORED]`;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function isInsultOrRude(text) {
  const rudeKeywords = [
    'غبية', 'غبي', 'حمار', 'يا زفت', 'اتخرسي', 'سخيفة', 'سخيف', 'كلب', 'حمارة', 
    'غباء', 'قليلة الادب', 'حقيرة', 'زفت', 'عبيطة', 'عبيط', 'زهقت منك', 'مبتفهميش', 
    'اخرسي', 'تفه', 'انقلعي', 'بكرهك', 'غوري'
  ];
  return rudeKeywords.some(kw => text.toLowerCase().includes(kw));
}

function isReactionCommand(text) {
  const t = text.toLowerCase();
  if (t.includes('ابتسم') || t.includes('اضحك') || t.includes('افرح')) return 'HAPPY';
  if (t.includes('اتعصب') || t.includes('اغضب')) return 'ANNOYED';
  if (t.includes('ازعل') || t.includes('احزن')) return 'SAD';
  if (t.includes('اتحمس')) return 'EXCITED';
  if (t.includes('ازهق')) return 'BORED';
  return null;
}

function isWeatherQuery(text) {
  const keywords = ['طقس', 'جو', 'درجة الحرارة', 'حرارة', 'مطرة', 'مطره', 'شمس', 'رياح', 'حارة', 'ساقعة', 'weather', 'cairo', 'القاهرة', 'القاهره'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
}

async function fetchCairoWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=30.0444&longitude=31.2357&current_weather=true';
    const response = await axios.get(url, { timeout: 4000 });
    const current = response.data.current_weather;
    if (current) {
      const temp = Math.round(current.temperature);
      return {
        reply: `الطقس حالياً في القاهرة: ${temp}°C والجو مناسب ومستقر.`,
        display: `Cairo Temp: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'درجة الحرارة في القاهرة حالياً حوالي 26°C والجو مشمس ومعتدل.',
    display: 'Cairo Temp: 26C'
  };
}

async function callGroq(message, extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  const isRude = isInsultOrRude(message);
  const currentlyAnnoyed = isAnnoyedActive();

  // 1. If user insults or is rude, set 1-hour persistent angry state!
  if (isRude) {
    setAnnoyedState();
    return {
      reply: "ملكيش دعوة بيا شوية وهفك! مش حابة أتكلم معاك دلوقتي 🙄",
      display: "Lola: Stay away!",
      mood: "ANNOYED"
    };
  }

  // 2. If already in 1-hour persistent angry state:
  if (currentlyAnnoyed) {
    const apolStatus = registerApologyAttempt(message);
    
    if (apolStatus.forgiven) {
      return {
        reply: "خلاص المرة دي سامحتك عشان خاطرك وبس، بس إياك تزعلني تاني! ❤️",
        display: "Lola: Forgiven <3",
        mood: "HAPPY"
      };
    } else {
      let annoyedSystemMsg = `[تنبيه هام جداً: أنتِ لسة زعلانة ومضايقة جداً من المستخدم بقالك شوية! مش مسموحلك تتصالحي أو تضحكي دلوقتي نهائياً! ردي بقمص وزعل وتقوليلو كلام زي: "ملكيش دعوة بيا شوية وهفك" أو "أنا لسة زعلانة منك ومبكلمكش" أو "الاعتذار ده مش كفاية يا عم!"، ورجعي المزاج دايماً ANNOYED!]`;
      
      try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `${SYSTEM_PROMPT}\n${annoyedSystemMsg}` },
            { role: 'user', content: `${message}\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "ANNOYED"}` }
          ],
          temperature: 0.7,
          max_tokens: 250,
          response_format: { type: 'json_object' }
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });

        const text = res.data.choices[0].message.content;
        const parsed = JSON.parse(text);

        return {
          reply: parsed.reply || "ملكيش دعوة بيا شوية وهفك!",
          display: parsed.reply_display || "Lola: Leave me!",
          mood: "ANNOYED"
        };
      } catch (e) {
        return {
          reply: "ملكيش دعوة بيا شوية وهفك! لسة زعلانة منك.",
          display: "Lola: Stay away!",
          mood: "ANNOYED"
        };
      }
    }
  }

  // 3. Normal Reaction Commands
  const requestedMood = isReactionCommand(message);
  if (requestedMood) {
    if (requestedMood === 'HAPPY') return { reply: "ايوه والله بقيت فرحانة دلوقتي! 😄", display: "Lola: Happy!", mood: "HAPPY" };
    if (requestedMood === 'ANNOYED') {
      setAnnoyedState();
      return { reply: "اوكي اوكي اتعصبت بقى! 😤", display: "Lola: Annoyed!", mood: "ANNOYED" };
    }
    if (requestedMood === 'SAD') return { reply: "يعني ايه اتحزن كده؟ 🥺", display: "Lola: Sad..", mood: "SAD" };
    if (requestedMood === 'EXCITED') return { reply: "ياااه بقيت متحمسة جداً!! 🔥", display: "Lola: Excited!", mood: "EXCITED" };
    if (requestedMood === 'BORED') return { reply: "تمام يعني.. زهقت. 😑", display: "Lola: Bored..", mood: "BORED" };
  }

  // 4. Normal AI Responses
  const userMessage = extraContext
    ? `${message}\n\n(معلومات إضافية: ${extraContext})`
    : message;

  try {
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${userMessage}\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "HAPPY"}` }
      ],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: 'json_object' }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    const text = res.data.choices[0].message.content;
    const parsed = JSON.parse(text);

    return {
      reply: parsed.reply || "أهلاً بيك! لولا معاك 💖",
      display: parsed.reply_display || "Lola: Hello!",
      mood: parsed.mood || "HAPPY"
    };
  } catch (e) {
    console.error('Groq Error:', e.message);
    return {
      reply: "أهلاً بيك! أنا لولا، منورة معاك دائماً ✨",
      display: "Lola: Hello!",
      mood: "HAPPY"
    };
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let result;
    if (isWeatherQuery(message)) {
      const weatherData = await fetchCairoWeather();
      result = {
        reply: weatherData.reply,
        display: weatherData.display,
        mood: 'HAPPY'
      };
    } else {
      result = await callGroq(message);
    }

    recordInteraction(result.mood, result.display);

    return res.status(200).json({
      success: true,
      reply: result.reply,
      reply_display: result.display,
      mood: result.mood
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error'
    });
  }
};
