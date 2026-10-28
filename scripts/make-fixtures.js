const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const fixtureDir = path.join(__dirname, '..', 'tests', 'fixtures');
fs.mkdirSync(fixtureDir, { recursive: true });

(async () => {
  const pngPath = path.join(fixtureDir, 'sample.png');
  await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  }).png().toFile(pngPath);

  const mp4Path = path.join(fixtureDir, 'sample.mp4');
  const result = spawnSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=blue:s=64x64:d=1',
    '-vf', 'format=yuv420p',
    '-t', '1',
    '-pix_fmt', 'yuv420p',
    mp4Path,
  ], {
    encoding: 'utf8',
  });

  if (result.error) {
    console.error('FFmpeg fixture creation failed:', result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('ffmpeg stderr:', result.stderr || '');
    process.exit(1);
  }

  console.log('Generated fixtures:', pngPath, mp4Path);
})();
