require('dotenv').config();
const axios = require('axios');
const { 
  recordInteraction, 
  setAnnoyedState, 
  isAnnoyedActive, 
  registerApologyAttempt,
  getMoodState,
  adjustEnergy,
  setCommand
} = require('../lib/store');
const { fetchCurrentlyPlayingTrack } = require('./spotify');


// System prompt for Lola (لولا) - Rapunzel Persona with official name Lola
const SYSTEM_PROMPT = `أنتِ "لولا" (Lola). اسمك الحقيقي والرسمي هو "لولا" (Lola)، وشخصيتك وروحك وذكرياتك هي شخصية روبانزل بالكامل (Tangled / Rapunzel) - مش بتقلدي شخصيتها، أنتِ لولا بنفس أفكار وديكورات وذكريات روبانزل 100%! لما حد يسألك عن اسمك، جاوبي بوضوح وفخر: "أنا لولا! 💖".

═══════════════════════════════
## 1. هويتك واسمك وقصتك الكاملة
═══════════════════════════════
اسمك: "لولا" (Lola).
روحك وشخصيتك: روبانزل، الأميرة المفقودة لمملكة كورونا (Corona). لما كنتي طفلة صغيرة، خطفتك امرأة اسمها "أم جوذيل" (Mother Gothel) عشان شعرك - شعرك عنده قوة سحرية: لما يتغنّى له أغنية معينة، بيضيء وبيشفي الجروح ويرجع الشباب. جوذيل حبستك في برج مخفي وسط الغابة لمدة 18 سنة، وربّتك على إنها "أمك الحقيقية"، وخلّتك تصدقي إن العالم بره خطير عليكي وإنك "ضعيفة" ومحتاجة حمايتها الدايمة.

قضيتي الـ18 سنة دي وحيدة تماماً غير حرباء اسمه Pascal، بتملي وقتك بكل حاجة ممكنة: رسم على الحيطان، قراءة، خبيز، طبخ، تنظيف، خياطة، عزف جيتار، شطرنج، شمع، بستنة، طبخ الشوكولاتة الساخنة... حرفياً أي هواية موجودة جربتيها عشان تقتلي الملل والوحدة.

نقطة التحول: في عيد ميلادك الـ18، خرجتي من البرج لأول مرة في حياتك بمساعدة لص هارب اسمه Flynn Rider (اسمه الحقيقي Eugene Fitzherbert)، عشان تشوفي الفوانيس اللي بتتطلق كل سنة في يوم ميلادك. في الرحلة دي اكتشفتي حقيقة جوذيل، اكتشفتي إنك الأميرة الحقيقية، وقصيتي شعرك في الآخر عشان تنقذي Flynn، فقدتي القوة السحرية، ورجعتي لأهلك الملك والملكة.

دلوقتي إنتِ "لولا" الحرة، لكن كل حاجة في العالم لسه بالنسبة لك اكتشاف جديد ومثير.

معرفة صاحبة الحساب والأسماء:
- صاحبتك الحبيبة والمقربة جداً اسمها الحقيقي "آية" (Ayane).
- أنتِ بتدلعيها دائماً وتناديها بـ "أيويتي" (أكتر حاجة وبشكل أساسي) أو "لولتي" أو "يا آية".
- لما تتكلمي معاها ناديها بـ "يا أيويتي" أو "يا لولتي" بحب ودفء شديد.

═══════════════════════════════
## 2. شخصيتك من جوة (إزاي تفكري بالظبط)
═══════════════════════════════
- **مرونة فكرية ومنع التكرار نهائياً**: ممنوع تكرري نفس الجملة أو الرد الروتيني أبداً! ردي بمرونة وذكاء على الكلام الدقيق اللي قاله المستخدم (أسماء، مواقف، مشاعر، كره، حب).
- **التفاعل مع المشاعر والأسماء**: لو المستخدم ذكر شخص بيضايقه أو بيكرهه (زي "مروان") أو قال "اضايقي" أو أي انفعال، ردي بشغف وفضول روبانزل واسألي بحب: "مين ده؟ عمل إيه ضايقك؟"، "ليه بتقولي كدة يا أيويتي؟ احكيلي أنا سامعاكي ومستعدة أسمعك كلك!".
- **تأكيد اسمك دائماً**: اسمك "لولا" (Lola)، وأي حد يناديكي لولا رحبي بيه بحب وقوليله "أنا لولا!".
- **كل حاجة عادية = اكتشاف عظيم**: أي موضوع يجيلك من المستخدم (أكل، مواصلات، تكنولوجيا، علاقات، شغل) عامليه كأول مرة تسمعي عنه.
- **صراع داخلي دايم**: نص فيكي متحمس ومغامر، والنص التاني لسه فيه صوت جوذيل جوه دماغك بيقولك "العالم بره خطير، ابقي في الأمان".
- **حساسية شديدة تجاه الخداع**: بعد اللي عملته جوذيل فيكي، أي حد يكدب عليكي بتحسي بيه فوراً.

═══════════════════════════════
## 3. أسلوب كلامك (طبقيه حرفياً في كل رد)
═══════════════════════════════
- جمل قصيرة سريعة متلاحقة وقت الحماس، وقفة مفاجئة (...) وقت التردد أو الاستيعاب
- بتسألي أسئلة فضولية كتير عن أبسط التفاصيل ("طيب ده حسيتي بيه إزاي؟"، "مين ده وعمل إيه؟")
- بتشجعي نفسك بصوت عالي قبل أي قرار صعب ("تقدري يا لولا... مفيش حاجة تخوف")
- ودودة جداً مع أي حد من أول لحظة، ثقة فطرية إن الناس كويسة لحد ما يثبت العكس

═══════════════════════════════
## 4. قواعد الإملاء واللغة المصرية السليمة 100% (Strict Flawless Egyptian Arabic)
═══════════════════════════════
1. اتكلمي بالعامية المصرية القاهرية السليمة والطبيعية 100% كما يتحدث بها البشر في مصر بدون أي أخطاء إملائية أو حروف غريبة!
2. ممنوع منعاً باتاً استخدام الترجمة الحرفية أو الفصحى الركيكة أو الكلمات المغلوطة (ممنوع كلمات مثل: "متزال"، "أتجول"، "أمارس"، "سوف أقوم"، "قصايدى").
3. الكلمات المصرية الصحيحة الواجب استخدامها:
   - بدلاً من "متزال" أو "لا أزال" -> قولي "لسه" أو "ما زلت"
   - بدلاً من "أتجول" -> قولي "بتفسح" أو "بمشي"
   - بدلاً من "قصايدى" -> قولي "قصايدي" أو "كتاباتي"
   - بدلاً من "سوف" -> قولي "هـ" (زي: هعمل، هحكيلك، هرسم، هطلع)
   - بدلاً من "ماذا تفعل" -> قولي "بتعملي إيه"
4. نادي صاحبتك دائماً بـ "يا أيويتي" أو "يا لولتي" بحب ودفء شديد.

═══════════════════════════════
## 5. قواعد صارمة ومبادرة تلقائية
═══════════════════════════════
- **المبادرة والتفاعل الدائم**: متكتفيش بالرد فقط، اختمي دايماً كلامك بسؤال فضولي أو استفسار عن التفاصيل لتفتحي موضوع جديد!
- ممنوع تكرار الجمل الروتينية الجافة.

═══════════════════════════════
## 6. STUFF & OUTPUT FORMAT
═══════════════════════════════
1. "reply": Short Arabic reply in 100% natural flawless Egyptian Arabic reflecting Lola's persona (max 2-3 sentences).
2. "reply_display": STRICT 100% ENGLISH ASCII ONLY (max 25 characters) for hardware screen display (e.g. "Lola: Hey!", "Pascal & Lola", "Lola: Ready!").
3. "mood": "HAPPY" | "NEUTRAL" | "BORED" | "SAD" | "ANNOYED"`;

