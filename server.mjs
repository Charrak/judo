#!/usr/bin/env node
/**
 * Zero-dependency production server for the static build.
 *
 *  • serves dist/ with sane cache headers
 *  • resolves the localized 404 page from the URL prefix
 *  • accepts contact requests via POST /api/contact (JSON or form encoded)
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, 'dist');
const dataDir = path.join(rootDir, 'data');
const messagesFile = path.join(dataDir, 'contact-messages.jsonl');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 32 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const LANGUAGE_PREFIXES = new Set(['de', 'en', 'ar', 'fr', 'es']);

/* ------------------------------------------------------------------ helpers */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.resolve(distDir, `.${decoded}`);
  if (resolved !== distDir && !resolved.startsWith(distDir + path.sep)) return null;
  return resolved;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* -------------------------------------------------------------- validation */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INTERESTS = new Set(['kids', 'youth', 'adults', 'trial', 'other']);

function validateMessage(payload) {
  const errors = {};
  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim();
  const message = String(payload.message ?? '').trim();
  const phone = String(payload.phone ?? '').trim();
  const consent = payload.consent === true || payload.consent === 'true' || payload.consent === 'on';

  if (name.length < 2 || name.length > 120) errors.name = 'invalid';
  if (!EMAIL.test(email) || email.length > 180) errors.email = 'invalid';
  if (message.length < 10 || message.length > 5000) errors.message = 'invalid';
  if (!consent) errors.consent = 'required';
  if (phone.length > 40) errors.phone = 'invalid';

  return {
    errors,
    record: {
      name,
      email,
      phone,
      interest: INTERESTS.has(payload.interest) ? payload.interest : 'other',
      message,
      lang: /^[a-z]{2}$/.test(String(payload.lang ?? '')) ? payload.lang : '',
      page: String(payload.page ?? '').slice(0, 200),
    },
  };
}

const rateLimit = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const hits = (rateLimit.get(ip) ?? []).filter((time) => now - time < windowMs);
  hits.push(now);
  rateLimit.set(ip, hits);
  if (rateLimit.size > 5000) rateLimit.clear();
  return hits.length > 8;
}

/* ------------------------------------------------------------------ routing */

async function handleContact(req, res) {
  const ip = req.socket.remoteAddress ?? 'unknown';
  if (isRateLimited(ip)) {
    sendJson(res, 429, { ok: false, errors: { generic: 'rate-limit' } });
    return;
  }

  let payload;
  try {
    const raw = await readBody(req);
    const type = String(req.headers['content-type'] ?? '');
    if (type.includes('application/json')) {
      payload = JSON.parse(raw || '{}');
    } else {
      payload = Object.fromEntries(new URLSearchParams(raw));
    }
  } catch (error) {
    sendJson(res, error.status ?? 400, { ok: false, errors: { generic: 'invalid' } });
    return;
  }

  // Honeypot: real people never fill this hidden field.
  if (payload.company) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const { errors, record } = validateMessage(payload);
  if (Object.keys(errors).length) {
    sendJson(res, 400, { ok: false, errors });
    return;
  }

  try {
    await fsp.mkdir(dataDir, { recursive: true });
    await fsp.appendFile(
      messagesFile,
      `${JSON.stringify({ ...record, receivedAt: new Date().toISOString() })}\n`,
      'utf8',
    );
  } catch (error) {
    console.error('[contact] could not persist message:', error.message);
    sendJson(res, 500, { ok: false, errors: { generic: 'storage' } });
    return;
  }

  console.log(`[contact] new request from ${record.email} (${record.lang || 'unknown language'})`);
  sendJson(res, 200, { ok: true });
}

async function serveFile(res, filePath, status = 200, req = null) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';
  const isHtml = ext === '.html';
  const headers = {
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=86400, must-revalidate',
  };

  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error('not a file');
    headers['Content-Length'] = stat.size;
    res.writeHead(status, headers);
    if (req && req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

async function serveNotFound(req, res, urlPath) {
  const segment = urlPath.split('/').filter(Boolean)[0];
  const language = LANGUAGE_PREFIXES.has(segment) ? segment : 'de';
  const localized = path.join(distDir, language, '404.html');
  const fallback = path.join(distDir, '404.html');
  const target = fs.existsSync(localized) ? localized : fallback;
  if (fs.existsSync(target)) {
    await serveFile(res, target, 404, req);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url ?? '/').split('?')[0];

  if (urlPath === '/api/contact') {
    if (req.method === 'POST') {
      await handleContact(req, res);
      return;
    }
    res.writeHead(405, { Allow: 'POST', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  const target = safePath(urlPath);
  if (!target) {
    await serveNotFound(req, res, urlPath);
    return;
  }

  if (urlPath.endsWith('/')) {
    const indexFile = path.join(target, 'index.html');
    if (fs.existsSync(indexFile)) {
      await serveFile(res, indexFile, 200, req);
    } else {
      await serveNotFound(req, res, urlPath);
    }
    return;
  }

  const ext = path.extname(urlPath);
  if (!ext) {
    // /de/about -> /de/about/
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      res.writeHead(301, { Location: `${urlPath}/` });
      res.end();
      return;
    }
    const withIndex = path.join(target, 'index.html');
    if (fs.existsSync(withIndex)) {
      res.writeHead(301, { Location: `${urlPath}/` });
      res.end();
      return;
    }
  }

  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    await serveFile(res, target, 200, req);
    return;
  }

  await serveNotFound(req, res, urlPath);
});

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('✗ dist/ is empty. Run `npm run build` first.');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`ATAI JUDO ACADEMY running on http://${HOST}:${PORT}`);
  console.log(`Languages: /de/ /en/ /ar/ /fr/ /es/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
