const jwt = require('jsonwebtoken');

const COOKIE = 'nudgepay_token';

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function setAuthCookie(res, userId) {
  res.cookie(COOKIE, signToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
}

module.exports = { requireAuth, setAuthCookie, COOKIE };
