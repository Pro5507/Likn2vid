const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { z } = require('zod');
const { validateRemoteAccess } = require('./src/security/ssrf');
const { apiLimiter, uploadLimiter, parseHostMiddleware, validateRequestUrl } = require('./src/middleware/security');
const { convertImage, convertVideo } = require('./src/services/mediaService');
const config = require('./src/config/env');
const { ensureDir, makeTempFilePath } = require('./src/utils/fileHelpers');

const app = express();
const storageDir = path.resolve(config.tempDir);
ensureDir(storageDir);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storageDir),
    filename: (_req, file, cb) => {
      const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname || '.bin')}`;
      cb(null, fileName);
    },
  }),
  limits: { fileSize: Number(config.maxUploadSize || 10 * 1024 * 1024) },
});

const sourceCatalog = [
  { name: 'direct-image', supported: ['http', 'https'], formats: ['png', 'jpeg', 'webp'], notes: 'Verified direct URLs that are accessible and authorized by the content owner.' },
  { name: 'direct-video', supported: ['http', 'https'], formats: ['mp4', 'webm', 'mov'], notes: 'Remote downloads are only allowed for approved and explicitly authorized sources.' },
  { name: 'custom-api', supported: ['http', 'https'], formats: ['various'], notes: 'Requires configured provider credentials and authorization details.' },
];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(parseHostMiddleware);
app.use(apiLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'MediaFlow', version: '1.0.0', environment: config.nodeEnv });
});

app.get('/api/ready', (_req, res) => {
  res.json({ ready: true, checks: ['temp-dir', 'ffmpeg', 'sharp'] });
});

app.get('/api/sources', (_req, res) => {
  res.json({ sources: sourceCatalog });
});

app.post('/api/media/inspect', validateRequestUrl, async (req, res) => {
  const schema = z.object({
    url: z.string().url({ protocol_url: true }),
  });

  try {
    const parsed = schema.parse(req.body);
    const validated = await validateRemoteAccess(parsed.url);
    if (!validated.valid) {
      return res.status(400).json({ error: validated.reason });
    }
    return res.json({ ok: true, url: parsed.url, hostname: validated.parsed.hostname, ips: validated.addresses || [] });
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL payload.' });
  }
});

app.post('/api/media/download', validateRequestUrl, async (req, res) => {
  const schema = z.object({
    url: z.string().url({ protocol_url: true }),
  });

  try {
    const parsed = schema.parse(req.body);
    const validated = await validateRemoteAccess(parsed.url);
    if (!validated.valid) {
      return res.status(400).json({ error: validated.reason });
    }
    return res.json({ ok: true, message: 'Remote URL inspection passed. This app only supports explicitly authorized sources.', url: parsed.url });
  } catch (error) {
    return res.status(400).json({ error: 'Download request rejected.' });
  }
});

app.post('/api/convert/image', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required.' });
  }

  const format = String(req.body.outputFormat || 'jpeg').toLowerCase().replace(/[^a-z]/g, '');
  const quality = Number(req.body.quality || 80);
  const width = req.body.width !== undefined && req.body.width !== null && req.body.width !== '' ? Number(req.body.width) : undefined;
  const height = req.body.height !== undefined && req.body.height !== null && req.body.height !== '' ? Number(req.body.height) : undefined;

  if (!['jpeg', 'png', 'webp'].includes(format)) {
    return res.status(400).json({ error: 'Unsupported image output format.' });
  }

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const result = await convertImage(fileBuffer, path.extname(req.file.originalname), format, quality, width, height);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Image conversion failed.' });
  }
});

app.post('/api/convert/video', uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Video file is required.' });
  }

  const format = String(req.body.outputFormat || 'webm').toLowerCase().replace(/[^a-z]/g, '');
  const quality = String(req.body.quality || 'medium').toLowerCase();
  const resolution = typeof req.body.resolution === 'string' ? req.body.resolution.trim() : req.body.resolution || null;

  if (!['webm', 'mp4', 'gif'].includes(format)) {
    return res.status(400).json({ error: 'Unsupported video output format.' });
  }

  if (quality && !['low', 'medium', 'high'].includes(quality)) {
    return res.status(400).json({ error: 'Unsupported video quality setting.' });
  }

  try {
    const result = await convertVideo(req.file.path, format, quality, resolution);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Video conversion failed.' });
  }
});

app.get('/api/jobs/:id', (_req, res) => {
  res.json({ job: { id: _req.params.id, status: 'completed' } });
});

app.post('/api/jobs/:id/cancel', (_req, res) => {
  res.json({ jobId: _req.params.id, cancelled: true });
});

app.get('/api/files/:id', (req, res) => {
  const cleanId = String(req.params.id).replace(/\.+/g, '').replace(/\//g, '');
  const filePath = path.join(storageDir, cleanId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  return res.download(filePath);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found.' });
  }
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`MediaFlow running on http://localhost:${config.port}`);
  });
}

module.exports = app;
