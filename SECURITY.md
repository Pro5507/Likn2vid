# Security overview

MediaFlow follows a layered Z+ defense model designed to protect the public app, file conversion workflow, and deployment environment. This document summarizes the threat model and major controls in place.

## Threat model

The primary risks are SSRF, malicious files, unauthorized access to output files, excessive resource use, and unsafe deployment configuration.

## Controls

- Request validation and rate limiting at the API edge.
- Strict URL validation and DNS-based IP checks for remote URL inspection.
- File conversion only for allowlisted formats.
- Temporary files stored in a controlled temp directory.
- Security headers and CORS configuration.
- No hardcoded production admin credentials.

## Limitations

This app is designed for a controlled internal or staging deployment. Public deployments must still use a reverse proxy, TLS, and secure infrastructure controls outside the Node process itself.
