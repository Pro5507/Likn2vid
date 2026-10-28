const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const { ensureDir, makeTempFilePath } = require('../utils/fileHelpers');
const config = require('../config/env');

const tempDir = path.resolve(config.tempDir);
ensureDir(tempDir);

function sanitizeDimension(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) {
    return fallback;
  }

  return Math.round(parsed);
}

function sanitizeResolution(resolution) {
  if (!resolution || typeof resolution !== 'string') {
    return null;
  }

  const match = resolution.trim().match(/^(\d{2,4})x(\d{2,4})$/i);
  if (!match) {
    return null;
  }

  const width = sanitizeDimension(match[1], null);
  const height = sanitizeDimension(match[2], null);
  if (width === null || height === null) {
    return null;
  }

  return `${width}x${height}`;
}

function makeResult(filePath, outputFormat, fileName = 'converted-file') {
  return {
    success: true,
    outputFormat,
    filePath,
    fileName,
    downloadUrl: [`/api/files/${path.basename(filePath)}`],
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

async function convertImage(inputBuffer, inputExt, outputFormat, quality = 80, width, height) {
  const format = String(outputFormat || 'jpeg').toLowerCase().replace(/[^a-z]/g, '');
  const allowed = ['jpeg', 'png', 'webp'];
  if (!allowed.includes(format)) {
    throw new Error('Unsupported image output format.');
  }

  const qualityValue = Number(quality);
  const safeQuality = Number.isFinite(qualityValue) ? Math.min(Math.max(qualityValue, 1), 100) : 80;
  const safeWidth = sanitizeDimension(width, undefined);
  const safeHeight = sanitizeDimension(height, undefined);

  const outputPath = makeTempFilePath(tempDir, format);
  let transformer = sharp(inputBuffer)
    .rotate();

  if (safeWidth !== undefined || safeHeight !== undefined) {
    transformer = transformer.resize({ width: safeWidth, height: safeHeight, fit: 'inside', withoutEnlargement: true });
  }

  const pipeline = transformer.toFormat(format, { quality: safeQuality, compressionLevel: 6 });
  await pipeline.toFile(outputPath);

  return makeResult(outputPath, format, path.basename(outputPath));
}

async function convertVideo(inputPath, outputFormat, quality = 'medium', resolution = null) {
  const fmt = String(outputFormat || 'webm').toLowerCase().replace(/[^a-z]/g, '');
  const allowed = ['webm', 'mp4', 'gif'];
  if (!allowed.includes(fmt)) {
    throw new Error('Unsupported video output format.');
  }

  const qualityLevel = ['low', 'medium', 'high'].includes(String(quality).toLowerCase()) ? String(quality).toLowerCase() : 'medium';
  const safeResolution = sanitizeResolution(resolution);

  const outputPath = makeTempFilePath(tempDir, fmt);
  const args = [
    '-y',
    '-i', inputPath,
    '-loglevel', 'error',
  ];

  if (fmt === 'gif') {
    args.push('-vf', 'fps=10,scale=480:-1:flags=lanczos');
  }

  if (safeResolution) {
    args.push('-vf', `scale=${safeResolution}`);
  }

  if (fmt === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', qualityLevel === 'high' ? '30' : '35', '-b:v', '1M');
  } else if (fmt === 'mp4') {
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', qualityLevel === 'high' ? '18' : '23');
  }

  args.push(outputPath);

  await new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    process.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) resolve();
      else reject(new Error(`FFmpeg failed: ${stderr.slice(0, 300)}`));
    });
    process.on('error', reject);
  });

  return makeResult(outputPath, fmt, path.basename(outputPath));
}

module.exports = { convertImage, convertVideo, sanitizeResolution, sanitizeDimension };
