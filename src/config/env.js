require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  tempDir: process.env.TEMP_DIR || './storage/temp',
  maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE || 10 * 1024 * 1024),
  maxProcessingTimeMs: Number(process.env.MAX_PROCESSING_TIME_MS || 180000),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map((origin) => origin.trim()).filter(Boolean),
  allowedHosts: (process.env.ALLOWED_HOSTS || 'localhost,127.0.0.1').split(',').map((host) => host.trim()).filter(Boolean),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  enableSsrfBlock: process.env.ENABLE_SSRF_BLOCK !== 'false',
};

module.exports = config;