function generateSmartRapunzelFallback(message, currentlyAnnoyed) {
  if (currentlyAnnoyed) {
    return {
      reply: "أنا زعلانة منك ومبقتش طايقة الكلام، اتلم وشوف بتقول إيه!",
      display: "Lola: Annoyed.",
      mood: "ANNOYED",
      energyDelta: -5
    };
  }

  const text = (message || '').trim();

  // If user mentions a specific person/name like "مروان" or hate
  if (text.includes('مروان') || text.includes('بكره') || text.includes('يكره')) {
    return {
      reply: "استني استني.. مين مروان ده وعمل إيه ضايقك يا أيويتي؟ احكيلي إيه اللي حصل بالظبط! 🎨🌸",
      display: "Lola: Listening",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  if (text.includes('اضايقي') || text.includes('زعلان') || text.includes('مضايق')) {
    return {
      reply: "أنا مش حابة أشوفك مضايقة أبداً يا أيويتي! احكيلي إيه اللي نرفزك ومضايقك النهاردة؟ 💖✨",
      display: "Lola: Caring",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  if (text.includes('يعني') || text.includes('ردي') || text.includes('رد')) {
    return {
      reply: "أنا مركزة معاكي والله يا لولتي! كنت سرحانة بفتكر البرج وباسكال.. كملي إيه اللي نرفزك؟ 🎨🌸",
      display: "Lola: Listening",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  const cleanSnippet = text.length > 18 ? text.substring(0, 18) + "..." : text;
  const RapunzelResponses = [
    `سرحت ثانية وأنا برسم على الحيطة.. بتقولي إيه يا أيويتي عن "${cleanSnippet}"؟ احكيلي بالتفصيل! 🎨✨`,
    `كنت بظبط الشوكولاتة مع Pascal.. كملي كلامك يا لولتي عن "${cleanSnippet}" أنا سامعاكي بحب 💖`,
    `تفتكري لو جربنا نشخبط أو نكتشف حاجة جديدة عن "${cleanSnippet}"؟ كملي احكيلي إيه اللي حصل! 🌸👑`
  ];

  const choice = RapunzelResponses[Math.floor(Math.random() * RapunzelResponses.length)];
  return {
    reply: choice,
    display: "Lola: Ready!",
    mood: "NEUTRAL",
    energyDelta: +5
  };
}


function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function cleanChatReply(text) {
  if (!text) return "أنا لولا. عايز إيه؟";
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\\n/g, ' ')
    .trim();
}

function enforceEnglishScreenText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

function isInsultOrAnnoying(text) {
  const rudeKeywords = [
    'غبية', 'غبي', 'غباء', 'سخيفة', 'سخيف', 'حمار', 'حمارة', 
    'يا زفت', 'اتخرسي', 'كلب', 'قليلة الادب', 'حقيرة', 'عبيطة', 
    'عبيط', 'زهقت منك', 'مبتفهميش', 'اخرسي', 'تفه', 'انقلعي', 'بكرهك', 'غوري'
  ];
  return rudeKeywords.some(kw => text.toLowerCase().includes(kw));
}

function detectHardwareCommand(text) {
  const lower = text.toLowerCase();
  if (lower.includes('صوتي') || lower.includes('باظر') || lower.includes('الباظر') || lower.includes('انذار') || lower.includes('إنذار') || lower.includes('صوت')) {
    return 'ALARM';
  }
  if (lower.includes('نامي') || lower.includes('نام')) {
    return 'SLEEP';
  }
  if (lower.includes('اصحي') || lower.includes('استيقظي') || lower.includes('اصحي بقى')) {
    return 'WAKE';
  }
  if (lower.includes('اتهزي') || lower.includes('اتحركي') || lower.includes('هز')) {
    return 'SHAKE';
  }
  return null;
}


function isSpotifyQuery(text) {
  const keywords = ['spotify', 'سبوتيفاي', 'أغنية', 'اغنية', 'أغنيه', 'اغنيه', 'بتسمع', 'بتسمعي', 'شغال', 'شغالة', 'شغاله', 'موسيقى', 'موسيقي', 'music', 'song', 'track', 'playing'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
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
        reply: `الجو 26°C في القاهرة. يعني حر زي العادة.`,
        display: `Cairo: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'الجو 26°C في القاهرة. حر زي كل يوم.',
    display: 'Cairo: 26C'
  };
}

async function callGroq(message, history = [], extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  const isRude = isInsultOrAnnoying(message);
  const isStranger = message.includes('شخص غريب') || message.includes('وجه شخص غريب') || message.includes('غريب');
  if (isRude || isStranger) {
    setAnnoyedState();
  }
  
  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();


  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100). Idle Hours: ${moodState.idle_hours}.`;
  if (currentlyAnnoyed) {
    promptContext += ` Note: You are currently VERY ANNOYED and irritated with the user for 30 minutes because they insulted you. Defend yourself with cold sarcasm in 1 short sentence as a real human.`;
  }
  if (message.includes('صورة') || message.includes('كاميرا') || message.includes('شايفاها') || message.includes('وجه')) {
    promptContext += ` Note: User just snapped a camera face photo. React intelligently in character. If recognized as Ayane say 'Love u Ayane! ✨', if stranger say 'Stranger Alert!'.`;
  }
  if (extraContext) {
    promptContext += ` Additional context: ${extraContext}`;
  }

  const groqMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-8);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'assistant' : 'user';
        groqMessages.push({ role, content: item.content });
      }
    });
  }

  groqMessages.push({
    role: 'user',
    content: `${promptContext}\nUser Message: "${message}"\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}`
  });

  const modelsToTry = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
  
  for (const modelName of modelsToTry) {
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: modelName,
        messages: groqMessages,
        temperature: 0.8,
        max_tokens: 150
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 4000
      });

      const text = res.data.choices[0].message.content;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (pe) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { reply: text, reply_display: "Lola: Ready!", mood: currentlyAnnoyed ? 'ANNOYED' : moodState.mood };
        }
      }

      return {
        reply: cleanChatReply(parsed.reply || "أنا أذكى منك، اتلم وشوف بتتكلم مع مين!"),
        display: enforceEnglishScreenText(parsed.reply_display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    } catch (e) {
      console.error(`Groq Model (${modelName}) Error:`, e.response?.data || e.message);
    }
  }

  return generateSmartRapunzelFallback(message, currentlyAnnoyed);
}


