/**
 * Minimaler SMTP-Versand ohne Fremdbibliothek.
 *
 * Wird nur benutzt, wenn die Umgebung konfiguriert ist:
 *   SMTP_HOST, SMTP_PORT (465 = TLS, sonst STARTTLS wenn angeboten),
 *   SMTP_USER, SMTP_PASS, SMTP_FROM, MAIL_TO
 *
 * Fehlt etwas, gibt es keine Benachrichtigung – das Kontaktformular
 * funktioniert unverändert, die Anfrage liegt im Postfach der Verwaltung.
 */
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

const DEFAULT_TIMEOUT = 12_000;

/** Reads the mail settings from the environment, or null when incomplete. */
export function mailConfigFromEnv(env = process.env) {
  const host = String(env.SMTP_HOST ?? '').trim();
  const to = String(env.MAIL_TO ?? '').trim();
  const user = String(env.SMTP_USER ?? '').trim();
  const pass = String(env.SMTP_PASS ?? '');
  const from = String(env.SMTP_FROM ?? '').trim() || (user ? `${user}` : '');
  if (!host || !to || !from) return null;
  const port = Number(env.SMTP_PORT ?? 587) || 587;
  return { host, port, user, pass, from, to, secure: port === 465, timeout: Number(env.SMTP_TIMEOUT) || DEFAULT_TIMEOUT };
}

/** Short human readable status for the admin settings page. */
export function describeMailConfig(config) {
  if (!config) return { active: false, host: '', to: '' };
  return { active: true, host: `${config.host}:${config.port}`, to: config.to };
}

const encodeWord = (value) => `=?UTF-8?B?${Buffer.from(String(value), 'utf8').toString('base64')}?=`;

const base64Body = (value) =>
  Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n');

/** Builds a complete RFC 5322 message with UTF-8 safe headers and bodies. */
export function buildMessage({ from, to, subject, text, html = '', date = new Date(), messageId }) {
  const id = messageId || `<${crypto.randomUUID()}@atai-judo-academy.com>`;
  const boundary = `atai-${crypto.randomBytes(8).toString('hex')}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
  ];

  if (!html) {
    return [
      ...headers,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Body(text),
    ].join('\r\n');
  }

  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Body(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/** Undoes SMTP dot-stuffing so tests and logs see the plain body. */
export function decodeBase64Body(message) {
  const match = String(message).match(/Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)/);
  if (!match) return '';
  return Buffer.from(match[1].replace(/\s+/g, ''), 'base64').toString('utf8');
}

function readReply(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      // multi-line replies end with "250 <text>" (space), not "250-<text>"
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve({ code: Number(last.slice(0, 3)), lines });
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };
    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function command(socket, line, expect = [250, 220, 235, 354]) {
  if (line !== null) socket.write(`${line}\r\n`);
  const reply = await readReply(socket);
  if (!expect.includes(reply.code)) {
    throw new Error(`SMTP ${reply.code}: ${reply.lines.join(' / ')}`);
  }
  return reply;
}

/**
 * Sends one message. Rejects on any protocol error; the caller decides what to do.
 */
export async function sendMail(config, { subject, text, html = '' }) {
  if (!config) throw new Error('SMTP ist nicht konfiguriert.');

  const socket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });
  socket.setTimeout(config.timeout ?? DEFAULT_TIMEOUT);
  socket.on('timeout', () => socket.destroy(new Error('SMTP: Zeitüberschreitung.')));

  let active = socket;
  try {
    await new Promise((resolve, reject) => {
      active.once(config.secure ? 'secureConnect' : 'connect', resolve);
      active.once('error', reject);
    });

    await command(active, null, [220]);
    const helo = await command(active, 'EHLO atai-judo-academy.com');

    if (!config.secure && helo.lines.some((line) => /STARTTLS/i.test(line))) {
      await command(active, 'STARTTLS', [220]);
      active = tls.connect({ socket: active, servername: config.host });
      await new Promise((resolve, reject) => {
        active.once('secureConnect', resolve);
        active.once('error', reject);
      });
      await command(active, 'EHLO atai-judo-academy.com');
    }

    if (config.user) {
      const token = Buffer.from(`\0${config.user}\0${config.pass}`, 'utf8').toString('base64');
      await command(active, `AUTH PLAIN ${token}`, [235]);
    }

    await command(active, `MAIL FROM:<${addressOf(config.from)}>`, [250]);
    for (const recipient of config.to.split(',').map((value) => value.trim()).filter(Boolean)) {
      await command(active, `RCPT TO:<${addressOf(recipient)}>`, [250, 251]);
    }
    await command(active, 'DATA', [354]);

    const message = buildMessage({ from: config.from, to: config.to, subject, text, html });
    // dot-stuffing per RFC 5321
    await command(active, `${message.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..')}\r\n.`, [250]);
    socket.write('QUIT\r\n');
    active.end();
    return { ok: true, subject };
  } finally {
    active.destroy();
    if (active !== socket) socket.destroy();
  }
}

function addressOf(value) {
  const match = String(value).match(/<([^>]+)>/);
  return (match ? match[1] : String(value)).trim();
}

/** German notification for a contact form submission. */
export function contactNotification(record, languages = {}) {
  const language = languages[record.lang] || record.lang || 'unbekannt';
  const lines = [
    `Neue Anfrage über das Kontaktformular (${language}).`,
    '',
    `Name:      ${record.name}`,
    `E-Mail:    ${record.email}`,
    record.phone ? `Telefon:   ${record.phone}` : '',
    `Interesse: ${record.interest}`,
    record.page ? `Seite:     ${record.page}` : '',
    '',
    'Nachricht:',
    record.message,
    '',
    `Zeitpunkt: ${new Date().toLocaleString('de-DE', { timeZone: 'Asia/Dubai' })} (Ortszeit Abu Dhabi)`,
  ].filter((line) => line !== '');
  const text = lines.join('\n');
  const subject = `Neue Anfrage: ${record.name}${record.interest ? ` (${record.interest})` : ''}`;
  return { subject, text };
}
