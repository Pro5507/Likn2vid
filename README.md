# MediaFlow

MediaFlow is a security-first media downloader and converter designed for controlled deployment. It supports local uploads for image and video conversion, plus remote URL inspection with strict SSRF validation.

## Features

- Secure Node.js/Express backend
- Media conversion for PNG/JPEG/WebP and MP4/WebM/GIF
- File upload and inspection APIs
- Threat-focused validation for URL and file handling
- Lightweight frontend with light/dark theme

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and adjust values.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

## Production guidance

- Use a reverse proxy like Nginx or Cloudflare to terminate TLS.
- Run behind HTTPS and set trusted proxy configuration in the deployment environment.
- Do not expose a raw dev server publicly.

## Security notes

- SSRF protections reject localhost, private IPs, metadata endpoints, and other unsafe destinations.
- The app does not implement arbitrary public remote media fetching without authorization and validation.
- Temporary files are stored under the configured temp directory and should be cleaned by the deployment environment.

## Scripts

- `npm test` — run the Jest suite
- `npm run dev` — run the app in watch mode
- `npm start` — start the production app