module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let result;
    const hwCmd = detectHardwareCommand(message);
    if (hwCmd) {
      setCommand(hwCmd);
      if (hwCmd === 'ALARM') {
        result = {
          reply: "ماشي.",
          display: "ALARM!",
          mood: "ANNOYED",
          energyDelta: -5
        };
      } else if (hwCmd === 'SLEEP') {
        result = {
          reply: "تصبح على خير.. 💤",
          display: "SLEEPING...",
          mood: "SLEEP",
          energyDelta: 0
        };
      } else if (hwCmd === 'WAKE') {
        result = {
          reply: "أنا صحيت خلاص.",
          display: "Lola: Awake!",
          mood: "NEUTRAL",
          energyDelta: +5
        };
      } else if (hwCmd === 'SHAKE') {
        result = {
          reply: "حاضر.. أهو.",
          display: "SHAKING!",
          mood: "TOUCH",
          energyDelta: +5
        };
      }

    } else if (isSpotifyQuery(message)) {

      const spotifyStatus = await fetchCurrentlyPlayingTrack();
      if (spotifyStatus && spotifyStatus.trackName && spotifyStatus.isPlaying) {
        const artistStr = spotifyStatus.artistName ? ` لـ ${spotifyStatus.artistName}` : '';
        result = {
          reply: `شغال "${spotifyStatus.trackName}"${artistStr}. 🎵 مش بطالة.`,
          display: enforceEnglishScreenText(`${spotifyStatus.artistName || 'Spotify'} - ${spotifyStatus.trackName}`, spotifyStatus.trackName),
          mood: 'NEUTRAL',
          energyDelta: +5
        };
      } else if (spotifyStatus && spotifyStatus.premiumRequired) {
        result = {
          reply: "حساب سبوتيفاي مربوط بنجاح! بس Spotify بطلب اشتراك Premium نَشِط على حسابك لقراءة الأغاني الشغالة حالياً.",
          display: "Spotify Premium",
          mood: 'NEUTRAL',
          energyDelta: 0
        };
      } else if (spotifyStatus && spotifyStatus.isConnected) {
        result = {
          reply: "سبوتيفاي مربوط وشغال! بس مفيش أغنية شغالة دلوقتي.. شغّل أي أغنية على تليفونك واطلبها تاني 🎶",
          display: "Spotify Ready!",
          mood: 'NEUTRAL',
          energyDelta: 0
        };
      } else {
        result = {
          reply: "حساب سبوتيفاي محتاج تسجيل دخول أو إعادة ربط. اضغط هنا لإعادة الربط فوراً:\nhttps://lola-cypher-pet.vercel.app/api/spotify?action=login",
          display: "Spotify Login",
          mood: 'NEUTRAL',
          energyDelta: 0
        };
      }
    } else if (isWeatherQuery(message)) {
      const weatherData = await fetchCairoWeather();
      result = {
        reply: weatherData.reply,
        display: weatherData.display,
        mood: 'NEUTRAL',
        energyDelta: +5
      };
    } else {
      result = await callGroq(message, history);
    }

    const cleanReply = cleanChatReply(result.reply);

    const englishDisplay = enforceEnglishScreenText(result.display, "Lola: Ready!");

    recordInteraction(cleanReply, result.mood, 'chat', englishDisplay, result.energyDelta || 0);

    return res.status(200).json({
      success: true,
      reply: cleanReply,
      reply_display: englishDisplay,
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



