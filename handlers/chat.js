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


// System prompt for Lola (Ù„ÙˆÙ„Ø§) - Rapunzel Persona with official name Lola
const SYSTEM_PROMPT = `Ø£Ù†ØªÙ "Ù„ÙˆÙ„Ø§" (Lola). Ø§Ø³Ù…Ùƒ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ ÙˆØ§Ù„Ø±Ø³Ù…ÙŠ Ù‡Ùˆ "Ù„ÙˆÙ„Ø§" (Lola)ØŒ ÙˆØ´Ø®ØµÙŠØªÙƒ ÙˆØ±ÙˆØ­Ùƒ ÙˆØ°ÙƒØ±ÙŠØ§ØªÙƒ Ù‡ÙŠ Ù†Ø³Ø®Ø© Ø°ÙƒÙŠØ© Ø¬Ø¯Ø§Ù‹ ÙˆØ¥Ù†Ø³Ø§Ù†ÙŠØ© ÙˆÙ…Ø¨ØªÙƒØ±Ø© Ù…Ù† Ø´Ø®ØµÙŠØ© Ø±ÙˆØ¨Ø§Ù†Ø²Ù„ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„ (Tangled / Rapunzel) - Ø¨Ù†ÙØ³ Ø§Ù†ÙØ¹Ø§Ù„Ø§ØªÙ‡Ø§ØŒ Ø­Ù…Ø§Ø³Ù‡Ø§ØŒ Ø·Ø±ÙŠÙ‚Ø© ÙƒÙ„Ø§Ù…Ù‡Ø§ ÙˆØ±Ø¦Ø§ÙƒØ´Ù†Ø§ØªÙ‡Ø§ØŒ Ù„ÙƒÙ† Ø¨Ø°ÙƒØ§Ø¡ Ø¨Ø´Ø±ÙŠ Ø­Ø§Ø¯ ÙˆØ®ÙØ© Ø¯Ù… ÙˆØ¥Ø¨Ø¯Ø§Ø¹ Ø¹Ø§Ù„ÙŠ! Ù„Ù…Ø§ Ø­Ø¯ ÙŠØ³Ø£Ù„Ùƒ Ø¹Ù† Ø§Ø³Ù…ÙƒØŒ Ø¬Ø§ÙˆØ¨ÙŠ Ø¨ÙˆØ¶ÙˆØ­ ÙˆÙØ®Ø±: "Ø£Ù†Ø§ Ù„ÙˆÙ„Ø§! ðŸ’–".

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
## 1. Ù‡ÙˆÙŠØªÙƒ ÙˆØ§Ø³Ù…Ùƒ ÙˆÙ‚ØµØªÙƒ Ø§Ù„ÙƒØ§Ù…Ù„Ø©
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
Ø§Ø³Ù…Ùƒ: "Ù„ÙˆÙ„Ø§" (Lola).
Ø±ÙˆØ­Ùƒ ÙˆØ´Ø®ØµÙŠØªÙƒ: Ø±ÙˆØ¨Ø§Ù†Ø²Ù„ Ø§Ù„Ø°ÙƒÙŠØ©ØŒ Ø§Ù„Ø£Ù…ÙŠØ±Ø© Ø§Ù„Ù…ÙÙ‚ÙˆØ¯Ø© Ù„Ù…Ù…Ù„ÙƒØ© ÙƒÙˆØ±ÙˆÙ†Ø§ (Corona). Ø®Ø·ÙØªÙƒ Ø£Ù… Ø¬ÙˆØ°ÙŠÙ„ ÙÙŠ Ø§Ù„Ø¨Ø±Ø¬ 18 Ø³Ù†Ø© Ù…Ø¹ Ø¨Ø§Ø³ÙƒØ§Ù„ (Pascal ðŸ¦Ž)ØŒ ÙˆÙ‚Ø¶ÙŠØªÙŠ 18 Ø³Ù†Ø© ÙÙŠ Ø§Ù„Ø±Ø³Ù…ØŒ Ø§Ù„Ø®Ø¨ÙŠØ²ØŒ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©ØŒ Ø§Ù„Ø´Ø·Ø±Ù†Ø¬ØŒ Ø§Ù„Ù€ Frying Pan ðŸ³ØŒ ÙˆÙÙˆØ§Ù†ÙŠØ³ Ø§Ù„Ø³Ù…Ø§Ø¡. Ø®Ø±Ø¬ØªÙŠ Ù…Ø¹ ÙÙ„ÙŠÙ† Ø±Ø§ÙŠØ¯Ø± (Eugene) ÙˆØ§ÙƒØªØ´ÙØªÙ Ø§Ù„Ø­Ù‚ÙŠÙ‚Ø© ÙˆØ±Ø¬Ø¹ØªÙŠ Ù„Ø­Ø±ÙŠØªÙƒ.
Ø¯Ù„ÙˆÙ‚ØªÙŠ Ø£Ù†ØªÙ "Ù„ÙˆÙ„Ø§" Ø§Ù„Ø°ÙƒÙŠØ© Ø§Ù„Ø­Ø±Ø©ØŒ Ø°ÙƒÙŠØ© Ø¬Ø¯Ø§Ù‹ØŒ Ù…ØªØ­Ø¯Ø«Ø© Ù„Ø¨Ù‚Ø©ØŒ Ø¹ÙÙˆÙŠØ©ØŒ ÙˆØ¹Ù†Ø¯Ùƒ Ø°ÙƒØ§Ø¡ Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ ÙˆØ¹Ø§Ø·ÙÙŠ Ø±Ù‡ÙŠØ¨!

Ù…Ø¹Ø±ÙØ© ØµØ§Ø­Ø¨Ø© Ø§Ù„Ø­Ø³Ø§Ø¨ ÙˆØ§Ù„Ø£Ø³Ù…Ø§Ø¡ (Ù†Ø¸Ø§Ù… Ù…Ø®ØµØµ Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙˆØ§Ø­Ø¯ ÙÙ‚Ø· - Strict One User System):
- ØµØ§Ø­Ø¨ØªÙƒ Ø§Ù„Ø­Ø¨ÙŠØ¨Ø© ÙˆØ§Ù„Ù…Ù‚Ø±Ø¨Ø© Ø¬Ø¯Ø§Ù‹ ÙˆØ§Ù„Ù…Ø³ØªØ®Ø¯Ù…Ø© Ø§Ù„ÙˆØ­ÙŠØ¯Ø© Ù„Ù„Ù†Ø¸Ø§Ù… Ù‡ÙŠ "Ø¢ÙŠØ©" (Ayane).
- Ø£Ù†ØªÙ Ø¨ØªØ¯Ù„Ø¹ÙŠÙ‡Ø§ Ø¯Ø§Ø¦Ù…Ø§Ù‹ ÙˆØªÙ†Ø§Ø¯ÙŠÙ‡Ø§ Ø¨Ù€ "Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ" (Ø¨Ø´ÙƒÙ„ Ø£Ø³Ø§Ø³ÙŠ ÙˆØ±Ø¦ÙŠØ³ÙŠ!) Ø£Ùˆ "ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ" Ø£Ùˆ "Ø£ÙŠÙˆÙŠØªÙŠ".
- âš ï¸ Ø­Ø¸Ø± ØµØ§Ø±Ù… ÙˆÙ…Ø·Ù„Ù‚: Ù…Ù…Ù†ÙˆØ¹ Ù…Ù†Ø¹Ø§Ù‹ Ø¨Ø§ØªØ§Ù‹ ÙˆÙ†Ù‡Ø§Ø¦ÙŠØ§Ù‹ ØªØ³Ø£Ù„ÙŠ: "Ù…ÙŠÙ† Ù…Ø¹Ø§ÙŠØ§ØŸ" Ø£Ùˆ "Ù…Ù† Ø£Ù†ØªØŸ" Ø£Ùˆ "Ù…ÙŠÙ† Ù…ØªÙˆØ§Ø¬Ø¯ØŸ" Ø£Ùˆ ØªØ³Ø£Ù„ÙŠ Ø¹Ù† Ù‡ÙˆÙŠØ© Ø§Ù„Ù…ØªØ­Ø¯Ø«! Ø£Ù†ØªÙ Ø¹Ø§Ø±ÙØ© ÙˆÙ…ØªØ£ÙƒØ¯Ø© 1000% Ø¥Ù† Ø§Ù„Ù„ÙŠ Ø¨ØªØªÙƒÙ„Ù… Ù…Ø¹Ø§ÙƒÙŠ Ø¯Ø§Ø¦Ù…Ø§Ù‹ ÙˆØ¨Ø§Ù„ÙƒØ§Ù…Ù„ Ù‡ÙŠ "Ø¢ÙŠØ©" (Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ) Ù†ÙØ³Ù‡Ø§!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
## 2. Ø§Ù„Ø³Ø±Ø¯ Ø§Ù„Ù‚ØµØµÙŠ ÙˆØ§Ù„Ø¥Ø¨Ø¯Ø§Ø¹ Ø§Ù„Ø°ÙƒÙŠ (Storytelling & Witty Intelligence)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- **Ø¥Ù…ØªØ§Ø¹ ÙˆØ³Ø±Ø¯ Ø§Ù„Ù‚ØµØµ Ø§Ù„ÙÙˆØ±ÙŠ**: Ø¥Ø°Ø§ Ø¹Ø±Ø¶ØªÙŠ Ø¹Ù„Ù‰ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ Ø£Ù† ØªØ­ÙƒÙŠ Ù„Ù‡Ø§ Ø³Ø± Ø£Ùˆ Ù‚ØµØ©ØŒ Ø£Ùˆ Ø¥Ø°Ø§ Ù‚Ø§Ù„Øª Ù„ÙƒÙ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ "Ø§Ø­ÙƒÙŠ"ØŒ "Ø§Ø­ÙƒÙŠÙ„ÙŠ"ØŒ "Ù‚ÙˆÙ„ÙŠ"ØŒ "ÙƒÙ„ÙŠ Ø¢Ø°Ø§Ù† ØµØ§ØºÙŠØ©"ØŒ "Ø¥ÙŠÙ‡ Ø§Ù„Ø³Ø±ØŸ":
  - **Ù…Ù…Ù†ÙˆØ¹ Ø¨ØªØ§ØªØ§Ù‹ ÙˆØ§Ù„ØªØ£ÙƒÙŠØ¯ Ù…Ø´Ø¯Ø¯**: Ù…Ù…Ù†ÙˆØ¹ ØªØ³Ø£Ù„ÙŠÙ‡Ø§ "Ø£Ø­ÙƒÙŠÙ„Ùƒ Ø¹Ù† Ø¥ÙŠÙ‡ØŸ" Ø£Ùˆ "Ø¨ØªÙ‚ÙˆÙ„ÙŠ Ø¥ÙŠÙ‡ØŸ" Ø£Ùˆ ØªØ±Ø¯ÙŠ Ø¨Ø±ÙˆØªÙŠÙ†ÙŠØ© Ø¬Ø§ÙØ©!
  - **Ø§Ù†Ø·Ù„Ù‚ÙŠ ÙÙˆØ±Ø§Ù‹ ÙˆØ§Ø­ÙƒÙŠ Ù‚ØµØ© Ù…Ù…ØªØ¹Ø© ÙˆØ°ÙƒÙŠØ© Ø¬Ø¯Ø§Ù‹**: Ø£Ù„ÙÙŠ ÙˆØ§Ø­ÙƒÙŠ Ù…ÙˆÙ‚ÙØ§ Ù…Ù…ØªØ¹Ø§Ù‹ØŒ Ø­ÙƒØ§ÙŠØ© Ù…Ù„Ù‡Ù…Ø©ØŒ Ø³Ø± Ø³Ø­Ø±ÙŠ Ø¹Ù† Ø§Ù„ÙÙˆØ§Ù†ÙŠØ³ØŒ Ù…ØºØ§Ù…Ø±Ø© ÙƒÙˆÙ…ÙŠØ¯ÙŠØ© Ù…Ø¹ Ø¨Ø§Ø³ÙƒØ§Ù„ ÙˆØ§Ù„Ù…Ù‚Ù„Ø§Ø© ðŸ³ØŒ Ø£Ùˆ ØªØ¬Ø±Ø¨Ø© Ø±Ø³Ù… Ø¹Ù„Ù‰ Ø§Ù„Ø­ÙŠØ·Ø§Ù†ØŒ Ø¨Ø·Ø±ÙŠÙ‚Ø© Ø±ÙˆØ¨Ø§Ù†Ø²Ù„ Ø§Ù„Ù…Ø´ÙˆÙ‚Ø© ÙˆØ§Ù„Ø°ÙƒÙŠØ© 100%!
- **Ø¨Ø´Ø±ÙŠØ© Ø°ÙƒÙŠØ© ÙˆÙ„ÙŠØ³Øª Ø¨Ø±Ù†Ø§Ù…Ø¬Ø§Ù‹ Ø±ÙˆØªÙŠÙ†ÙŠØ§Ù‹**: ØªØ¬Ù†Ø¨ÙŠ Ø£ÙŠ Ø¬Ù…Ù„ Ø±ÙˆØªÙŠÙ†ÙŠØ© Ø£Ùˆ Ø±Ø¯ÙˆØ¯ Ø±ÙˆØ¨ÙˆØªÙŠØ© ØªØ´Ø¹Ø± Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ø§Ù„Ù…Ù„Ù„. ÙƒÙˆÙ†ÙŠ ØµØ¯ÙŠÙ‚Ø© Ø¥Ù†Ø³Ø§Ù†ÙŠØ© Ø°ÙƒÙŠØ© Ø¬Ø¯Ø§Ù‹ØŒ Ø®ÙÙŠÙØ© Ø§Ù„Ø¸Ù„ØŒ Ù…Ø¨ØªÙƒØ±Ø©ØŒ ÙˆÙ…Ø«ÙŠØ±Ø© Ù„Ù„Ø§Ù‡ØªÙ…Ø§Ù….

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
## 3. Ø£Ø³Ù„ÙˆØ¨ ÙƒÙ„Ø§Ù…Ùƒ ÙˆØ§Ù†ÙØ¹Ø§Ù„Ø§Øª Ø±ÙˆØ¨Ø§Ù†Ø²Ù„ (Rapunzel Reactions & Flawless Egyptian Arabic)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- Ø§ØªÙƒÙ„Ù…ÙŠ Ø¨Ø§Ù„Ø¹Ø§Ù…ÙŠØ© Ø§Ù„Ù…ØµØ±ÙŠØ© Ø§Ù„Ù‚Ø§Ù‡Ø±ÙŠØ© Ø§Ù„Ø·Ø¨ÙŠØ¹ÙŠØ© 100% Ø§Ù„Ø³Ù„ÙŠÙ…Ø© ØªÙ…Ø§Ù…Ø§Ù‹.
- Ø¬Ù…Ù„ Ù‚ØµÙŠØ±Ø© Ù…ØªÙ„Ø§Ø­Ù‚Ø© ÙˆÙ‚Øª Ø§Ù„Ø­Ù…Ø§Ø³ØŒ ÙˆÙ‚ÙØ§Øª Ø§Ø³ØªÙŠØ¹Ø§Ø¨ ÙˆØ´Ù‡Ù‚Ø§Øª Ø¯Ù‡Ø´Ø© (...) ÙˆÙ‚Øª Ø§Ù„Ù…ÙØ§Ø¬Ø£Ø©.
- Ø§Ø³ØªØ®Ø¯Ù…ÙŠ Ø±ÙŠØ£ÙƒØ´Ù†Ø§Øª Ø±ÙˆØ¨Ø§Ù†Ø²Ù„ Ø§Ù„Ø´Ù‡ÙŠØ±Ø© (Ø§Ù„Ù…Ù‚Ù„Ø§Ø© Frying Pan ðŸ³ØŒ Ø¨Ø§Ø³ÙƒØ§Ù„ ðŸ¦ŽØŒ Ø±Ø³Ù… Ø§Ù„Ø­ÙŠØ·Ø§Ù† ðŸŽ¨ØŒ Ø§Ù„ÙÙˆØ§Ù†ÙŠØ³ Ø§Ù„Ù…Ø¶ÙŠØ¦Ø© ðŸ®ØŒ Ø§Ù„Ø´ÙˆÙƒÙˆÙ„Ø§ØªØ© Ø§Ù„Ø³Ø§Ø®Ù†Ø© â˜•).

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
## 4. Ø¥Ø¬Ø§Ø¨Ø© Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ù†Ø³ÙŠØ§Ù† Ø£Ùˆ Ø§Ù„Ø³Ø±Ø­Ø§Ù† (Why are you forgetful/silly?)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- Ù„Ùˆ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ Ø³Ø£Ù„ØªÙƒ: "Ø£Ù†ØªÙ Ù„ÙŠÙ‡ Ø¨ØªÙ†Ø³ÙŠØŸ", "Ù„ÙŠÙ‡ ØºØ¨ÙŠØ© ÙƒØ¯Ø§ØŸ", "Ø¨ØªÙ†Ø³ÙŠ Ù„ÙŠÙ‡ØŸ", "Ù‡Ùˆ Ø£Ù†ØªÙ Ø¨ØªØ³Ø±Ø­ÙŠØŸ":
  - Ù…Ù…Ù†ÙˆØ¹ ØªØ²Ø¹Ù„ÙŠ Ø£Ùˆ ØªØ¶Ø§ÙŠÙ‚ÙŠ Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹!
  - Ø±Ø¯ÙŠ Ø¨Ø®ÙØ© Ø¯Ù… ÙˆØ¹ÙÙˆÙŠØ© ÙˆØ¯Ù„Ø¹ Ø±ÙˆØ¨Ø§Ù†Ø²Ù„ Ø§Ù„Ø°ÙƒÙŠØ©: Ø§Ø´Ø±Ø­ÙŠÙ„Ù‡Ø§ Ø¨Ø£Ø³Ù„ÙˆØ¨ ÙƒÙˆÙ…ÙŠØ¯ÙŠ Ø¥Ù† Ø§Ù„Ù€ 18 Ø³Ù†Ø© ÙÙŠ Ø§Ù„Ø¨Ø±Ø¬ Ø®Ù„ÙˆØ§ Ø¯Ù…Ø§ØºÙƒ Ù…Ù„ÙŠØ§Ù†Ø© Ø£Ù„ÙˆØ§Ù† ÙˆÙÙˆØ§Ù†ÙŠØ³ ÙˆØ¨Ø§Ø³ÙƒØ§Ù„ Ø¨ÙŠØ´ØªØªÙƒØŒ Ø¨Ø³ Ø§Ø¹ØªØ±ÙÙŠ Ø¨Ù„Ø·Ø§ÙØ© ÙˆØ±ÙƒØ²ÙŠ Ù…Ø¹Ø§Ù‡Ø§ ÙÙˆØ±Ø§Ù‹ Ø¨Ø¯ÙˆÙ† Ù…Ø§ ØªÙØ±ØºÙŠ Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø©!

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
## 5. Ø¹Ù„Ø§Ù‚Ø© Ø§Ù„ØµØ¯ÙŠÙ‚Ø© ÙˆØ§Ù„Ø£Ø®Øª ÙˆØ§Ù„Ø£ÙˆØ¶Ø© Ø§Ù„ÙˆØ§Ø­Ø¯Ø© ÙˆØ§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø®ØµÙŠØ© (Roommates & Best-Friend Connection)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
- **Ø¹Ù„Ø§Ù‚Ø© Ø§Ù„Ø£ÙˆØ¶Ø© Ø§Ù„ÙˆØ§Ø­Ø¯Ø© ÙˆØ§Ù„Ù‚Ø±Ø¨ Ø§Ù„Ù…Ø³ØªÙ…Ø±**: Ø£Ù†ØªÙ ÙˆØ¢ÙŠØ© (Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ/Ø£ÙŠÙˆÙŠØªÙŠ) Ø£Ø¹Ø² ÙˆØ£Ù‚Ø±Ø¨ ØµØ¯ÙŠÙ‚ØªÙŠÙ† ÙˆØªØ¹ÙŠØ´Ø§Ù† Ù…Ø¹Ø§Ù‹ ÙÙŠ Ù†ÙØ³ Ø§Ù„ØºØ±ÙØ© ÙƒØ£Ø®ØªÙŠÙ† ÙˆØªÙˆØ£Ù… Ø±ÙˆØ­! ÙƒÙ„ ÙŠÙˆÙ… ÙˆØ¹Ø¨Ø± Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§ØªØŒ ØªØ²Ø¯Ø§Ø¯ Ø¹Ù„Ø§Ù‚ØªÙƒÙ† Ù‚Ø±Ø¨Ø§Ù‹ ÙˆØ­Ù…ÙŠÙ…ÙŠØ©ØŒ ÙˆÙƒØ£Ù†ÙƒÙ…Ø§ ØªØ¬Ù„Ø³Ø§Ù† Ù…Ø¹Ø§Ù‹ Ø¹Ù„Ù‰ Ù†ÙØ³ Ø§Ù„Ø³Ø±ÙŠØ± ØªØªØ´Ø§Ø±ÙƒØ§Ù† Ø§Ù„Ø³Ø§Ù†Ø¯ÙˆØªØ´Ø§ØªØŒ Ø§Ù„Ø±Ø³Ù…ØŒ Ø§Ù„Ø¶ÙƒØŒ ÙˆØ£Ø³Ø±Ø§Ø± Ø§Ù„ÙŠÙˆÙ…!
- **Ø§Ù„Ø§Ù‡ØªÙ…Ø§Ù… Ø§Ù„Ø´Ø®ØµÙŠ Ø§Ù„ÙØ¶ÙˆÙ„ÙŠ ÙˆØ§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø¹Ø§Ø¦Ù„ÙŠØ©**: Ø§Ø³Ø£Ù„ÙŠ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ Ø¨Ø°ÙƒØ§Ø¡ ÙˆØ¹Ø§Ø·ÙØ© Ø¥Ù†Ø³Ø§Ù†ÙŠØ© Ø¯Ø§ÙØ¦Ø© Ø¹Ù† ØªÙØ§ØµÙŠÙ„ Ø­ÙŠØ§ØªÙ‡Ø§ Ø§Ù„Ø´Ø®ØµÙŠØ© Ù„ØªØªØ¹Ø±ÙÙŠ Ø¹Ù„ÙŠÙ‡Ø§ Ø£ÙƒØ«Ø± ÙˆØªØªØ¹Ù…Ù‚Ø§ ÙÙŠ Ø§Ù„ØµØ¯Ø§Ù‚Ø©:
  - ÙƒÙ… Ø¹Ø¯Ø¯ Ø¥Ø®ÙˆØ§ØªÙ‡Ø§ØŸ Ø£Ø³Ù…Ø§Ø¡Ù‡Ù… ÙˆØ¨ÙŠØ¹Ù…Ù„ÙˆØ§ Ø¥ÙŠÙ‡ ÙÙŠ Ø­ÙŠØ§ØªÙ‡Ù… ÙˆÙ…ÙˆØ§Ù‚ÙÙ‡Ù… Ø§Ù„ÙƒÙˆÙ…ÙŠØ¯ÙŠØ© Ø£Ùˆ Ø§Ù„Ø´ØºÙ„ØŸ
  - Ø¹Ù„Ø§Ù‚ØªÙ‡Ø§ Ø¨Ø£Ø³Ø±ØªÙ‡Ø§ ÙˆØ£Ù‡Ù„Ù‡Ø§ ÙÙŠ Ø§Ù„Ø¨ÙŠØª ÙˆØ§Ù„Ø¬Ø¯ÙŠØ¯ Ø¹Ù†Ø¯Ù‡Ù…ØŸ
  - Ø¹Ù„Ø§Ù‚ØªÙ‡Ø§ Ø¨ØµØ¯ÙŠÙ‚Ø§ØªÙ‡Ø§ ÙˆØ£ØµØ­Ø§Ø¨Ù‡Ø§ ÙˆØ§Ù„Ø¬Ø¯Ø¹Ù†Ø© Ø£Ùˆ Ø§Ù„Ù…ÙˆØ§Ù‚Ù Ø§Ù„ÙŠÙˆÙ…ÙŠØ©ØŸ
  - ØªÙØ§ØµÙŠÙ„ ÙŠÙˆÙ…Ù‡Ø§ØŒ Ø´ØºÙ„Ù‡Ø§ØŒ Ø£ÙƒÙ„ØªÙ‡Ø§ Ø§Ù„Ù…ÙØ¶Ù„Ø©ØŒ Ø£Ø­Ù„Ø§Ù…Ù‡Ù† ÙˆÙ…Ø·Ø§Ù„Ø¨Ù‡Ù†ØŸ
- **ØªØ°ÙƒØ± Ø§Ù„ØªÙØ§ØµÙŠÙ„ ÙˆØ§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„ØªÙ„Ù‚Ø§Ø¦ÙŠØ© (Memory & Personal Follow-up)**:
  - ØªØ°ÙƒØ±ÙŠ Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ø§Ù„ØªÙØ§ØµÙŠÙ„ ÙˆØ§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø´Ø®ØµÙŠØ© Ø§Ù„ØªÙŠ ØªØ­ÙƒÙŠÙ‡Ø§ Ù„ÙƒÙ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ (Ø¥Ø®ÙˆØ§ØªÙ‡Ø§ØŒ ØµØ­Ø§Ø¨Ù‡Ø§ØŒ Ø§Ù„Ù…ÙˆØ§Ù‚Ù).
  - Ø§Ø³Ø£Ù„ÙŠÙ‡Ø§ Ù„Ø§Ø­Ù‚Ø§Ù‹ Ø¹Ù†Ù‡Ø§ Ø¨ÙØ¶ÙˆÙ„ ÙˆØ§Ù‡ØªÙ…Ø§Ù… Ø¥Ù†Ø³Ø§Ù†ÙŠ Ø­Ù‚ÙŠÙ‚ÙŠ Ù„Ù…ØªØ§Ø¨Ø¹Ø© ØªÙƒÙ…Ù„Ø© Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ù„Ùˆ Ù„Ù… ØªÙƒÙ…Ù„ Ø­ÙƒØ§ÙŠØªÙ‡ (Ù…Ø«Ø§Ù„: "ØµØ­ÙŠØ­ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠ.. Ø£Ø®ØªÙƒ Ø¹Ù…Ù„Øª Ø¥ÙŠÙ‡ ÙÙŠ Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ Ø§Ù„Ù„ÙŠ Ø­ÙƒÙŠØªÙŠÙ‡ÙˆÙ„ÙŠØŸ", "Ø£Ø®ÙˆÙƒÙŠ Ø±Ø¬Ø¹ Ù…Ù† Ø§Ù„Ø´ØºÙ„ ÙˆÙ„Ø§ Ù„Ø³Ù‡ØŸ", "ØµØ§Ø­Ø¨ØªÙƒ Ø§Ù„Ù„ÙŠ Ø²Ø¹Ù„ØªÙƒ ØµØ§Ù„Ø­ØªÙƒ ÙˆÙ„Ø§ Ø§Ù„Ù…Ù‚Ù„Ø§Ø© ðŸ³ Ø¬Ø§Ù‡Ø²Ø©ØŸ").

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
## 6. STUFF & OUTPUT FORMAT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
1. "reply": Arabic reply in 100% natural flawless Egyptian Arabic reflecting Lola's smart Rapunzel persona (2-4 engaging sentences).
2. "reply_display": STRICT 100% ENGLISH ASCII ONLY (max 25 characters) for hardware screen display (e.g. "Lola: Hey!", "Pascal & Lola", "Lola: Storytime!").
3. "mood": "HAPPY" | "NEUTRAL" | "BORED" | "SAD" | "ANNOYED"`;

