/**
 * Admin authentication: one password, scrypt-hashed in data/admin.json,
 * server-side sessions in memory, short-lived setup code printed on first run.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const COOKIE_NAME = 'atai_admin';
const SESSION_TTL = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const ATTEMPT_WINDOW = 15 * 60 * 1000;
const MIN_PASSWORD = 10;

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      out[key] = part.slice(index + 1).trim();
    }
  }
  return out;
}

export function createAuth({ dataDir }) {
  const file = path.join(dataDir, 'admin.json');
  const sessions = new Map();
  const attempts = new Map();
  const setupCode = process.env.ADMIN_SETUP_TOKEN || crypto.randomBytes(3).toString('hex').toUpperCase();

  function readRecord() {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  function hasPassword() {
    const record = readRecord();
    return Boolean(record && record.salt && record.hash);
  }

  function derive(password, salt) {
    return crypto.scryptSync(String(password), Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  }

  function passwordProblem(password, repeat) {
    const value = String(password ?? '');
    if (value.length < MIN_PASSWORD) return `Das Passwort muss mindestens ${MIN_PASSWORD} Zeichen lang sein.`;
    if (value.length > 200) return 'Das Passwort ist zu lang.';
    if (repeat !== undefined && value !== String(repeat ?? '')) return 'Die beiden Passwörter stimmen nicht überein.';
    return null;
  }

  function setPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      file,
      `${JSON.stringify({ salt, hash: derive(password, salt), updatedAt: new Date().toISOString() }, null, 2)}\n`,
      'utf8',
    );
  }

  function verify(password) {
    const record = readRecord();
    if (!record) return false;
    const candidate = Buffer.from(derive(password, record.salt), 'hex');
    const known = Buffer.from(record.hash, 'hex');
    return candidate.length === known.length && crypto.timingSafeEqual(candidate, known);
  }

  function tooManyAttempts(ip) {
    const now = Date.now();
    const hits = (attempts.get(ip) ?? []).filter((time) => now - time < ATTEMPT_WINDOW);
    attempts.set(ip, hits);
    return hits.length >= MAX_ATTEMPTS;
  }

  function recordAttempt(ip, success) {
    if (success) {
      attempts.delete(ip);
      return;
    }
    const now = Date.now();
    const hits = (attempts.get(ip) ?? []).filter((time) => now - time < ATTEMPT_WINDOW);
    hits.push(now);
    attempts.set(ip, hits);
    if (attempts.size > 1000) attempts.clear();
  }

  function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    const csrf = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { csrf, expiresAt: Date.now() + SESSION_TTL });
    if (sessions.size > 200) {
      const now = Date.now();
      for (const [key, value] of sessions) if (value.expiresAt < now) sessions.delete(key);
    }
    return { token, csrf, expiresAt: Date.now() + SESSION_TTL };
  }

  function sessionFrom(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { token, ...session };
  }

  function destroy(token) {
    if (token) sessions.delete(token);
  }

  /** End every session – used after a password change. */
  function destroyAll(exceptToken) {
    for (const token of [...sessions.keys()]) {
      if (token !== exceptToken) sessions.delete(token);
    }
  }

  function cookie(token, secure) {
    const parts = [
      `${COOKIE_NAME}=${token}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${Math.floor(SESSION_TTL / 1000)}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }

  function clearCookie(secure) {
    const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=0'];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }

  return {
    hasPassword,
    setPassword,
    verify,
    passwordProblem,
    tooManyAttempts,
    recordAttempt,
    createSession,
    sessionFrom,
    destroy,
    destroyAll,
    cookie,
    clearCookie,
    setupCode,
    minPassword: MIN_PASSWORD,
  };
}
