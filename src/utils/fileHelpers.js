const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function makeSafeFileName(originalName = 'output') {
  const safeBase = path.basename(originalName || 'output').replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${Date.now()}-${crypto.randomUUID()}-${safeBase || 'output'}`;
}

function makeTempFilePath(baseDir, extension = '') {
  const uniqueName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension ? `.${extension.replace(/^\./, '')}` : ''}`;
  return path.join(baseDir, uniqueName);
}

function sanitizeText(value) {
  return String(value || '').trim().slice(0, 200);
}

module.exports = { ensureDir, makeSafeFileName, makeTempFilePath, sanitizeText };
