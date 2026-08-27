const ttsHandler = require('../handlers/tts');

module.exports = (req, res) => {
  return ttsHandler(req, res);
};
