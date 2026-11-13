import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { flatten, interpolate, compareDictionaries, findLeftovers, urlFor, localeUrl } from '../src/lib/i18n.mjs';
import { config, dictionaries, ROOT } from './helpers.mjs';

const reference = dictionaries[config.defaultLanguage];
const others = Object.fromEntries(Object.entries(dictionaries).filter(([code]) => code !== config.defaultLanguage));

test('all five languages are configured', () => {
  assert.deepEqual(
    config.languages.map((language) => language.code),
    ['de', 'en', 'ar', 'fr', 'es'],
  );
  assert.equal(config.defaultLanguage, 'de');
});

test('only Arabic is right-to-left', () => {
  for (const language of config.languages) {
    assert.equal(language.dir, language.code === 'ar' ? 'rtl' : 'ltr', `direction of ${language.code}`);
  }
});

test('every language ships a flag file and a full slug set', () => {
  const routeKeys = Object.keys(config.languages[0].slugs).sort();
  assert.ok(routeKeys.length >= 7, 'slugs for every route');
  for (const language of config.languages) {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'src/assets/flags', `${language.flag}.svg`)),
      `flag ${language.flag}.svg exists`,
    );
    assert.deepEqual(Object.keys(language.slugs).sort(), routeKeys, `slug keys of ${language.code}`);
    for (const slug of Object.values(language.slugs)) {
      assert.match(slug, /^[a-z0-9-]*$/, `slug "${slug}" is url safe`);
    }
  }
});

test('all translation dictionaries carry the same keys', () => {
  assert.deepEqual(compareDictionaries(reference, config.defaultLanguage, others), []);
});

test('no translation value is empty', () => {
  for (const [code, dict] of Object.entries(dictionaries)) {
    for (const [key, value] of flatten(dict)) {
      if (typeof value !== 'string') continue;
      assert.ok(value.trim().length > 0, `[${code}] empty value at ${key}`);
    }
  }
});

test('placeholder tokens match the German original', () => {
  const tokens = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  const refPaths = flatten(reference);
  for (const [code, dict] of Object.entries(others)) {
    for (const [key, value] of flatten(dict)) {
      if (typeof value !== 'string') continue;
      const refValue = refPaths.get(key);
      if (typeof refValue !== 'string') continue;
      assert.deepEqual(tokens(value), tokens(refValue), `[${code}] placeholders at ${key}`);
    }
  }
});

test('no German leftovers in the other languages', () => {
  for (const [code, dict] of Object.entries(others)) {
    assert.deepEqual(findLeftovers(code, dict), [], `leftovers in ${code}`);
  }
});

test('seo titles stay inside the search result width', () => {
  for (const [code, dict] of Object.entries(dictionaries)) {
    for (const [key, value] of flatten(dict)) {
      if (!/\.meta\.title$/.test(key)) continue;
      assert.ok(value.length <= 65, `[${code}] ${key} is ${value.length} characters`);
      assert.ok(value.length >= 15, `[${code}] ${key} is too short`);
    }
  }
});

test('localized urls follow the slug table', () => {
  assert.equal(urlFor(config, 'de', 'home'), '/de/');
  assert.equal(urlFor(config, 'de', 'about'), '/de/ueber-uns/');
  assert.equal(urlFor(config, 'en', 'about'), '/en/about/');
  const ar = config.languages.find((language) => language.code === 'ar');
  assert.equal(urlFor(config, 'ar', 'contact'), `/ar/${ar.slugs.contact}/`);
  assert.equal(localeUrl(config, 'de', 'home'), `${config.siteUrl}/de/`);
  assert.throws(() => urlFor(config, 'de', 'does-not-exist'));
  assert.throws(() => urlFor(config, 'xx', 'home'));
});

test('interpolate keeps unknown tokens untouched', () => {
  assert.equal(interpolate('Hallo {name}, bis {day}', { name: 'Ali' }), 'Hallo Ali, bis {day}');
  assert.equal(interpolate('ohne Token', { name: 'Ali' }), 'ohne Token');
  assert.equal(interpolate(42, {}), 42);
});
