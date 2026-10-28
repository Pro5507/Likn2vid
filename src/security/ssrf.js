const net = require('net');
const dns = require('dns');
const { URL } = require('url');

const BLOCKLIST = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google',
  'metadata.azure.internal',
  '169.254.170.2',
]);

function normalizeHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return '';
  }

  return hostname.trim().replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function isPrivateOrReserved(ip) {
  if (!ip || typeof ip !== 'string') return false;

  const normalized = normalizeHostname(ip).replace(/%[0-9a-zA-Z_.-]+$/, '') || ip.trim();
  if (!normalized) return false;

  const ipv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) {
    return isPrivateOrReserved(ipv4Mapped[1]);
  }

  if (normalized === '::1' || normalized === '::' || normalized === '127.0.0.1' || normalized === '0.0.0.0') return true;

  if (net.isIP(normalized) === 4) {
    const parts = normalized.split('.').map(Number);
    const first = parts[0];
    const second = parts[1] ?? 0;
    return first === 10 || first === 127 || first === 0 || (first >= 224 && first <= 255) || (first === 169 && second === 254) || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31);
  }

  if (net.isIP(normalized) === 6) {
    const lower = normalized.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:');
  }

  return false;
}

function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, reason: 'URL is required.' };
  }

  const trimmed = urlString.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  const schemes = ['http:', 'https:'];
  if (!schemes.includes(parsed.protocol)) {
    return { valid: false, reason: 'Only http and https URLs are allowed.' };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname) {
    return { valid: false, reason: 'Localhost destinations are blocked.' };
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'localhost.localdomain') {
    return { valid: false, reason: 'Localhost destinations are blocked.' };
  }

  if (BLOCKLIST.has(hostname) || (parsed.hostname && BLOCKLIST.has(normalizeHostname(parsed.hostname)))) {
    return { valid: false, reason: 'Blocked destination host.' };
  }

  if (net.isIP(hostname) !== 0 && isPrivateOrReserved(hostname)) {
    return { valid: false, reason: 'Private or reserved IP address blocked.' };
  }

  return { valid: true, parsed };
}

function lookupHostname(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return reject(err);
      resolve(addresses.map((entry) => entry.address));
    });
  });
}

async function validateRemoteAccess(urlString) {
  const result = validateUrl(urlString);
  if (!result.valid) return result;

  const hostname = normalizeHostname(result.parsed.hostname);
  try {
    const addresses = net.isIP(hostname) !== 0 ? [hostname] : await lookupHostname(hostname);
    if (!addresses.length) {
      return { valid: false, reason: 'DNS resolution produced no addresses.' };
    }

    for (const address of addresses) {
      if (isPrivateOrReserved(address)) {
        return { valid: false, reason: 'Private or reserved IP address blocked.' };
      }
    }

    return { valid: true, parsed: result.parsed, addresses };
  } catch (error) {
    return { valid: false, reason: 'Remote host lookup failed or is restricted.' };
  }
}

module.exports = { validateUrl, validateRemoteAccess, isPrivateOrReserved, normalizeHostname };
