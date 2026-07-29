require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const { recordInteraction } = require('../lib/store');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '8c7a75e146944dcb8a29a45a6b77766c';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'd479e32b181347feb5fd2810cbd3d127';
const REDIRECT_URI = 'https://lola-cypher-pet.vercel.app/api/spotify';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function enforceEnglishScreenText(text, fallback = "Spotify Music!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 22) return clean.substring(0, 22);
  return clean;
}

// Memory cache for refresh token if set dynamically
let activeRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN || '';

async function getSpotifyAccessToken() {
  const refresh_token = activeRefreshToken || process.env.SPOTIFY_REFRESH_TOKEN;

  if (!CLIENT_ID || !CLIENT_SECRET || !refresh_token) {
    return null;
  }

  try {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh_token
      }),
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 5000
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error.message);
    return null;
  }
}

async function fetchCurrentlyPlayingTrack() {
  const accessToken = await getSpotifyAccessToken();
  if (!accessToken) return null;

  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 5000
    });

    if (response.status === 200 && response.data && response.data.item) {
      const trackName = response.data.item.name || '';
      const artistName = (response.data.item.artists || []).map(a => a.name).join(', ') || '';
      const isPlaying = response.data.is_playing || false;

      return {
        isPlaying,
        trackName,
        artistName
      };
    }
  } catch (error) {
    console.error('Error fetching Spotify track:', error.message);
  }

  return null;
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code, action, login } = req.query || {};

  // 1. Handle Login Redirect
  if (action === 'login' || login === 'true') {
    const scope = 'user-read-currently-playing user-read-playback-state';
    const authUrl = 'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: REDIRECT_URI
      });
    return res.redirect(authUrl);
  }

  // 2. Handle OAuth Callback Code from Spotify
  if (code) {
    try {
      const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        querystring.stringify({
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        }),
        {
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const refresh_token = response.data.refresh_token;
      if (refresh_token) {
        activeRefreshToken = refresh_token;
        console.log('NEW SPOTIFY REFRESH TOKEN:', refresh_token);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Spotify Linked Successfully!</title>
            <style>
              body { font-family: sans-serif; background: #0d0d0d; color: #fff; text-align: center; padding: 50px; }
              .card { background: #141416; border: 1px solid #26262a; border-radius: 16px; padding: 30px; max-width: 500px; margin: auto; }
              h1 { color: #1DB954; }
              code { background: #222; padding: 10px; border-radius: 8px; display: block; word-break: break-all; margin: 20px 0; color: #FFD700; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>✅ Spotify Connected to Cypher Pet!</h1>
              <p>تم ربط حسابك في سبوتيفاي بنجاح مع Cypher Pet 🎉</p>
              <p>Your Refresh Token is active!</p>
              <code>${refresh_token}</code>
            </div>
          </body>
          </html>
        `);
      }
    } catch (err) {
      console.error('Callback error:', err.message);
      return res.status(500).send('Error linking Spotify: ' + err.message);
    }
  }

  // 3. Normal Currently Playing API endpoint
  try {
    const nowPlaying = await fetchCurrentlyPlayingTrack();

    let replyText = "";
    let displayText = "";

    if (nowPlaying && nowPlaying.trackName) {
      const artistStr = nowPlaying.artistName ? ` لـ ${nowPlaying.artistName}` : '';
      replyText = `بتسمع دلوقتي: "${nowPlaying.trackName}"${artistStr} 🎵 أروق مان في المجرة 🎧`;
      displayText = enforceEnglishScreenText(`${nowPlaying.artistName || 'Spotify'} - ${nowPlaying.trackName}`, nowPlaying.trackName);
    } else {
      replyText = "شغّلت سبوتيفاي! افتح أي أغنية وعينيا عليها 🎶🎧";
      displayText = "Spotify Ready!";
    }

    const state = recordInteraction(
      replyText,
      'EXCITED',
      'spotify',
      displayText
    );

    return res.status(200).json({
      success: true,
      now_playing: nowPlaying,
      reply: replyText,
      reply_display: displayText,
      mood: 'EXCITED',
      data: state
    });
  } catch (err) {
    console.error('Spotify API Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
};

module.exports.fetchCurrentlyPlayingTrack = fetchCurrentlyPlayingTrack;
