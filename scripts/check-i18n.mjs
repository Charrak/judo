#!/usr/bin/env node
/**
 * Translation guard.
 *
 * Fails when
 *   • a key exists in the German source but not in another language (or vice versa)
 *   • list lengths or value types drift apart
 *   • German leftovers were found in a translated dictionary
 *
 * Run it before every deployment: `npm run check:i18n`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compareDictionaries, createTranslator, findLeftovers, flatten } from '../src/lib/i18n.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));

const config = readJson('src/config/languages.json');
const defaultCode = config.defaultLanguage;
const dictionaries = Object.fromEntries(
  config.languages.map((language) => [language.code, readJson(`src/i18n/${language.code}.json`)]),
);

const others = Object.fromEntries(
  config.languages.filter((language) => language.code !== defaultCode).map((language) => [language.code, dictionaries[language.code]]),
);

const problems = compareDictionaries(dictionaries[defaultCode], defaultCode, others);
const leftovers = config.languages
  .filter((language) => language.code !== defaultCode)
  .flatMap((language) =>
    findLeftovers(language.code, dictionaries[language.code]).map((hit) => `[${language.code}] ${hit}`),
  );

const referenceCount = flatten(dictionaries[defaultCode]).size;

console.log('Translation status');
console.log('------------------');
for (const language of config.languages) {
  const count = flatten(dictionaries[language.code]).size;
  const share = ((count / referenceCount) * 100).toFixed(0);
  const dir = language.dir.toUpperCase();
  console.log(
    `${language.code}  ${language.nativeName.padEnd(10)} ${dir}  ${String(count).padStart(4)} keys (${share} %)`,
  );
}

// Every language must be able to render all page titles and descriptions.
for (const language of config.languages) {
  const { t } = createTranslator(dictionaries[language.code], language.code);
  for (const route of ['home', 'about', 'training', 'team', 'gallery', 'contact', 'legal']) {
    t(`pages.${route}.meta.title`);
    t(`pages.${route}.meta.description`);
  }
}

if (leftovers.length) {
  console.error('\n✗ Possible German leftovers:');
  for (const hit of leftovers) console.error(`  • ${hit}`);
}

if (problems.length) {
  console.error('\n✗ Dictionaries are out of sync:');
  for (const problem of problems) console.error(`  • ${problem}`);
}

if (problems.length || leftovers.length) {
  process.exit(1);
}

console.log('\n✓ All languages complete and in sync.');
