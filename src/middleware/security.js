const rateLimit = require('express-rate-limit');
const { validateUrl } = require('../security/ssrf');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded.' },
});

function normalizeHostHeader(hostHeader) {
  if (!hostHeader) return 'localhost';
  const trimmed = String(hostHeader).trim();
  const ipv6Match = trimmed.match(/^\[(.*)\](?::\d+)?$/);
  if (ipv6Match) {
    return ipv6Match[1];
  }

  const portIndex = trimmed.lastIndexOf(':');
  if (portIndex > -1 && trimmed.indexOf(':') === portIndex) {
    return trimmed.slice(0, portIndex);
  }

  return trimmed.split(':')[0];
}

function parseHostMiddleware(req, res, next) {
  const host = normalizeHostHeader(req.get('host') || 'localhost');
  const allowedHosts = ['localhost', '127.0.0.1', '::1'];
  if (process.env.NODE_ENV === 'production' && !allowedHosts.includes(host)) {
    return res.status(400).json({ error: 'Unsupported host.' });
  }
  next();
}

function validateRequestUrl(req, res, next) {
  const url = req.body?.url || req.query?.url;
  if (!url) return next();
  const result = validateUrl(url);
  if (!result.valid) {
    return res.status(400).json({ error: result.reason });
  }
  next();
}

module.exports = { apiLimiter, uploadLimiter, parseHostMiddleware, validateRequestUrl, normalizeHostHeader };
