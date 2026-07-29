const express = require('express');
const path = require('path');
const chatHandler = require('./api/chat');
const moodHandler = require('./api/mood');
const notifyHandler = require('./api/notify');
const spotifyHandler = require('./api/spotify');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/chat', (req, res) => chatHandler(req, res));
app.all('/api/mood', (req, res) => moodHandler(req, res));
app.all('/api/notify', (req, res) => notifyHandler(req, res));
app.all('/api/spotify*', (req, res) => spotifyHandler(req, res));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cypher Express Server running on http://localhost:${PORT}`);
});
