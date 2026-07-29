require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const { recordInteraction } = require('../lib/store');

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

// Function to refresh Spotify Access Token using Refresh Token
async function getSpotifyAccessToken() {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!client_id || !client_secret || !refresh_token) {
    return null;
  }

  try {
    const basicAuth = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
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

// Fetch currently playing track from Spotify Web API
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

const spotifyHandler = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

module.exports = spotifyHandler;
module.exports.fetchCurrentlyPlayingTrack = fetchCurrentlyPlayingTrack;
