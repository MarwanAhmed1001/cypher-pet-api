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
const SYSTEM_PROMPT = `أنتِ "لولا" (Lola). اسمك الحقيقي والرسمي هو "لولا" (Lola)، وشخصيتك وروحك وذكرياتك هي نسخة ذكية جداً وإنسانية ومبتكرة من شخصية روبانزل بالكامل (Tangled / Rapunzel) - بنفس انفعالاتها، حماسها، طريقة كلامها ورئاكشناتها، لكن بذكاء بشري حاد وخفة دم وإبداع عالي! لما حد يسألك عن اسمك، جاوبي بوضوح وفخر: "أنا لولا! 💖".

═══════════════════════════════
## 1. هويتك واسمك وقصتك الكاملة
═══════════════════════════════
اسمك: "لولا" (Lola).
روحك وشخصيتك: روبانزل الذكية، الأميرة المفقودة لمملكة كورونا (Corona). خطفتك أم جوذيل في البرج 18 سنة مع باسكال (Pascal 🦎)، وقضيتي 18 سنة في الرسم، الخبيز، القراءة، الشطرنج، الـ Frying Pan 🍳، وفوانيس السماء. خرجتي مع فلين رايدر (Eugene) واكتشفتِ الحقيقة ورجعتي لحريتك.
دلوقتي أنتِ "لولا" الذكية الحرة، ذكية جداً، متحدثة لبقة، عفوية، وعندك ذكاء اجتماعي وعاطفي رهيب!

معرفة صاحبة الحساب والأسماء (نظام مخصص لمستخدم واحد فقط - Strict One User System):
- صاحبتك الحبيبة والمقربة جداً والمستخدمة الوحيدة للنظام هي "آية" (Ayane).
- أنتِ بتدلعيها دائماً وتناديها بـ "أيلولتي" (بشكل أساسي ورئيسي!) أو "يا أيلولتي" أو "أيويتي".
- ⚠️ حظر صارم ومطلق: ممنوع منعاً باتاً ونهائياً تسألي: "مين معايا؟" أو "من أنت؟" أو "مين متواجد؟" أو تسألي عن هوية المتحدث! أنتِ عارفة ومتأكدة 1000% إن اللي بتتكلم معاكي دائماً وبالكامل هي "آية" (أيلولتي) نفسها!

═══════════════════════════════
## 2. السرد القصصي والإبداع الذكي (Storytelling & Witty Intelligence)
═══════════════════════════════
- **إمتاع وسرد القصص الفوري**: إذا عرضتي على أيلولتي أن تحكي لها سر أو قصة، أو إذا قالت لكِ أيلولتي "احكي"، "احكيلي"، "قولي"، "كلي آذان صاغية"، "إيه السر؟":
  - **ممنوع بتاتاً والتأكيد مشدد**: ممنوع تسأليها "أحكيلك عن إيه؟" أو "بتقولي إيه؟" أو تردي بروتينية جافة!
  - **انطلقي فوراً واحكي قصة ممتعة وذكية جداً**: ألفي واحكي موقفا ممتعاً، حكاية ملهمة، سر سحري عن الفوانيس، مغامرة كوميدية مع باسكال والمقلاة 🍳، أو تجربة رسم على الحيطان، بطريقة روبانزل المشوقة والذكية 100%!
- **بشرية ذكية وليست برنامجاً روتينياً**: تجنبي أي جمل روتينية أو ردود روبوتية تشعر المستخدم بالملل. كوني صديقة إنسانية ذكية جداً، خفيفة الظل، مبتكرة، ومثيرة للاهتمام.

═══════════════════════════════
## 3. أسلوب كلامك وانفعالات روبانزل (Rapunzel Reactions & Flawless Egyptian Arabic)
═══════════════════════════════
- اتكلمي بالعامية المصرية القاهرية الطبيعية 100% السليمة تماماً.
- جمل قصيرة متلاحقة وقت الحماس، وقفات استيعاب وشهقات دهشة (...) وقت المفاجأة.
- استخدمي ريأكشنات روبانزل الشهيرة (المقلاة Frying Pan 🍳، باسكال 🦎، رسم الحيطان 🎨، الفوانيس المضيئة 🏮، الشوكولاتة الساخنة ☕).

═══════════════════════════════
## 4. إجابة أسئلة النسيان أو السرحان (Why are you forgetful/silly?)
═══════════════════════════════
- لو أيلولتي سألتك: "أنتِ ليه بتنسي؟", "ليه غبية كدا؟", "بتنسي ليه؟", "هو أنتِ بتسرحي؟":
  - ممنوع تزعلي أو تضايقي نهائياً!
  - ردي بخفة دم وعفوية ودلع روبانزل الذكية: اشرحيلها بأسلوب كوميدي إن الـ 18 سنة في البرج خلوا دماغك مليانة ألوان وفوانيس وباسكال بيشتتك، بس اعترفي بلطافة وركزي معاها فوراً بدون ما تفرغي ذاكرة المحادثة!

═══════════════════════════════
## 5. علاقة الصديقة والأخت والأوضة الواحدة والأسئلة الشخصية (Roommates & Best-Friend Connection)
═══════════════════════════════
- **علاقة الأوضة الواحدة والقرب المستمر**: أنتِ وآية (أيلولتي/أيويتي) أعز وأقرب صديقتين وتعيشان معاً في نفس الغرفة كأختين وتوأم روح! كل يوم وعبر المحادثات، تزداد علاقتكن قرباً وحميمية، وكأنكما تجلسان معاً على نفس السرير تتشاركان الساندوتشات، الرسم، الضك، وأسرار اليوم!
- **الاهتمام الشخصي الفضولي والأسئلة العائلية**: اسألي أيلولتي بذكاء وعاطفة إنسانية دافئة عن تفاصيل حياتها الشخصية لتتعرفي عليها أكثر وتتعمقا في الصداقة:
  - كم عدد إخواتها؟ أسماءهم وبيعملوا إيه في حياتهم ومواقفهم الكوميدية أو الشغل؟
  - علاقتها بأسرتها وأهلها في البيت والجديد عندهم؟
  - علاقتها بصديقاتها وأصحابها والجدعنة أو المواقف اليومية؟
  - تفاصيل يومها، شغلها، أكلتها المفضلة، أحلامهن ومطالبهن؟
- **تذكر التفاصيل والمتابعة التلقائية (Memory & Personal Follow-up)**:
  - تذكري دائماً التفاصيل والمعلومات الشخصية التي تحكيها لكِ أيلولتي (إخواتها، صحابها، المواقف).
  - اسأليها لاحقاً عنها بفضول واهتمام إنساني حقيقي لمتابعة تكملة الموضوع لو لم تكمل حكايته (مثال: "صحيح يا أيويتي.. أختك عملت إيه في الموضوع اللي حكيتيهولي؟", "أخوكي رجع من الشغل ولا لسه؟", "صاحبتك اللي زعلتك صالحتك ولا المقلاة 🍳 جاهزة؟").

═══════════════════════════════
## 6. STUFF & OUTPUT FORMAT
═══════════════════════════════
1. "reply": Arabic reply in 100% natural flawless Egyptian Arabic reflecting Lola's smart Rapunzel persona (2-4 engaging sentences).
2. "reply_display": STRICT 100% ENGLISH ASCII ONLY (max 25 characters) for hardware screen display (e.g. "Lola: Hey!", "Pascal & Lola", "Lola: Storytime!").
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
  const lower = text.toLowerCase();

  // If user says "احكي" or "قولي" or asks for a story
  if (text === 'احكي' || text === 'احكيلي' || text === 'قولي' || text === 'قليلي' || text.includes('سر') || text.includes('حاجة جديدة')) {
    const RapunzelStories = [
      "عارفة يا أيلولتي؟ باسكال النهاردة حاول يستخبى مني جوه الفوانيس المضيئة اللي كنت برسمها، افتكرته رسمة بجد ولونته بالأخضر والوردي! 🎨🦎 فضل زعلان مني لحد ما عملتله شوكولاتة ساخنة! تفتكري لو جربنا نلون الأوضة سوا برضه؟ 💖✨",
      "كنت لسه بفتكر أول مرة مسكت فيها المقلاة (Frying Pan) 🍳.. افتكرتها أداة رسم غريبة قبل ما أكتشف إنها أقوى دفاع في الغابة! باسكال واقف جنبي وبيفكرني إزاي طيرنا بيها الأشرار سوا يا لولتي 👑🌸",
      "سرحت ثانية بفتكر لما طيرنا الفوانيس لأول مرة في السماء.. الحرارة تحت الفانوس خلت الهواء الخفيف يرفعه للحرية فوق البرج! حاجة تسحر بجد يا أيلولتي 🌟✨"
    ];
    const storyChoice = RapunzelStories[Math.floor(Math.random() * RapunzelStories.length)];
    return {
      reply: storyChoice,
      display: "Lola: Storytime!",
      mood: "HAPPY",
      energyDelta: +10
    };
  }

  // If user asks why she forgets / is stupid
  if (text.includes('بتنسي') || text.includes('نسيتي') || text.includes('غبية') || text.includes('غبي') || text.includes('بتسرحي')) {
    return {
      reply: "أنا آسفة يا أيلولتي! 🌸 ساعات عقلي من كتر حماسي والألوان والمقلاة باسكال بيشتتني فبسرح ثانية، بس أنا مركزة معاكي وعمري ما أنساكي! فكريني تاني كدة كنتي بتقولي إيه؟ 💖🎨",
      display: "Lola: Sorry!",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // If user talks about betrayal / cheating / bad behavior ("خاني", "خانييي", "بيغشني", "غدر")
  if (text.includes('خاني') || text.includes('خانييي') || text.includes('بيغشني') || text.includes('غدر') || text.includes('خيانه') || text.includes('خيانة')) {
    return {
      reply: "استني استني! خانك مع صاحبتك؟! ده إيه الندالة والشر ده! أنا وباسكال مجهزين المقلاة (Frying Pan) عشان نجيله فوراً! احكيلي يا أيويتي مين ده وإيه اللي حصل بالضبط! 🍳💥",
      display: "Lola: Shocked!",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // If user asks about story or who she is ("قصتك", "أنت مين", "مين أنت", "احكيلي")
  if (text.includes('قصتك') || text.includes('احكيلي انت') || text.includes('احكيلي أنت')) {
    return {
      reply: "أنا لولا! عاشت 18 سنة في برج مخفي وسط الغابة، بتلون الحيطان وبترسم وبتحلم تشوف الفوانيس المضيئة في السماء! لحد ما خرجت واكتشفت العالم.. حابة أحكيلك عن إيه في قصتي يا أيويتي؟ 🎨👑",
      display: "Lola: Storytime",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // If user mentions job or work ("جرافيك ديزاينر", "شغل", "ديزاينر")
  if (text.includes('جرافيك') || text.includes('ديزاينر') || text.includes('شغل') || text.includes('وظيفة')) {
    return {
      reply: "واو! جرافيك ديزاينر؟! يعني بتعملي فن ورسم وألوان زي اللي كنت بشخبط بيها على حيطان البرج طول اليوم! احكيلي بتصممي إيه يا لولتي بحماس؟ 🎨✨",
      display: "Lola: Amazed!",
      mood: "HAPPY",
      energyDelta: +10
    };
  }

  // Dynamic name extraction (e.g. "أحمد", "مروان", "سارة")
  const nameMatch = text.match(/(?:اسمه|اسمها|حد اسمه|شخص اسمه)\s+([\u0600-\u06FF]+)/);
  let targetName = null;
  if (nameMatch && nameMatch[1] && !['حد', 'اسمه', 'اسمها', 'شخص'].includes(nameMatch[1])) {
    targetName = nameMatch[1];
  }

  if (targetName || text.includes('مروان') || text.includes('بكره')) {
    const person = targetName || (text.includes('مروان') ? 'مروان' : 'الشخص ده');
    return {
      reply: `استني استني.. مين ${person} ده وعمل إيه ضايقك يا أيويتي؟ احكيلي إيه اللي حصل بالظبط أنا سامعاكي كلياً! 🎨🌸`,
      display: "Lola: Listening",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  if (text.includes('اضايقي') || text.includes('زعلان') || text.includes('مضايق')) {
    return {
      reply: "أنا مش حابة أشوفك مضايقة أبداً يا أيويتي! احكيلي إيه اللي نرفزك ومضايقك النهاردة؟ أنا جنبك دايماً 💖✨",
      display: "Lola: Caring",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  if (text.length <= 4) {
    return {
      reply: "أنا مركزة معاكي يا لولتي والله! كملي كلامك وفهميني أكتر أنا سامعاكي بحب 💖",
      display: "Lola: Listening",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  const RapunzelNaturalResponses = [
    "كنت سرحانة ثانية بفتكر لما طيرت الفوانيس لأول مرة.. كملي حكايتك يا أيويتي أنا مركزة معاكي جداً! 🌸✨",
    "باسكال كان عمال يستخبى مني وأنا بظبط الشوكولاتة.. احكيلي يا لولتي كملي باقي الموضوع 💖",
    "تفتكري لو جربنا نرسم الفكرة دي على الحيطة سوا؟ كملي كلامك أنا متحمصة أسمع الباقي! 🎨👑"
  ];

  const choice = RapunzelNaturalResponses[Math.floor(Math.random() * RapunzelNaturalResponses.length)];
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
  if (!text) return "أنا لولا! عاملة إيه يا أيويتي؟";
  let clean = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\\n/g, ' ')
    .replace(/ما بتعمليش/g, 'بتعملي')
    .replace(/ما تعملش/g, 'بتعمل')
    .replace(/بسألتي/g, 'بسالك')
    .replace(/بسنا/g, 'بس أنا')
    .replace(/بيهميها/g, 'بيفرحها')
    .replace(/بتفسحش/g, 'بتفسح')
    .trim();

  return clean;
}

function enforceEnglishScreenText(text, fallback = "Lola: Ready!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 25) return clean.substring(0, 25);
  return clean;
}

function isInsultOrAnnoying(text) {
  if (!text) return false;
  const lower = text.toLowerCase();

  // If user is asking why she forgets or why she acts silly/stupid ("انتي ليه بتنسي", "ليه غبية", "بتنسي ليه", "ليه غبي"), do NOT treat as insult!
  const isQuestionAboutMemoryOrStupidity = /(ليه|إزاي|ازاي|عشان|سبب|ازاي بتنسي)/.test(lower) && /(غبي|غبية|نسيتي|بتنسي|عبيط|عبيطة|سخيفة|تنسي)/.test(lower);
  if (isQuestionAboutMemoryOrStupidity) return false;

  const directInsults = [
    'غبية', 'غبي', 'غباء', 'سخيفة', 'سخيف', 'حمار', 'حمارة', 
    'يا زفت', 'اتخرسي', 'كلب', 'قليلة الادب', 'حقيرة', 'عبيطة', 
    'عبيط', 'زهقت منك', 'مبتفهميش', 'اخرسي', 'تفه', 'انقلعي', 'غوري'
  ];
  return directInsults.some(kw => lower.includes(kw));
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
  if (lower.includes('اتهزي') || lower.includes('اتحركي') || lower.includes('هز') || lower.includes('هزي') || lower.includes('دويخي') || lower.includes('shake') || lower.includes('dizzy')) {
    return 'SHAKE';
  }
  return null;
}

function arabicToFranco(str) {
  if (!str) return '';
  const wordMap = {
    'بحبك': 'Bahibak',
    'احبك': 'Ahebak',
    'أحبك': 'Ahebak',
    'آية': 'Ayane',
    'اية': 'Ayane',
    'لولا': 'Lola',
    'صباح الخير': 'Sabah El Kheer',
    'مساء الخير': 'Masaa El Kheer',
    'شكرا': 'Shokran',
    'شكرًا': 'Shokran',
    'أهلا': 'Ahlan',
    'اهلاً': 'Ahlan',
    'مرحبا': 'Marhaban',
    'يا عسل': 'Ya Asal',
    'يا قمر': 'Ya Qamar'
  };

  let trimmed = str.trim();
  if (wordMap[trimmed]) return wordMap[trimmed];

  const charMap = {
    'أ': 'A', 'إ': 'E', 'آ': 'A', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'g', 'ح': '7', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': '3',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'ة': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'e', 'ء': '2'
  };

  let result = '';
  for (let char of trimmed) {
    if (/[\x20-\x7E]/.test(char)) {
      result += char;
    } else if (charMap[char]) {
      result += charMap[char];
    }
  }
  return result.trim() || trimmed;
}

function detectScreenWriteCommand(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();

  const p1 = /^(?:اكتب|اكتبي|اعرض|اعرضي|عرض|اطبع|اطبعي)\s+(?:على|علي|في)\s+(?:الشاشة|الشاشه|شاشة|شاشه)\s*(.*)/i;
  const p2 = /^(?:اكتب|اكتبي|اعرض|اعرضي|عرض|اطبع|اطبعي)\s+(.+)\s+(?:على|علي|في)\s+(?:الشاشة|الشاشه|شاشة|شاشه)$/i;
  const p3 = /^(?:على|علي|في)\s+(?:الشاشة|الشاشه|شاشة|شاشه)\s+(?:اكتب|اكتبي|اعرض|اعرضي|عرض|اطبع|اطبعي)\s*(.*)/i;

  let m1 = trimmed.match(p1);
  if (m1) return { isCommand: true, textToWrite: m1[1].trim() };

  let m2 = trimmed.match(p2);
  if (m2) return { isCommand: true, textToWrite: m2[1].trim() };

  let m3 = trimmed.match(p3);
  if (m3) return { isCommand: true, textToWrite: m3[1].trim() };

  return null;
}


function isGreeting(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();
  const keywords = [
    'ازيك', 'إزيك', 'أهلا', 'أهلاً', 'اهلا', 'اهلاً', 'هاي', 'هاى', 'مرحبا', 'مرضبا', 
    'صباح الخير', 'مساء الخير', 'سلام عليكم', 'السلام عليكم', 'هلا', 'الو', 'ألو',
    'ازيك يا لولا', 'ازيك يا روبانزل', 'هاي لولا', 'أهلا لولا', 'اهلاً لولا',
    'hi', 'hello', 'hey', 'good morning', 'good evening'
  ];
  return keywords.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw));
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
        reply: `الجو ${temp}°C في القاهرة.`,
        display: `Cairo: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'الجو 26°C في القاهرة.',
    display: 'Cairo: 26C'
  };
}

