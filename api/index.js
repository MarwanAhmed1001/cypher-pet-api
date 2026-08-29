const express = require('express');
const path = require('path');
const chatHandler = require('../handlers/chat');
const moodHandler = require('../handlers/mood');
const notifyHandler = require('../handlers/notify');
const spotifyHandler = require('../handlers/spotify');
const resetHandler = require('../handlers/reset');
const joystickHandler = require('../handlers/joystick');
const ttsHandler = require('../handlers/tts');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes - all in one serverless function = shared state
app.all('/api/chat', (req, res) => chatHandler(req, res));
app.all('/api/mood', (req, res) => moodHandler(req, res));
app.all('/lola/interact', (req, res) => moodHandler(req, res));
app.all('/api/notify', (req, res) => notifyHandler(req, res));
app.all('/api/spotify', (req, res) => spotifyHandler(req, res));
app.all('/api/spotify/callback', (req, res) => spotifyHandler(req, res));
app.all('/api/reset', (req, res) => resetHandler(req, res));
app.all('/api/joystick', (req, res) => joystickHandler(req, res));
app.all('/api/tts', (req, res) => ttsHandler(req, res));

module.exports = app;
