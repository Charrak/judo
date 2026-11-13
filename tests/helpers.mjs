/** Shared helpers for the test suite: paths, config and dictionary loading. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');

export function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

export const config = readJson('src/config/languages.json');

export const dictionaries = Object.fromEntries(
  config.languages.map((language) => [language.code, readJson(`src/i18n/${language.code}.json`)]),
);

export function distFile(relative) {
  return path.join(DIST, relative);
}

export function readDist(relative) {
  return fs.readFileSync(distFile(relative), 'utf8');
}