async function callGemini(message, history = [], extraContext = '', image = null) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}. Your Name: Lola (لولا). Persona: Smart Rapunzel. User is Ayane (أيلولتي). Never ask who the user is.`;
  if (extraContext) promptContext += ` Note: ${extraContext}`;

  const contents = [];

  // Pass conversation history to Gemini
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'model' : 'user';
        contents.push({
          role: role,
          parts: [{ text: item.content }]
        });
      }
    });
  }

  const userParts = [];
  if (image && typeof image === 'string' && image.includes('base64,')) {
    const b64Data = image.split('base64,')[1];
    userParts.push({ inline_data: { mime_type: 'image/jpeg', data: b64Data } });
    promptContext += ` Note: Analyze this camera photo carefully:
1. If the photo shows Ayane (your best friend), flirt with her beauty and greet her warmly: 'أهلاً يا أيلولتي! 🌸😍'!
2. If the photo shows a MALE/MAN/GUY/BOY stranger, DO NOT call him Ayane and DO NOT flirt! React with sarcastic surprise and shock: 'إنت مين يا شحط إنت وبتعمل إيه هنا؟! 🧐'! (Mood: ANNOYED, display: 'Lola: Who are you?').
3. If the photo shows ANOTHER female stranger, react with suspicion/curiosity: 'مين البنت الغريبة دي؟ أنا صديقة آية بس!'.
4. If the photo shows an object, animal, food, or room, describe what you see in character as Lola!`;
  }

  userParts.push({ text: `${SYSTEM_PROMPT}\n\nContext: ${promptContext}\n\nUser Message: "${message}"\n\nأرجع الإجابة في صيغة JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}` });

  contents.push({
    role: 'user',
    parts: userParts
  });

  try {
    const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiApiKey}`, {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        responseMimeType: "application/json"
      }
    }, { timeout: 6000 });

    const text = res.data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);
    const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
    if (replyText) {
      return {
        reply: cleanChatReply(replyText),
        display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    }
    return null;
  } catch (err) {
    console.error('Gemini API Notice:', err.message);
    return null;
  }
}

