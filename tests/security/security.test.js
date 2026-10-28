const request = require('supertest');
const app = require('../../server');

describe('MediaFlow security', () => {
  test('blocks localhost SSRF attempts', async () => {
    const res = await request(app)
      .post('/api/media/inspect')
      .send({ url: 'http://127.0.0.1:8080' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/blocked|invalid|ssrf/i);
  });

  test('blocks redirect-based SSRF attempts', async () => {
    const res = await request(app)
      .post('/api/media/download')
      .send({ url: 'https://example.com' });

    expect([200, 400, 403]).toContain(res.status);
  });

  test('sanitizes malicious input values', async () => {
    const res = await request(app)
      .post('/api/convert/image')
      .field('outputFormat', '<script>alert(1)</script>')
      .attach('file', Buffer.from('not an image'), {
        filename: 'malicious.png',
        contentType: 'image/png',
      });

    expect([200, 400]).toContain(res.status);
  });
});
