import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { config, DIST, ROOT } from './helpers.mjs';
import { urlFor } from '../src/lib/i18n.mjs';

/** Rebuild once so the assertions always describe the current sources. */
test.before(() => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, stdio: 'pipe' });
});

const html = (relative) => fs.readFileSync(path.join(DIST, relative), 'utf8');

test('the build writes the language chooser and one folder per language', () => {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'root chooser');
  for (const language of config.languages) {
    assert.ok(fs.existsSync(path.join(DIST, language.code, 'index.html')), `start page of ${language.code}`);
  }
});

test('every page states its language and text direction', () => {
  for (const language of config.languages) {
    const page = html(path.join(language.code, 'index.html'));
    assert.match(page, new RegExp(`<html lang="${language.code}" dir="${language.dir}"`), `html tag of ${language.code}`);
  }
});

test('every page links all languages plus x-default', () => {
  for (const language of config.languages) {
    const page = html(path.join(language.code, 'index.html'));
    for (const entry of config.languages) {
      assert.match(
        page,
        new RegExp(`<link rel="alternate" hreflang="${entry.code}" href="${config.siteUrl}${urlFor(config, entry.code, 'home')}"`),
        `${language.code} page links ${entry.code}`,
      );
    }
    assert.match(page, /hreflang="x-default"/, `x-default in ${language.code}`);
  }
});

test('the canonical url points at the page itself', () => {
  for (const language of config.languages) {
    const route = 'training';
    const page = html(path.join(language.code, language.slugs[route], 'index.html'));
    assert.match(
      page,
      new RegExp(`<link rel="canonical" href="${config.siteUrl}${urlFor(config, language.code, route)}"`),
      `canonical of ${language.code} ${route}`,
    );
  }
});

test('arabic pages are right-to-left and untouched images stay unmirrored', () => {
  const page = html('ar/index.html');
  assert.match(page, /dir="rtl"/);
  const css = fs.readFileSync(path.join(DIST, 'assets/styles.css'), 'utf8');
  assert.doesNotMatch(css, /html\[dir='rtl'\][^{]*\bimg\b[^{]*\{[^}]*transform:\s*scaleX\(-1\)/, 'images are never mirrored');
});

test('the admin area is hidden from search engines', () => {
  const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Sitemap: https:\/\//);
});

test('the sitemap lists every language with hreflang annotations', () => {
  const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  for (const language of config.languages) {
    assert.match(sitemap, new RegExp(`<loc>${config.siteUrl}${urlFor(config, language.code, 'home')}</loc>`));
    assert.match(sitemap, new RegExp(`hreflang="${language.code}"`));
  }
});

test('assets referenced by the pages exist', () => {
  const flags = config.languages.map((language) => `assets/flags/${language.flag}.svg`);
  for (const relative of ['assets/styles.css', 'assets/app.js', 'assets/logo.svg', ...flags]) {
    assert.ok(fs.existsSync(path.join(DIST, relative)), relative);
  }
  const page = html('de/index.html');
  assert.doesNotMatch(page, /src="\/assets\/[^"]+\.(jpg|png)"\s+src=/, 'no duplicated src attributes');
});

test('no admin code or uploads leak into the published build', () => {
  assert.ok(!fs.existsSync(path.join(DIST, 'admin')), 'no /admin/ folder in dist');
  assert.ok(!fs.existsSync(path.join(DIST, 'assets/admin.js')), 'no admin bundle in dist');
});