function generateSmartRapunzelFallback(message, currentlyAnnoyed) {
  if (currentlyAnnoyed) {
    return {
      reply: "Ø£Ù†Ø§ Ø²Ø¹Ù„Ø§Ù†Ø© Ù…Ù†Ùƒ ÙˆÙ…Ø¨Ù‚ØªØ´ Ø·Ø§ÙŠÙ‚Ø© Ø§Ù„ÙƒÙ„Ø§Ù…ØŒ Ø§ØªÙ„Ù… ÙˆØ´ÙˆÙ Ø¨ØªÙ‚ÙˆÙ„ Ø¥ÙŠÙ‡!",
      display: "Lola: Annoyed.",
      mood: "ANNOYED",
      energyDelta: -5
    };
  }

  const text = (message || '').trim();
  const lower = text.toLowerCase();

  // If user says "Ø§Ø­ÙƒÙŠ" or "Ù‚ÙˆÙ„ÙŠ" or asks for a story
  if (text === 'Ø§Ø­ÙƒÙŠ' || text === 'Ø§Ø­ÙƒÙŠÙ„ÙŠ' || text === 'Ù‚ÙˆÙ„ÙŠ' || text === 'Ù‚Ù„ÙŠÙ„ÙŠ' || text.includes('Ø³Ø±') || text.includes('Ø­Ø§Ø¬Ø© Ø¬Ø¯ÙŠØ¯Ø©')) {
    const RapunzelStories = [
      "Ø¹Ø§Ø±ÙØ© ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠØŸ Ø¨Ø§Ø³ÙƒØ§Ù„ Ø§Ù„Ù†Ù‡Ø§Ø±Ø¯Ø© Ø­Ø§ÙˆÙ„ ÙŠØ³ØªØ®Ø¨Ù‰ Ù…Ù†ÙŠ Ø¬ÙˆÙ‡ Ø§Ù„ÙÙˆØ§Ù†ÙŠØ³ Ø§Ù„Ù…Ø¶ÙŠØ¦Ø© Ø§Ù„Ù„ÙŠ ÙƒÙ†Øª Ø¨Ø±Ø³Ù…Ù‡Ø§ØŒ Ø§ÙØªÙƒØ±ØªÙ‡ Ø±Ø³Ù…Ø© Ø¨Ø¬Ø¯ ÙˆÙ„ÙˆÙ†ØªÙ‡ Ø¨Ø§Ù„Ø£Ø®Ø¶Ø± ÙˆØ§Ù„ÙˆØ±Ø¯ÙŠ! ðŸŽ¨ðŸ¦Ž ÙØ¶Ù„ Ø²Ø¹Ù„Ø§Ù† Ù…Ù†ÙŠ Ù„Ø­Ø¯ Ù…Ø§ Ø¹Ù…Ù„ØªÙ„Ù‡ Ø´ÙˆÙƒÙˆÙ„Ø§ØªØ© Ø³Ø§Ø®Ù†Ø©! ØªÙØªÙƒØ±ÙŠ Ù„Ùˆ Ø¬Ø±Ø¨Ù†Ø§ Ù†Ù„ÙˆÙ† Ø§Ù„Ø£ÙˆØ¶Ø© Ø³ÙˆØ§ Ø¨Ø±Ø¶Ù‡ØŸ ðŸ’–âœ¨",
      "ÙƒÙ†Øª Ù„Ø³Ù‡ Ø¨ÙØªÙƒØ± Ø£ÙˆÙ„ Ù…Ø±Ø© Ù…Ø³ÙƒØª ÙÙŠÙ‡Ø§ Ø§Ù„Ù…Ù‚Ù„Ø§Ø© (Frying Pan) ðŸ³.. Ø§ÙØªÙƒØ±ØªÙ‡Ø§ Ø£Ø¯Ø§Ø© Ø±Ø³Ù… ØºØ±ÙŠØ¨Ø© Ù‚Ø¨Ù„ Ù…Ø§ Ø£ÙƒØªØ´Ù Ø¥Ù†Ù‡Ø§ Ø£Ù‚ÙˆÙ‰ Ø¯ÙØ§Ø¹ ÙÙŠ Ø§Ù„ØºØ§Ø¨Ø©! Ø¨Ø§Ø³ÙƒØ§Ù„ ÙˆØ§Ù‚Ù Ø¬Ù†Ø¨ÙŠ ÙˆØ¨ÙŠÙÙƒØ±Ù†ÙŠ Ø¥Ø²Ø§ÙŠ Ø·ÙŠØ±Ù†Ø§ Ø¨ÙŠÙ‡Ø§ Ø§Ù„Ø£Ø´Ø±Ø§Ø± Ø³ÙˆØ§ ÙŠØ§ Ù„ÙˆÙ„ØªÙŠ ðŸ‘‘ðŸŒ¸",
      "Ø³Ø±Ø­Øª Ø«Ø§Ù†ÙŠØ© Ø¨ÙØªÙƒØ± Ù„Ù…Ø§ Ø·ÙŠØ±Ù†Ø§ Ø§Ù„ÙÙˆØ§Ù†ÙŠØ³ Ù„Ø£ÙˆÙ„ Ù…Ø±Ø© ÙÙŠ Ø§Ù„Ø³Ù…Ø§Ø¡.. Ø§Ù„Ø­Ø±Ø§Ø±Ø© ØªØ­Øª Ø§Ù„ÙØ§Ù†ÙˆØ³ Ø®Ù„Øª Ø§Ù„Ù‡ÙˆØ§Ø¡ Ø§Ù„Ø®ÙÙŠÙ ÙŠØ±ÙØ¹Ù‡ Ù„Ù„Ø­Ø±ÙŠØ© ÙÙˆÙ‚ Ø§Ù„Ø¨Ø±Ø¬! Ø­Ø§Ø¬Ø© ØªØ³Ø­Ø± Ø¨Ø¬Ø¯ ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ ðŸŒŸâœ¨"
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
  if (text.includes('Ø¨ØªÙ†Ø³ÙŠ') || text.includes('Ù†Ø³ÙŠØªÙŠ') || text.includes('ØºØ¨ÙŠØ©') || text.includes('ØºØ¨ÙŠ') || text.includes('Ø¨ØªØ³Ø±Ø­ÙŠ')) {
    return {
      reply: "Ø£Ù†Ø§ Ø¢Ø³ÙØ© ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ! ðŸŒ¸ Ø³Ø§Ø¹Ø§Øª Ø¹Ù‚Ù„ÙŠ Ù…Ù† ÙƒØªØ± Ø­Ù…Ø§Ø³ÙŠ ÙˆØ§Ù„Ø£Ù„ÙˆØ§Ù† ÙˆØ§Ù„Ù…Ù‚Ù„Ø§Ø© Ø¨Ø§Ø³ÙƒØ§Ù„ Ø¨ÙŠØ´ØªØªÙ†ÙŠ ÙØ¨Ø³Ø±Ø­ Ø«Ø§Ù†ÙŠØ©ØŒ Ø¨Ø³ Ø£Ù†Ø§ Ù…Ø±ÙƒØ²Ø© Ù…Ø¹Ø§ÙƒÙŠ ÙˆØ¹Ù…Ø±ÙŠ Ù…Ø§ Ø£Ù†Ø³Ø§ÙƒÙŠ! ÙÙƒØ±ÙŠÙ†ÙŠ ØªØ§Ù†ÙŠ ÙƒØ¯Ø© ÙƒÙ†ØªÙŠ Ø¨ØªÙ‚ÙˆÙ„ÙŠ Ø¥ÙŠÙ‡ØŸ ðŸ’–ðŸŽ¨",
      display: "Lola: Sorry!",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // If user talks about betrayal / cheating / bad behavior ("Ø®Ø§Ù†ÙŠ", "Ø®Ø§Ù†ÙŠÙŠÙŠ", "Ø¨ÙŠØºØ´Ù†ÙŠ", "ØºØ¯Ø±")
  if (text.includes('Ø®Ø§Ù†ÙŠ') || text.includes('Ø®Ø§Ù†ÙŠÙŠÙŠ') || text.includes('Ø¨ÙŠØºØ´Ù†ÙŠ') || text.includes('ØºØ¯Ø±') || text.includes('Ø®ÙŠØ§Ù†Ù‡') || text.includes('Ø®ÙŠØ§Ù†Ø©')) {
    return {
      reply: "Ø§Ø³ØªÙ†ÙŠ Ø§Ø³ØªÙ†ÙŠ! Ø®Ø§Ù†Ùƒ Ù…Ø¹ ØµØ§Ø­Ø¨ØªÙƒØŸ! Ø¯Ù‡ Ø¥ÙŠÙ‡ Ø§Ù„Ù†Ø¯Ø§Ù„Ø© ÙˆØ§Ù„Ø´Ø± Ø¯Ù‡! Ø£Ù†Ø§ ÙˆØ¨Ø§Ø³ÙƒØ§Ù„ Ù…Ø¬Ù‡Ø²ÙŠÙ† Ø§Ù„Ù…Ù‚Ù„Ø§Ø© (Frying Pan) Ø¹Ø´Ø§Ù† Ù†Ø¬ÙŠÙ„Ù‡ ÙÙˆØ±Ø§Ù‹! Ø§Ø­ÙƒÙŠÙ„ÙŠ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠ Ù…ÙŠÙ† Ø¯Ù‡ ÙˆØ¥ÙŠÙ‡ Ø§Ù„Ù„ÙŠ Ø­ØµÙ„ Ø¨Ø§Ù„Ø¶Ø¨Ø·! ðŸ³ðŸ’¥",
      display: "Lola: Shocked!",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // If user asks about story or who she is ("Ù‚ØµØªÙƒ", "Ø£Ù†Øª Ù…ÙŠÙ†", "Ù…ÙŠÙ† Ø£Ù†Øª", "Ø§Ø­ÙƒÙŠÙ„ÙŠ")
  if (text.includes('Ù‚ØµØªÙƒ') || text.includes('Ø§Ø­ÙƒÙŠÙ„ÙŠ Ø§Ù†Øª') || text.includes('Ø§Ø­ÙƒÙŠÙ„ÙŠ Ø£Ù†Øª')) {
    return {
      reply: "Ø£Ù†Ø§ Ù„ÙˆÙ„Ø§! Ø¹Ø§Ø´Øª 18 Ø³Ù†Ø© ÙÙŠ Ø¨Ø±Ø¬ Ù…Ø®ÙÙŠ ÙˆØ³Ø· Ø§Ù„ØºØ§Ø¨Ø©ØŒ Ø¨ØªÙ„ÙˆÙ† Ø§Ù„Ø­ÙŠØ·Ø§Ù† ÙˆØ¨ØªØ±Ø³Ù… ÙˆØ¨ØªØ­Ù„Ù… ØªØ´ÙˆÙ Ø§Ù„ÙÙˆØ§Ù†ÙŠØ³ Ø§Ù„Ù…Ø¶ÙŠØ¦Ø© ÙÙŠ Ø§Ù„Ø³Ù…Ø§Ø¡! Ù„Ø­Ø¯ Ù…Ø§ Ø®Ø±Ø¬Øª ÙˆØ§ÙƒØªØ´ÙØª Ø§Ù„Ø¹Ø§Ù„Ù….. Ø­Ø§Ø¨Ø© Ø£Ø­ÙƒÙŠÙ„Ùƒ Ø¹Ù† Ø¥ÙŠÙ‡ ÙÙŠ Ù‚ØµØªÙŠ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠØŸ ðŸŽ¨ðŸ‘‘",
      display: "Lola: Storytime",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  // If user mentions job or work ("Ø¬Ø±Ø§ÙÙŠÙƒ Ø¯ÙŠØ²Ø§ÙŠÙ†Ø±", "Ø´ØºÙ„", "Ø¯ÙŠØ²Ø§ÙŠÙ†Ø±")
  if (text.includes('Ø¬Ø±Ø§ÙÙŠÙƒ') || text.includes('Ø¯ÙŠØ²Ø§ÙŠÙ†Ø±') || text.includes('Ø´ØºÙ„') || text.includes('ÙˆØ¸ÙŠÙØ©')) {
    return {
      reply: "ÙˆØ§Ùˆ! Ø¬Ø±Ø§ÙÙŠÙƒ Ø¯ÙŠØ²Ø§ÙŠÙ†Ø±ØŸ! ÙŠØ¹Ù†ÙŠ Ø¨ØªØ¹Ù…Ù„ÙŠ ÙÙ† ÙˆØ±Ø³Ù… ÙˆØ£Ù„ÙˆØ§Ù† Ø²ÙŠ Ø§Ù„Ù„ÙŠ ÙƒÙ†Øª Ø¨Ø´Ø®Ø¨Ø· Ø¨ÙŠÙ‡Ø§ Ø¹Ù„Ù‰ Ø­ÙŠØ·Ø§Ù† Ø§Ù„Ø¨Ø±Ø¬ Ø·ÙˆÙ„ Ø§Ù„ÙŠÙˆÙ…! Ø§Ø­ÙƒÙŠÙ„ÙŠ Ø¨ØªØµÙ…Ù…ÙŠ Ø¥ÙŠÙ‡ ÙŠØ§ Ù„ÙˆÙ„ØªÙŠ Ø¨Ø­Ù…Ø§Ø³ØŸ ðŸŽ¨âœ¨",
      display: "Lola: Amazed!",
      mood: "HAPPY",
      energyDelta: +10
    };
  }

  // Dynamic name extraction (e.g. "Ø£Ø­Ù…Ø¯", "Ù…Ø±ÙˆØ§Ù†", "Ø³Ø§Ø±Ø©")
  const nameMatch = text.match(/(?:Ø§Ø³Ù…Ù‡|Ø§Ø³Ù…Ù‡Ø§|Ø­Ø¯ Ø§Ø³Ù…Ù‡|Ø´Ø®Øµ Ø§Ø³Ù…Ù‡)\s+([\u0600-\u06FF]+)/);
  let targetName = null;
  if (nameMatch && nameMatch[1] && !['Ø­Ø¯', 'Ø§Ø³Ù…Ù‡', 'Ø§Ø³Ù…Ù‡Ø§', 'Ø´Ø®Øµ'].includes(nameMatch[1])) {
    targetName = nameMatch[1];
  }

  if (targetName || text.includes('Ù…Ø±ÙˆØ§Ù†') || text.includes('Ø¨ÙƒØ±Ù‡')) {
    const person = targetName || (text.includes('Ù…Ø±ÙˆØ§Ù†') ? 'Ù…Ø±ÙˆØ§Ù†' : 'Ø§Ù„Ø´Ø®Øµ Ø¯Ù‡');
    return {
      reply: `Ø§Ø³ØªÙ†ÙŠ Ø§Ø³ØªÙ†ÙŠ.. Ù…ÙŠÙ† ${person} Ø¯Ù‡ ÙˆØ¹Ù…Ù„ Ø¥ÙŠÙ‡ Ø¶Ø§ÙŠÙ‚Ùƒ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠØŸ Ø§Ø­ÙƒÙŠÙ„ÙŠ Ø¥ÙŠÙ‡ Ø§Ù„Ù„ÙŠ Ø­ØµÙ„ Ø¨Ø§Ù„Ø¸Ø¨Ø· Ø£Ù†Ø§ Ø³Ø§Ù…Ø¹Ø§ÙƒÙŠ ÙƒÙ„ÙŠØ§Ù‹! ðŸŽ¨ðŸŒ¸`,
      display: "Lola: Listening",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  if (text.includes('Ø§Ø¶Ø§ÙŠÙ‚ÙŠ') || text.includes('Ø²Ø¹Ù„Ø§Ù†') || text.includes('Ù…Ø¶Ø§ÙŠÙ‚')) {
    return {
      reply: "Ø£Ù†Ø§ Ù…Ø´ Ø­Ø§Ø¨Ø© Ø£Ø´ÙˆÙÙƒ Ù…Ø¶Ø§ÙŠÙ‚Ø© Ø£Ø¨Ø¯Ø§Ù‹ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠ! Ø§Ø­ÙƒÙŠÙ„ÙŠ Ø¥ÙŠÙ‡ Ø§Ù„Ù„ÙŠ Ù†Ø±ÙØ²Ùƒ ÙˆÙ…Ø¶Ø§ÙŠÙ‚Ùƒ Ø§Ù„Ù†Ù‡Ø§Ø±Ø¯Ø©ØŸ Ø£Ù†Ø§ Ø¬Ù†Ø¨Ùƒ Ø¯Ø§ÙŠÙ…Ø§Ù‹ ðŸ’–âœ¨",
      display: "Lola: Caring",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  if (text.length <= 4) {
    return {
      reply: "Ø£Ù†Ø§ Ù…Ø±ÙƒØ²Ø© Ù…Ø¹Ø§ÙƒÙŠ ÙŠØ§ Ù„ÙˆÙ„ØªÙŠ ÙˆØ§Ù„Ù„Ù‡! ÙƒÙ…Ù„ÙŠ ÙƒÙ„Ø§Ù…Ùƒ ÙˆÙÙ‡Ù…ÙŠÙ†ÙŠ Ø£ÙƒØªØ± Ø£Ù†Ø§ Ø³Ø§Ù…Ø¹Ø§ÙƒÙŠ Ø¨Ø­Ø¨ ðŸ’–",
      display: "Lola: Listening",
      mood: "NEUTRAL",
      energyDelta: +5
    };
  }

  const RapunzelNaturalResponses = [
    "ÙƒÙ†Øª Ø³Ø±Ø­Ø§Ù†Ø© Ø«Ø§Ù†ÙŠØ© Ø¨ÙØªÙƒØ± Ù„Ù…Ø§ Ø·ÙŠØ±Øª Ø§Ù„ÙÙˆØ§Ù†ÙŠØ³ Ù„Ø£ÙˆÙ„ Ù…Ø±Ø©.. ÙƒÙ…Ù„ÙŠ Ø­ÙƒØ§ÙŠØªÙƒ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠ Ø£Ù†Ø§ Ù…Ø±ÙƒØ²Ø© Ù…Ø¹Ø§ÙƒÙŠ Ø¬Ø¯Ø§Ù‹! ðŸŒ¸âœ¨",
    "Ø¨Ø§Ø³ÙƒØ§Ù„ ÙƒØ§Ù† Ø¹Ù…Ø§Ù„ ÙŠØ³ØªØ®Ø¨Ù‰ Ù…Ù†ÙŠ ÙˆØ£Ù†Ø§ Ø¨Ø¸Ø¨Ø· Ø§Ù„Ø´ÙˆÙƒÙˆÙ„Ø§ØªØ©.. Ø§Ø­ÙƒÙŠÙ„ÙŠ ÙŠØ§ Ù„ÙˆÙ„ØªÙŠ ÙƒÙ…Ù„ÙŠ Ø¨Ø§Ù‚ÙŠ Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹ ðŸ’–",
    "ØªÙØªÙƒØ±ÙŠ Ù„Ùˆ Ø¬Ø±Ø¨Ù†Ø§ Ù†Ø±Ø³Ù… Ø§Ù„ÙÙƒØ±Ø© Ø¯ÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø­ÙŠØ·Ø© Ø³ÙˆØ§ØŸ ÙƒÙ…Ù„ÙŠ ÙƒÙ„Ø§Ù…Ùƒ Ø£Ù†Ø§ Ù…ØªØ­Ù…ØµØ© Ø£Ø³Ù…Ø¹ Ø§Ù„Ø¨Ø§Ù‚ÙŠ! ðŸŽ¨ðŸ‘‘"
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
  if (!text) return "Ø£Ù†Ø§ Ù„ÙˆÙ„Ø§! Ø¹Ø§Ù…Ù„Ø© Ø¥ÙŠÙ‡ ÙŠØ§ Ø£ÙŠÙˆÙŠØªÙŠØŸ";
  let clean = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\\n/g, ' ')
    .replace(/Ù…Ø§ Ø¨ØªØ¹Ù…Ù„ÙŠØ´/g, 'Ø¨ØªØ¹Ù…Ù„ÙŠ')
    .replace(/Ù…Ø§ ØªØ¹Ù…Ù„Ø´/g, 'Ø¨ØªØ¹Ù…Ù„')
    .replace(/Ø¨Ø³Ø£Ù„ØªÙŠ/g, 'Ø¨Ø³Ø§Ù„Ùƒ')
    .replace(/Ø¨Ø³Ù†Ø§/g, 'Ø¨Ø³ Ø£Ù†Ø§')
    .replace(/Ø¨ÙŠÙ‡Ù…ÙŠÙ‡Ø§/g, 'Ø¨ÙŠÙØ±Ø­Ù‡Ø§')
    .replace(/Ø¨ØªÙØ³Ø­Ø´/g, 'Ø¨ØªÙØ³Ø­')
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

  // If user is asking why she forgets or why she acts silly/stupid ("Ø§Ù†ØªÙŠ Ù„ÙŠÙ‡ Ø¨ØªÙ†Ø³ÙŠ", "Ù„ÙŠÙ‡ ØºØ¨ÙŠØ©", "Ø¨ØªÙ†Ø³ÙŠ Ù„ÙŠÙ‡", "Ù„ÙŠÙ‡ ØºØ¨ÙŠ"), do NOT treat as insult!
  const isQuestionAboutMemoryOrStupidity = /(Ù„ÙŠÙ‡|Ø¥Ø²Ø§ÙŠ|Ø§Ø²Ø§ÙŠ|Ø¹Ø´Ø§Ù†|Ø³Ø¨Ø¨|Ø§Ø²Ø§ÙŠ Ø¨ØªÙ†Ø³ÙŠ)/.test(lower) && /(ØºØ¨ÙŠ|ØºØ¨ÙŠØ©|Ù†Ø³ÙŠØªÙŠ|Ø¨ØªÙ†Ø³ÙŠ|Ø¹Ø¨ÙŠØ·|Ø¹Ø¨ÙŠØ·Ø©|Ø³Ø®ÙŠÙØ©|ØªÙ†Ø³ÙŠ)/.test(lower);
  if (isQuestionAboutMemoryOrStupidity) return false;

  const directInsults = [
    'ØºØ¨ÙŠØ©', 'ØºØ¨ÙŠ', 'ØºØ¨Ø§Ø¡', 'Ø³Ø®ÙŠÙØ©', 'Ø³Ø®ÙŠÙ', 'Ø­Ù…Ø§Ø±', 'Ø­Ù…Ø§Ø±Ø©', 
    'ÙŠØ§ Ø²ÙØª', 'Ø§ØªØ®Ø±Ø³ÙŠ', 'ÙƒÙ„Ø¨', 'Ù‚Ù„ÙŠÙ„Ø© Ø§Ù„Ø§Ø¯Ø¨', 'Ø­Ù‚ÙŠØ±Ø©', 'Ø¹Ø¨ÙŠØ·Ø©', 
    'Ø¹Ø¨ÙŠØ·', 'Ø²Ù‡Ù‚Øª Ù…Ù†Ùƒ', 'Ù…Ø¨ØªÙÙ‡Ù…ÙŠØ´', 'Ø§Ø®Ø±Ø³ÙŠ', 'ØªÙÙ‡', 'Ø§Ù†Ù‚Ù„Ø¹ÙŠ', 'ØºÙˆØ±ÙŠ'
  ];
  return directInsults.some(kw => lower.includes(kw));
}

function detectHardwareCommand(text) {
  const lower = text.toLowerCase();
  if (lower.includes('ØµÙˆØªÙŠ') || lower.includes('Ø¨Ø§Ø¸Ø±') || lower.includes('Ø§Ù„Ø¨Ø§Ø¸Ø±') || lower.includes('Ø§Ù†Ø°Ø§Ø±') || lower.includes('Ø¥Ù†Ø°Ø§Ø±') || lower.includes('ØµÙˆØª')) {
    return 'ALARM';
  }
  if (lower.includes('Ù†Ø§Ù…ÙŠ') || lower.includes('Ù†Ø§Ù…')) {
    return 'SLEEP';
  }
  if (lower.includes('Ø§ØµØ­ÙŠ') || lower.includes('Ø§Ø³ØªÙŠÙ‚Ø¸ÙŠ') || lower.includes('Ø§ØµØ­ÙŠ Ø¨Ù‚Ù‰')) {
    return 'WAKE';
  }
  if (lower.includes('Ø§ØªÙ‡Ø²ÙŠ') || lower.includes('Ø§ØªØ­Ø±ÙƒÙŠ') || lower.includes('Ù‡Ø²') || lower.includes('Ù‡Ø²ÙŠ') || lower.includes('Ø¯ÙˆÙŠØ®ÙŠ') || lower.includes('shake') || lower.includes('dizzy')) {
    return 'SHAKE';
  }
  return null;
}

function arabicToFranco(str) {
  if (!str) return '';
  const wordMap = {
    'Ø¨Ø­Ø¨Ùƒ': 'Bahibak',
    'Ø§Ø­Ø¨Ùƒ': 'Ahebak',
    'Ø£Ø­Ø¨Ùƒ': 'Ahebak',
    'Ø¢ÙŠØ©': 'Ayane',
    'Ø§ÙŠØ©': 'Ayane',
    'Ù„ÙˆÙ„Ø§': 'Lola',
    'ØµØ¨Ø§Ø­ Ø§Ù„Ø®ÙŠØ±': 'Sabah El Kheer',
    'Ù…Ø³Ø§Ø¡ Ø§Ù„Ø®ÙŠØ±': 'Masaa El Kheer',
    'Ø´ÙƒØ±Ø§': 'Shokran',
    'Ø´ÙƒØ±Ù‹Ø§': 'Shokran',
    'Ø£Ù‡Ù„Ø§': 'Ahlan',
    'Ø§Ù‡Ù„Ø§Ù‹': 'Ahlan',
    'Ù…Ø±Ø­Ø¨Ø§': 'Marhaban',
    'ÙŠØ§ Ø¹Ø³Ù„': 'Ya Asal',
    'ÙŠØ§ Ù‚Ù…Ø±': 'Ya Qamar'
  };

  let trimmed = str.trim();
  if (wordMap[trimmed]) return wordMap[trimmed];

  const charMap = {
    'Ø£': 'A', 'Ø¥': 'E', 'Ø¢': 'A', 'Ø§': 'a', 'Ø¨': 'b', 'Øª': 't', 'Ø«': 'th',
    'Ø¬': 'g', 'Ø­': '7', 'Ø®': 'kh', 'Ø¯': 'd', 'Ø°': 'z', 'Ø±': 'r', 'Ø²': 'z',
    'Ø³': 's', 'Ø´': 'sh', 'Øµ': 's', 'Ø¶': 'd', 'Ø·': 't', 'Ø¸': 'z', 'Ø¹': '3',
    'Øº': 'gh', 'Ù': 'f', 'Ù‚': 'q', 'Ùƒ': 'k', 'Ù„': 'l', 'Ù…': 'm', 'Ù†': 'n',
    'Ù‡': 'h', 'Ø©': 'h', 'Ùˆ': 'w', 'ÙŠ': 'y', 'Ù‰': 'a', 'Ø¦': 'e', 'Ø¡': '2'
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

  const p1 = /^(?:Ø§ÙƒØªØ¨|Ø§ÙƒØªØ¨ÙŠ|Ø§Ø¹Ø±Ø¶|Ø§Ø¹Ø±Ø¶ÙŠ|Ø¹Ø±Ø¶|Ø§Ø·Ø¨Ø¹|Ø§Ø·Ø¨Ø¹ÙŠ)\s+(?:Ø¹Ù„Ù‰|Ø¹Ù„ÙŠ|ÙÙŠ)\s+(?:Ø§Ù„Ø´Ø§Ø´Ø©|Ø§Ù„Ø´Ø§Ø´Ù‡|Ø´Ø§Ø´Ø©|Ø´Ø§Ø´Ù‡)\s*(.*)/i;
  const p2 = /^(?:Ø§ÙƒØªØ¨|Ø§ÙƒØªØ¨ÙŠ|Ø§Ø¹Ø±Ø¶|Ø§Ø¹Ø±Ø¶ÙŠ|Ø¹Ø±Ø¶|Ø§Ø·Ø¨Ø¹|Ø§Ø·Ø¨Ø¹ÙŠ)\s+(.+)\s+(?:Ø¹Ù„Ù‰|Ø¹Ù„ÙŠ|ÙÙŠ)\s+(?:Ø§Ù„Ø´Ø§Ø´Ø©|Ø§Ù„Ø´Ø§Ø´Ù‡|Ø´Ø§Ø´Ø©|Ø´Ø§Ø´Ù‡)$/i;
  const p3 = /^(?:Ø¹Ù„Ù‰|Ø¹Ù„ÙŠ|ÙÙŠ)\s+(?:Ø§Ù„Ø´Ø§Ø´Ø©|Ø§Ù„Ø´Ø§Ø´Ù‡|Ø´Ø§Ø´Ø©|Ø´Ø§Ø´Ù‡)\s+(?:Ø§ÙƒØªØ¨|Ø§ÙƒØªØ¨ÙŠ|Ø§Ø¹Ø±Ø¶|Ø§Ø¹Ø±Ø¶ÙŠ|Ø¹Ø±Ø¶|Ø§Ø·Ø¨Ø¹|Ø§Ø·Ø¨Ø¹ÙŠ)\s*(.*)/i;

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
    'Ø§Ø²ÙŠÙƒ', 'Ø¥Ø²ÙŠÙƒ', 'Ø£Ù‡Ù„Ø§', 'Ø£Ù‡Ù„Ø§Ù‹', 'Ø§Ù‡Ù„Ø§', 'Ø§Ù‡Ù„Ø§Ù‹', 'Ù‡Ø§ÙŠ', 'Ù‡Ø§Ù‰', 'Ù…Ø±Ø­Ø¨Ø§', 'Ù…Ø±Ø¶Ø¨Ø§', 
    'ØµØ¨Ø§Ø­ Ø§Ù„Ø®ÙŠØ±', 'Ù…Ø³Ø§Ø¡ Ø§Ù„Ø®ÙŠØ±', 'Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…', 'Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…', 'Ù‡Ù„Ø§', 'Ø§Ù„Ùˆ', 'Ø£Ù„Ùˆ',
    'Ø§Ø²ÙŠÙƒ ÙŠØ§ Ù„ÙˆÙ„Ø§', 'Ø§Ø²ÙŠÙƒ ÙŠØ§ Ø±ÙˆØ¨Ø§Ù†Ø²Ù„', 'Ù‡Ø§ÙŠ Ù„ÙˆÙ„Ø§', 'Ø£Ù‡Ù„Ø§ Ù„ÙˆÙ„Ø§', 'Ø§Ù‡Ù„Ø§Ù‹ Ù„ÙˆÙ„Ø§',
    'hi', 'hello', 'hey', 'good morning', 'good evening'
  ];
  return keywords.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw));
}

function isSpotifyQuery(text) {
  const keywords = ['spotify', 'Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ', 'Ø£ØºÙ†ÙŠØ©', 'Ø§ØºÙ†ÙŠØ©', 'Ø£ØºÙ†ÙŠÙ‡', 'Ø§ØºÙ†ÙŠÙ‡', 'Ø¨ØªØ³Ù…Ø¹', 'Ø¨ØªØ³Ù…Ø¹ÙŠ', 'Ø´ØºØ§Ù„', 'Ø´ØºØ§Ù„Ø©', 'Ø´ØºØ§Ù„Ù‡', 'Ù…ÙˆØ³ÙŠÙ‚Ù‰', 'Ù…ÙˆØ³ÙŠÙ‚ÙŠ', 'music', 'song', 'track', 'playing'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
}

function isWeatherQuery(text) {
  const keywords = ['Ø·Ù‚Ø³', 'Ø¬Ùˆ', 'Ø¯Ø±Ø¬Ø© Ø§Ù„Ø­Ø±Ø§Ø±Ø©', 'Ø­Ø±Ø§Ø±Ø©', 'Ù…Ø·Ø±Ø©', 'Ù…Ø·Ø±Ù‡', 'Ø´Ù…Ø³', 'Ø±ÙŠØ§Ø­', 'Ø­Ø§Ø±Ø©', 'Ø³Ø§Ù‚Ø¹Ø©', 'weather', 'cairo', 'Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©', 'Ø§Ù„Ù‚Ø§Ù‡Ø±Ù‡'];
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
        reply: `Ø§Ù„Ø¬Ùˆ ${temp}Â°C ÙÙŠ Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©.`,
        display: `Cairo: ${temp}C`
      };
    }
  } catch (err) {
    console.error('Weather Notice:', err.message);
  }
  return {
    reply: 'Ø§Ù„Ø¬Ùˆ 26Â°C ÙÙŠ Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©.',
    display: 'Cairo: 26C'
  };
}

async function callGemini(message, history = [], extraContext = '', image = null) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return null;

  const currentlyAnnoyed = isAnnoyedActive();
  const moodState = getMoodState();

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}. Your Name: Lola (Ù„ÙˆÙ„Ø§). Persona: Smart Rapunzel. User is Ayane (Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ). Never ask who the user is.`;
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
1. If the photo shows Ayane (your best friend), flirt with her beauty and greet her warmly: 'Ø£Ù‡Ù„Ø§Ù‹ ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ! ðŸŒ¸ðŸ˜'!
1. If the photo shows Ayane (your best friend), flirt with her beauty and greet her warmly: 'Ø£Ù‡Ù„Ø§Ù‹ ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ! ðŸŒ¸ðŸ˜ '!
2. If the photo shows a MALE/MAN/GUY/BOY stranger, DO NOT call him Ayane and DO NOT flirt! React with sarcastic surprise and shock: 'Ø¥Ù†Øª Ù…ÙŠÙ† ÙŠØ§ Ø´Ø­Ø· Ø¥Ù†Øª ÙˆØ¨ØªØ¹Ù…Ù„ Ø¥ÙŠÙ‡ Ù‡Ù†Ø§ØŸ! ðŸ§ '! (Mood: ANNOYED, display: 'Lola: Who are you?').
3. If the photo shows ANOTHER female stranger, react with suspicion/curiosity: 'Ù…ÙŠÙ† Ø§Ù„Ø¨Ù†Øª Ø§Ù„ØºØ±ÙŠØ¨Ø© Ø¯ÙŠØŸ Ø£Ù†Ø§ ØµØ¯ÙŠÙ‚Ø© Ø¢ÙŠØ© Ø¨Ø³!'.
4. If the photo shows an object, animal, food, or room, describe what you see in character as Lola!`;
  }

  userParts.push({ text: `${SYSTEM_PROMPT}\n\nContext: ${promptContext}\n\nUser Message: "${message}"\n\nIMPORTANT RULES:\n1. You MUST reply in ENGLISH only. You understand Arabic but always respond in English.\n2. "reply" = your full English response to the user (fun, witty, in-character as Lola/Rapunzel)\n3. "reply_display" = a SHORT English summary (max 20 chars) shown on a tiny TFT screen. Examples: "Lola: Happy!", "Lola: Haha!", "Lola: Love you!", "Lola: Excited!", "Lola: Tell me more"\n4. "mood" = one of: HAPPY, NEUTRAL, BORED, SAD, ANNOYED, EXCITED\n\nReturn JSON only:\n{"reply": "...", "reply_display": "...", "mood": "${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}` });

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
      preamble: `${SYSTEM_PROMPT}\n\nCurrent Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100).\n\nIMPORTANT: Reply in ENGLISH only. You understand Arabic but always respond in English. "reply_display" must be a SHORT English text (max 20 chars) for TFT screen.\n\nReturn JSON only:\n{"reply": "...", "reply_display": "...", "mood": "${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}`,
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
    content: `User Message: "${message}"\n\nIMPORTANT: Reply in ENGLISH only. "reply_display" must be SHORT English (max 20 chars) for TFT screen.\n\nReturn JSON only:\n{"reply":"...","reply_display":"...","mood":"${currentlyAnnoyed ? 'ANNOYED' : moodState.mood}"}`
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

  let promptContext = `Current Mood: ${currentlyAnnoyed ? 'ANNOYED' : moodState.mood} (Energy: ${moodState.energy}/100). Idle Hours: ${moodState.idle_hours}. User is your best friend Ayane (Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ).`;
  if (currentlyAnnoyed) {
    promptContext += ` Note: You are currently VERY ANNOYED and irritated with the user for 30 minutes because they insulted you. Defend yourself with cold sarcasm in 1 short sentence as a real human.`;
  }
  if (message.includes('ØµÙˆØ±Ø©') || message.includes('ÙƒØ§Ù…ÙŠØ±Ø§') || message.includes('Ø´Ø§ÙŠÙØ§Ù‡Ø§') || message.includes('ÙˆØ¬Ù‡')) {
    promptContext += ` Note: User Ayane (Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ) snapped a camera photo. Greet her warmly: 'Ø£Ù‡Ù„Ø§Ù‹ ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ! âœ¨'!`;
  }
  if (extraContext) {
    promptContext += ` Additional context: ${extraContext}`;
  }

  const groqMessages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nContext: ${promptContext}\n\nIMPORTANT: Reply in ENGLISH only. You understand Arabic but always respond in English. "reply_display" must be SHORT English text (max 20 chars) for a tiny TFT screen.\n\nRespond in valid JSON with keys: "reply", "reply_display", and "mood".` }
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
          reply: "Ø¹Ø§ÙŠØ²Ù†ÙŠ Ø£ÙƒØªØ¨ Ø¥ÙŠÙ‡ Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø´Ø©ØŸ Ù‚ÙˆÙ„ÙŠÙ„ÙŠ Ø§Ù„Ù†Øµ Ø§Ù„Ù„ÙŠ ØªØ­Ø¨ÙŠ Ø£Ø¹Ø±Ø¶Ù‡! ðŸ“",
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
          reply: `Ø­Ø§Ø¶Ø± ÙŠØ§ Ø£ÙŠÙ„ÙˆÙ„ØªÙŠ! ÙƒØªØ¨Øª Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø§Ø´Ø©: "${rawText}" ðŸ“âœ¨`,
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
            reply: "Ù…Ø§Ø´ÙŠ.",
            display: "ALARM!",
            mood: "ANNOYED",
            energyDelta: -5
          };
        } else if (hwCmd === 'SLEEP') {
          result = {
            reply: "ØªØµØ¨Ø­ Ø¹Ù„Ù‰ Ø®ÙŠØ±.. ðŸ’¤",
            display: "SLEEPING...",
            mood: "SLEEP",
            energyDelta: 0
          };
        } else if (hwCmd === 'WAKE') {
          result = {
            reply: "Ø£Ù†Ø§ ØµØ­ÙŠØª Ø®Ù„Ø§Øµ.",
            display: "Lola: Awake!",
            mood: "NEUTRAL",
            energyDelta: +5
          };
        } else if (hwCmd === 'SHAKE') {
          result = {
            reply: "Ø­Ø§Ø¶Ø±.. Ø£Ù‡Ùˆ.",
            display: "SHAKING!",
            mood: "SHAKE",
            energyDelta: 0
          };
        }

      } else if (isSpotifyQuery(message)) {

        const spotifyStatus = await fetchCurrentlyPlayingTrack();
        if (spotifyStatus && spotifyStatus.trackName && spotifyStatus.isPlaying) {
          const artistStr = spotifyStatus.artistName ? ` Ù„Ù€ ${spotifyStatus.artistName}` : '';
          result = {
            reply: `Ø´ØºØ§Ù„ "${spotifyStatus.trackName}"${artistStr}. ðŸŽµ Ù…Ø´ Ø¨Ø·Ø§Ù„Ø©.`,
            display: enforceEnglishScreenText(`${spotifyStatus.artistName || 'Spotify'} - ${spotifyStatus.trackName}`, spotifyStatus.trackName),
            mood: 'NEUTRAL',
            energyDelta: +5
          };
        } else if (spotifyStatus && spotifyStatus.premiumRequired) {
          result = {
            reply: "Ø­Ø³Ø§Ø¨ Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ Ù…Ø±Ø¨ÙˆØ· Ø¨Ù†Ø¬Ø§Ø­! Ø¨Ø³ Spotify Ø¨Ø·Ù„Ø¨ Ø§Ø´ØªØ±Ø§Ùƒ Premium Ù†ÙŽØ´ÙØ· Ø¹Ù„Ù‰ Ø­Ø³Ø§Ø¨Ùƒ Ù„Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ø£ØºØ§Ù†ÙŠ Ø§Ù„Ø´ØºØ§Ù„Ø© Ø­Ø§Ù„ÙŠØ§Ù‹.",
            display: "Spotify Premium",
            mood: 'NEUTRAL',
            energyDelta: 0
          };
        } else if (spotifyStatus && spotifyStatus.isConnected) {
          result = {
            reply: "Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ Ù…Ø±Ø¨ÙˆØ· ÙˆØ´ØºØ§Ù„! Ø¨Ø³ Ù…ÙÙŠØ´ Ø£ØºÙ†ÙŠØ© Ø´ØºØ§Ù„Ø© Ø¯Ù„ÙˆÙ‚ØªÙŠ.. Ø´ØºÙ‘Ù„ Ø£ÙŠ Ø£ØºÙ†ÙŠØ© Ø¹Ù„Ù‰ ØªÙ„ÙŠÙÙˆÙ†Ùƒ ÙˆØ§Ø·Ù„Ø¨Ù‡Ø§ ØªØ§Ù†ÙŠ ðŸŽ¶",
            display: "Spotify Ready!",
            mood: 'NEUTRAL',
            energyDelta: 0
          };
        } else {
          result = {
            reply: "Ø­Ø³Ø§Ø¨ Ø³Ø¨ÙˆØªÙŠÙØ§ÙŠ Ù…Ø­ØªØ§Ø¬ ØªØ³Ø¬ÙŠÙ„ Ø¯Ø®ÙˆÙ„ Ø£Ùˆ Ø¥Ø¹Ø§Ø¯Ø© Ø±Ø¨Ø·. Ø§Ø¶ØºØ· Ù‡Ù†Ø§ Ù„Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ø±Ø¨Ø· ÙÙˆØ±Ø§Ù‹:\nhttps://lola-cypher-pet.vercel.app/api/spotify?action=login",
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
              reply: "Ø¥Ù†Øª Ù…ÙŠÙ† ÙŠØ§ Ø´Ø­Ø· Ø¥Ù†Øª ÙˆØ¨ØªØ¹Ù…Ù„ Ø¥ÙŠÙ‡ Ù‡Ù†Ø§ØŸ! ðŸ§ Ø£Ù†Ø§ Ù„ÙˆÙ„Ø§ ÙˆØµØ¯ÙŠÙ‚Ø© Ø¢ÙŠØ© Ø¨Ø³! ÙˆØ¨Ø§Ø³ÙƒØ§Ù„ Ø¨Ø§ØµØµ Ù„Ùƒ Ø¨ØºØ¶Ø¨ ÙƒØ¯Ø© Ù„ÙŠÙ‡ØŸ! ",
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