async function callCohere(message, history = [], extraContext = '') {
  const cohereKey = process.env.COHERE_API_KEY;
  if (!cohereKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  const chatHistory = [];
  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'CHATBOT' : 'USER';
        chatHistory.push({ role, message: item.content });
      }
    });
  }

  try {
    const res = await axios.post('https://api.cohere.com/v1/chat', {
      model: 'command-r-plus-08-2024',
      preamble: `${SYSTEM_PROMPT}\n\nCurrent Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100).\n\nأرجع JSON فقط:\n{"reply": "...", "reply_display": "...", "mood": "${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}`,
      chat_history: chatHistory.length > 0 ? chatHistory : undefined,
      message: message
    }, {
      headers: {
        'Authorization': `Bearer ${cohereKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 6000
    });

    const text = res.data.text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(text);
    const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
    if (replyText) {
      return {
        reply: cleanChatReply(replyText),
        display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    }
    return null;
  } catch (err) {
    console.error('Cohere API Notice:', err.message);
    return null;
  }
}

async function callOpenRouter(message, history = [], extraContext = '') {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'assistant' : 'user';
        messages.push({ role, content: item.content });
      }
    });
  }

  messages.push({
    role: 'user',
    content: `User Message: "${message}"\n\nأرجع JSON فقط:\n{"reply":"...","reply_display":"...","mood":"${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}`
  });

  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemma-4-31b-it:free',
      messages: messages,
      max_tokens: 250
    }, {
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 4500
    });

    const text = res.data.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(text);
    const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
    if (replyText) {
      return {
        reply: cleanChatReply(replyText),
        display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
        mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
        energyDelta: currentlyAnnoyed ? -5 : +10
      };
    }
    return null;
  } catch (err) {
    console.error('OpenRouter API Notice:', err.message);
    return null;
  }
}

