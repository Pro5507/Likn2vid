const fs = require('fs');
const path = require('path');
const request = require('supertest');
const sharp = require('sharp');
const { spawnSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const app = require('../../server');

const tmpDir = path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(tmpDir, { recursive: true });

const createPngFixture = async () => {
  const filePath = path.join(tmpDir, 'sample.png');
  await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toFile(filePath);
  return filePath;
};

const createVideoFixture = () => {
  const filePath = path.join(tmpDir, 'sample.mp4');
  const result = spawnSync(ffmpegPath, [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=blue:s=64x64:d=1',
    '-vf', 'format=yuv420p',
    '-t', '1',
    '-pix_fmt', 'yuv420p',
    filePath,
  ], { encoding: 'utf8' });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with ${result.status}: ${result.stderr}`);
  }

  return filePath;
};

describe('MediaFlow API', () => {
  jest.setTimeout(30000);
  let pngPath;
  let videoPath;

  beforeAll(async () => {
    pngPath = await createPngFixture();
    videoPath = await createVideoFixture();
  });

  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('POST /api/convert/image converts png to jpeg', async () => {
    const res = await request(app)
      .post('/api/convert/image')
      .attach('file', pngPath)
      .field('outputFormat', 'jpeg')
      .field('quality', '80');

    expect(res.status).toBe(200);
    expect(res.body.outputFormat).toBe('jpeg');
    expect(Array.isArray(res.body.downloadUrl)).toBe(true);
  });

  test('POST /api/convert/video converts mp4 to webm', async () => {
    const res = await request(app)
      .post('/api/convert/video')
      .attach('file', videoPath)
      .field('outputFormat', 'webm')
      .field('quality', 'medium');

    expect(res.status).toBe(200);
    expect(res.body.outputFormat).toBe('webm');
    expect(Array.isArray(res.body.downloadUrl)).toBe(true);
  });

  test('POST /api/media/inspect rejects malformed URL', async () => {
    const res = await request(app)
      .post('/api/media/inspect')
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
  });
});
