const { setJoystick, getMoodState } = require('../lib/store');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { left, right } = req.body || {};
    setJoystick(left, right);
    return res.status(200).json({ success: true, joystick: { left, right } });
  }

  if (req.method === 'GET') {
    const currentState = getMoodState();
    return res.status(200).json({ joystick: currentState.joystick });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
