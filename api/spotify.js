require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const { 
  recordInteraction, 
  setSpotifyRefreshToken, 
  getSpotifyRefreshToken 
} = require('../lib/store');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '8c7a75e146944dcb8a29a45a6b77766c';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'd479e32b181347feb5fd2810cbd3d127';
const HARDCODED_REFRESH_TOKEN = 'AQDsY1L1d5hfyfbxhbrNvcC9Q0pHvorGzBnwifcziPnlCSL7YWaWETOyG8SviTpUylhNTuDY2pb9NeXwVDGOVvezr8FKkcmqOviLf3ZaSD10xOcNf_gjTs0ukdjnE140mLo';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function getRedirectUri(req) {
  const host = (req.headers && req.headers.host) ? req.headers.host : 'lola-cypher-pet.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  
  if (req.query && req.query.uri_type === 'clean') {
    return `${protocol}://${host}/api/spotify`;
  }
  return `${protocol}://${host}/api/spotify/callback`;
}

function enforceEnglishScreenText(text, fallback = "Spotify Music!") {
  if (!text) return fallback;
  let clean = text.replace(/[^\x20-\x7E]/g, '').trim();
  if (clean.length === 0) return fallback;
  if (clean.length > 22) return clean.substring(0, 22);
  return clean;
}

async function getSpotifyAccessToken() {
  const storedToken = getSpotifyRefreshToken();
  if (storedToken === 'UNLINKED') {
    return null; // Explicitly unlinked
  }

  const refresh_token = storedToken || process.env.SPOTIFY_REFRESH_TOKEN || HARDCODED_REFRESH_TOKEN;

  if (!CLIENT_ID || !CLIENT_SECRET || !refresh_token || refresh_token === 'UNLINKED') {
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

    if (response.data.refresh_token) {
      setSpotifyRefreshToken(response.data.refresh_token);
    }

    return response.data.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error.response?.data || error.message);
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
    } else if (response.status === 204 || !response.data || !response.data.item) {
      return {
        isPlaying: false,
        trackName: "مفيش أغنية شغالة دلوقتي على سبوتيفاي",
        artistName: "Spotify"
      };
    }
  } catch (error) {
    console.error('Error fetching Spotify track:', error.response?.data || error.message);
  }

  return null;
}


const spotifyHandler = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query || {};
  const code = query.code;
  const action = query.action;
  const login = query.login;
  const setToken = query.token;
  const redirectUri = getRedirectUri(req);

  // Unlink Spotify handler
  if (action === 'unlink' || action === 'logout' || action === 'clear') {
    setSpotifyRefreshToken('UNLINKED');
    if (typeof res.json === 'function') {
      return res.status(200).json({ success: true, message: 'Spotify has been unlinked successfully!' });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: 'Spotify has been unlinked successfully!' }));
    }
  }

  if (setToken) {
    setSpotifyRefreshToken(setToken);
    return res.status(200).json({ success: true, message: 'Spotify Refresh Token saved!' });
  }

  if (action === 'login' || login === 'true') {
    const scope = 'user-read-currently-playing user-read-playback-state';
    const authUrl = 'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: scope,
        redirect_uri: redirectUri
      });

    if (typeof res.redirect === 'function') {
      return res.redirect(authUrl);
    } else {
      res.writeHead(302, { Location: authUrl });
      return res.end();
    }
  }

  if (code) {
    try {
      const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        querystring.stringify({
          code: code,
          redirect_uri: redirectUri,
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
        setSpotifyRefreshToken(refresh_token);
        console.log('NEW SPOTIFY REFRESH TOKEN SAVED:', refresh_token);
        
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Spotify Linked Successfully!</title>
            <style>
              body { font-family: sans-serif; background: #0d0d0d; color: #fff; text-align: center; padding: 50px; }
              .card { background: #141416; border: 1px solid #26262a; border-radius: 16px; padding: 30px; max-width: 500px; margin: auto; }
              h1 { color: #1DB954; }
              code { background: #222; padding: 12px; border-radius: 8px; display: block; word-break: break-all; margin: 20px 0; color: #FFD700; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>✅ Spotify Connected to Cypher Pet!</h1>
              <p>تم ربط حسابك في سبوتيفاي بنجاح مع Cypher Pet 🎉</p>
              <p>Your Refresh Token has been saved into memory!</p>
              <code>${refresh_token}</code>
            </div>
          </body>
          </html>
        `;
        if (typeof res.send === 'function') {
          return res.status(200).send(html);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
      }
    } catch (err) {
      console.error('Callback error:', err.message);
      if (typeof res.send === 'function') {
        return res.status(500).send('Error linking Spotify: ' + err.message);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Error linking Spotify: ' + err.message);
      }
    }
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

    if (typeof res.json === 'function') {
      return res.status(200).json({
        success: true,
        now_playing: nowPlaying,
        reply: replyText,
        reply_display: displayText,
        mood: 'EXCITED',
        data: state
      });
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        now_playing: nowPlaying,
        reply: replyText,
        reply_display: displayText,
        mood: 'EXCITED',
        data: state
      }));
    }
  } catch (err) {
    console.error('Spotify API Error:', err);
    if (typeof res.json === 'function') {
      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err.message
      });
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        message: err.message
      }));
    }
  }
};

module.exports = spotifyHandler;
module.exports.fetchCurrentlyPlayingTrack = fetchCurrentlyPlayingTrack;
