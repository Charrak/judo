import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import {
  buildMessage,
  contactNotification,
  decodeBase64Body,
  describeMailConfig,
  mailConfigFromEnv,
  sendMail,
} from '../src/lib/mail.mjs';
import { settingsPage } from '../src/server/views.mjs';

test('mail settings are only complete with host, sender and recipient', () => {
  assert.equal(mailConfigFromEnv({}), null);
  assert.equal(mailConfigFromEnv({ SMTP_HOST: 'smtp.example.com' }), null);
  assert.equal(mailConfigFromEnv({ SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', MAIL_TO: 'a@b.de' }).from, 'u');

  const secure = mailConfigFromEnv({ SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'w@x.de', MAIL_TO: 'a@b.de', SMTP_PORT: '465' });
  assert.equal(secure.secure, true);
  assert.equal(secure.port, 465);

  const plain = mailConfigFromEnv({ SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'w@x.de', MAIL_TO: 'a@b.de' });
  assert.equal(plain.secure, false);
  assert.equal(plain.port, 587);
});

test('the admin sees a readable status', () => {
  assert.deepEqual(describeMailConfig(null), { active: false, host: '', to: '' });
  const status = describeMailConfig(mailConfigFromEnv({ SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'w@x.de', MAIL_TO: 'a@b.de' }));
  assert.equal(status.active, true);
  assert.equal(status.host, 'smtp.example.com:587');
});

test('messages are UTF-8 safe and can be decoded again', () => {
  const message = buildMessage({
    from: 'Website <w@x.de>',
    to: 'a@b.de',
    subject: 'Neue Anfrage: Jürgen Müller (kids)',
    text: 'Zeile eins\nZeile zwei mit Umlauten: äöü',
  });
  assert.match(message, /^From: Website <w@x\.de>\r\nTo: a@b\.de\r\n/m);
  assert.match(message, /Subject: =\?UTF-8\?B\?/);
  assert.match(message, /Content-Type: text\/plain; charset=utf-8/);
  assert.match(message, /Message-ID: <[^>]+@atai-judo-academy\.com>/);
  assert.equal(decodeBase64Body(message), 'Zeile eins\nZeile zwei mit Umlauten: äöü');
});

test('html notifications become multipart messages', () => {
  const message = buildMessage({ from: 'w@x.de', to: 'a@b.de', subject: 'Test', text: 'Text', html: '<p>Text</p>' });
  assert.match(message, /multipart\/alternative; boundary="atai-[0-9a-f]+"/);
  assert.match(message, /Content-Type: text\/html; charset=utf-8/);
  assert.match(message, /^--atai-[0-9a-f]+--$/m);
});

test('the contact notification carries all relevant fields', () => {
  const { subject, text } = contactNotification(
    { name: 'Jürgen Müller', email: 'j@example.com', phone: '+971 50 111 22 33', interest: 'kids', message: 'Wir kommen gern vorbei.', lang: 'de', page: '/de/kontakt/' },
    { de: 'Deutsch' },
  );
  assert.equal(subject, 'Neue Anfrage: Jürgen Müller (kids)');
  for (const fragment of ['Jürgen Müller', 'j@example.com', '+971 50 111 22 33', 'kids', '/de/kontakt/', 'Wir kommen gern vorbei.', 'Deutsch']) {
    assert.ok(text.includes(fragment), `notification mentions ${fragment}`);
  }
});

test('the settings page explains both mail states', () => {
  const base = {
    site: { csrf: 'x', minPassword: 10, siteUrl: 'https://example.com' },
    languages: [{ code: 'de', nativeName: 'Deutsch' }],
    buildInfo: 'gerade eben',
    contentItems: 0,
  };
  const inactive = settingsPage({ ...base, mail: { active: false, host: '', to: '' } });
  assert.match(inactive, /Nicht eingerichtet/);
  assert.match(inactive, /SMTP_HOST/);

  const active = settingsPage({ ...base, mail: { active: true, host: 'smtp.example.com:587', to: 'info@example.com', lastSentAt: '', lastError: '' } });
  assert.match(active, /Jede Anfrage aus dem Kontaktformular/);
  assert.match(active, /info@example\.com/);
  assert.match(active, /noch keine Anfrage/);
});

/** A tiny SMTP server that records one conversation. */
async function fakeSmtpServer() {
  const received = { commands: [], data: '' };
  const server = net.createServer((socket) => {
    let buffer = '';
    let inData = false;
    socket.write('220 fake.local ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) return;
          received.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          socket.write('250 2.0.0 queued\r\n');
          continue;
        }
        const index = buffer.indexOf('\r\n');
        if (index === -1) return;
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        received.commands.push(line);
        if (line.startsWith('EHLO') || line.startsWith('HELO')) socket.write('250 fake.local\r\n');
        else if (line.startsWith('MAIL FROM')) socket.write('250 2.1.0 ok\r\n');
        else if (line.startsWith('RCPT TO')) socket.write('250 2.1.5 ok\r\n');
        else if (line === 'DATA') {
          inData = true;
          socket.write('354 end with <CRLF>.<CRLF>\r\n');
        } else if (line === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
        } else socket.write('250 ok\r\n');
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, received, port: server.address().port };
}

test('sendMail talks SMTP end to end', async () => {
  const { server, received, port } = await fakeSmtpServer();
  try {
    const config = { host: '127.0.0.1', port, user: '', pass: '', from: 'website@example.com', to: 'info@example.com', secure: false, timeout: 5000 };
    const result = await sendMail(config, { subject: 'Neue Anfrage: Test', text: 'Hallo aus dem Test.' });
    assert.equal(result.ok, true);

    assert.ok(received.commands.some((line) => line.startsWith('EHLO')), 'greets the server');
    assert.ok(received.commands.some((line) => line.startsWith('MAIL FROM:<website@example.com>')), 'names the sender');
    assert.ok(received.commands.some((line) => line.startsWith('RCPT TO:<info@example.com>')), 'names the recipient');
    assert.match(received.data, /Subject: =\?UTF-8\?B\?/);
    assert.equal(decodeBase64Body(received.data), 'Hallo aus dem Test.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('sendMail reports protocol errors instead of hanging', async () => {
  const server = net.createServer((socket) => socket.write('554 go away\r\n'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const config = { host: '127.0.0.1', port: server.address().port, user: '', pass: '', from: 'w@x.de', to: 'a@b.de', secure: false, timeout: 5000 };
    await assert.rejects(() => sendMail(config, { subject: 'Test', text: 'Text' }), /SMTP 554/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