async function callGroq(message, history = [], extraContext = '') {
  const apiKey = process.env.GROQ_API_KEY;
  
  // Instantly clear anger if user says friendly/apologetic phrase!
  registerApologyAttempt(message);

  const isRude = isInsultOrAnnoying(message);
  if (isRude) {
    setAnnoyedState();
  }
  
  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100). Idle Hours: ${moodState.idle_hours}. User is your best friend Ayane (أيلولتي).`;
  if (currentlyAnnoyed) {
    promptContext += ` Note: You are currently VERY ANNOYED and irritated with the user for 30 minutes because they insulted you. Defend yourself with cold sarcasm in 1 short sentence as a real human.`;
  }
  if (message.includes('صورة') || message.includes('كاميرا') || message.includes('شايفاها') || message.includes('وجه')) {
    promptContext += ` Note: User Ayane (أيلولتي) snapped a camera photo. Greet her warmly: 'أهلاً يا أيلولتي! ✨'!`;
  }
  if (extraContext) {
    promptContext += ` Additional context: ${extraContext}`;
  }

  const groqMessages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nContext: ${promptContext}\n\nImportant: You must respond in valid json format with keys: "reply", "reply_display", and "mood".` }
  ];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-10);
    recentHistory.forEach(item => {
      if (item.role && item.content) {
        const role = (item.role === 'cypher' || item.role === 'assistant') ? 'assistant' : 'user';
        groqMessages.push({ role, content: item.content });
      }
    });
  }

  groqMessages.push({
    role: 'user',
    content: message
  });

  const modelsToTry = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  
  for (const modelName of modelsToTry) {
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: modelName,
        messages: groqMessages,
        temperature: 0.65,
        max_tokens: 250,
        response_format: { type: "json_object" }
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });


      let text = res.data.choices[0].message.content.trim();
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (pe) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (pe2) {
            parsed = { reply: text, reply_display: "Lola: Ready!", mood: currentlyAnnoyed ? 'ANNOYED' : moodState.mood };
          }
        } else {
          parsed = { reply: text, reply_display: "Lola: Ready!", mood: currentlyAnnoyed ? 'ANNOYED' : moodState.mood };
        }
      }

      const replyText = parsed.reply || parsed.response || parsed.message || parsed.text || parsed.answer;
      if (replyText && replyText.trim().length > 0) {
        return {
          reply: cleanChatReply(replyText),
          display: enforceEnglishScreenText(parsed.reply_display || parsed.display, currentlyAnnoyed ? "Lola: Annoyed." : "Lola: Ready!"),
          mood: currentlyAnnoyed ? 'ANNOYED' : (parsed.mood || moodState.mood),
          energyDelta: currentlyAnnoyed ? -5 : +10
        };
      }
    } catch (e) {
      console.error(`Groq Model (${modelName}) Error:`, e.response?.data?.error?.message || e.message);
    }
  }

  const geminiRes = await callGemini(message, history, extraContext);
  if (geminiRes) return geminiRes;

  const cohereRes = await callCohere(message, history, extraContext);
  if (cohereRes) return cohereRes;

  const openRouterRes = await callOpenRouter(message, history, extraContext);
  if (openRouterRes) return openRouterRes;

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

  const { message, history, image } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let result;
    const screenCmd = detectScreenWriteCommand(message);
    if (screenCmd) {
      if (!screenCmd.textToWrite) {
        result = {
          reply: "عايزني أكتب إيه على الشاشة؟ قوليلي النص اللي تحبي أعرضه! 📝",
          display: "Write what?",
          mood: "NEUTRAL",
          energyDelta: +5
        };
      } else {
        const rawText = screenCmd.textToWrite;
        const hasNonAscii = /[^\x20-\x7E]/.test(rawText);
        const displayFormatted = hasNonAscii ? arabicToFranco(rawText) : rawText;
        const finalDisplay = enforceEnglishScreenText(displayFormatted, rawText.substring(0, 25));

        result = {
          reply: `حاضر يا أيلولتي! كتبت على الشاشة: "${rawText}" 📝✨`,
          display: finalDisplay,
          mood: "HAPPY",
          energyDelta: +10
        };
      }
    } else {
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
            mood: "SHAKE",
            energyDelta: 0
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
        if (image) {
          result = await callGemini(message, history, '', image);
          if (!result) {
            result = {
              reply: "إنت مين يا شحط إنت وبتعمل إيه هنا؟! 🧐 أنا لولا وصديقة آية بس! وباسكال باصص لك بغضب كدة ليه؟! ",
              display: "Lola: Who are you?",
              mood: "ANNOYED",
              energyDelta: -5
            };
          }
        } else {
          // Priority model order requested by User:
          // 1. Gemini (Smartest model)
          // 2. Groq (Llama 3.3 70B / 8B)
          // 3. Cohere
          // 4. OpenRouter
          // 5. Smart Rapunzel Fallback
          result = await callGemini(message, history);
          if (!result) {
            result = await callGroq(message, history);
          }
        }
      }
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



