const express = require('express');
const path = require('path');
const chatHandler = require('./handlers/chat');
const moodHandler = require('./handlers/mood');
const notifyHandler = require('./handlers/notify');
const spotifyHandler = require('./handlers/spotify');
const resetHandler = require('./handlers/reset');
const joystickHandler = require('./handlers/joystick');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.all('/api/chat', (req, res) => chatHandler(req, res));
app.all('/api/mood', (req, res) => moodHandler(req, res));
app.all('/api/notify', (req, res) => notifyHandler(req, res));
app.all('/api/spotify', (req, res) => spotifyHandler(req, res));
app.all('/api/spotify/callback', (req, res) => spotifyHandler(req, res));
app.all('/api/reset', (req, res) => resetHandler(req, res));
app.all('/api/joystick', (req, res) => joystickHandler(req, res));

app.get('/', (req, res) => {
  if (require('fs').existsSync(path.join(__dirname, 'index.html'))) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Cypher Express Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
