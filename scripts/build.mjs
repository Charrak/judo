#!/usr/bin/env node
/**
 * Static build.
 *
 * Reads the central dictionaries in src/i18n and emits one HTML document per
 * language and route, plus the neutral language chooser, localized 404 pages,
 * robots.txt and a sitemap with hreflang annotations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ROUTE_KEYS,
  compareDictionaries,
  createTranslator,
  findLeftovers,
  getLanguage,
  localeUrl,
  urlFor,
} from '../src/lib/i18n.mjs';
import { renderDocument, renderRoot } from '../src/templates/layout.mjs';
import { render as renderHome } from '../src/templates/pages/home.mjs';
import { render as renderAbout } from '../src/templates/pages/about.mjs';
import { render as renderTraining } from '../src/templates/pages/training.mjs';
import { render as renderTeam } from '../src/templates/pages/team.mjs';
import { render as renderGallery } from '../src/templates/pages/gallery.mjs';
import { render as renderContact } from '../src/templates/pages/contact.mjs';
import { render as renderLegal } from '../src/templates/pages/legal.mjs';
import { render as renderNotFound } from '../src/templates/pages/not-found.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));

const languagesConfig = readJson('src/config/languages.json');
const site = readJson('src/config/site.json');

const dictionaries = Object.fromEntries(
  languagesConfig.languages.map((language) => [language.code, readJson(`src/i18n/${language.code}.json`)]),
);

const defaultCode = languagesConfig.defaultLanguage;
const otherCodes = languagesConfig.languages.map((language) => language.code).filter((code) => code !== defaultCode);
const referenceDict = dictionaries[defaultCode];
const others = Object.fromEntries(otherCodes.map((code) => [code, dictionaries[code]]));

/* ---------------------------------------------------------------- validation */

const problems = compareDictionaries(referenceDict, defaultCode, others);
const leftovers = otherCodes.flatMap((code) => findLeftovers(code, dictionaries[code]).map((hit) => `[${code}] ${hit}`));

if (problems.length) {
  console.error('✗ Translation keys are out of sync:');
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}
if (leftovers.length) {
  console.error('✗ Possible German leftovers found in translated copy:');
  for (const hit of leftovers) console.error(`  • ${hit}`);
  process.exit(1);
}

/* ------------------------------------------------------------------- helpers */

const PAGE_RENDERERS = {
  home: renderHome,
  about: renderAbout,
  training: renderTraining,
  team: renderTeam,
  gallery: renderGallery,
  contact: renderContact,
  legal: renderLegal,
};

const buildDate = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();
const distDir = path.join(rootDir, 'dist');

function makeCtx(langCode, route) {
  const language = getLanguage(languagesConfig, langCode);
  const { t, raw } = createTranslator(dictionaries[langCode], langCode);
  return {
    t,
    raw,
    lang: langCode,
    language,
    route,
    config: languagesConfig,
    site,
    languages: languagesConfig.languages,
    urlFor: (code, key) => urlFor(languagesConfig, code, key),
    localeUrl: (code, key) => localeUrl(languagesConfig, code, key),
    image: (key) => {
      const image = site.images[key];
      if (!image) throw new Error(`Unknown image "${key}"`);
      return image;
    },
    year,
  };
}

function writeFile(relative, contents) {
  const target = path.join(distDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

/* --------------------------------------------------------------------- build */

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.cpSync(path.join(rootDir, 'src/assets'), path.join(distDir, 'assets'), { recursive: true });

let pageCount = 0;
for (const language of languagesConfig.languages) {
  for (const route of ROUTE_KEYS) {
    const ctx = makeCtx(language.code, route);
    const page = PAGE_RENDERERS[route](ctx);
    const html = renderDocument(ctx, page);
    const slug = language.slugs[route];
    writeFile(path.join(language.code, slug, 'index.html'), html);
    pageCount += 1;
  }
}

// Neutral entry page (language chooser + redirect for returning visitors).
const rootCtx = makeCtx(defaultCode, 'home');
writeFile('index.html', renderRoot(rootCtx));

// Localized 404 pages. The server picks the one that matches the URL prefix.
for (const language of languagesConfig.languages) {
  const ctx = makeCtx(language.code, 'home');
  const html = renderDocument(ctx, renderNotFound(ctx), { noindex: true, bodyClass: 'is-404' });
  writeFile(path.join(language.code, '404.html'), html);
}
writeFile('404.html', fs.readFileSync(path.join(distDir, defaultCode, '404.html'), 'utf8'));

/* ----------------------------------------------------------------------- SEO */

const sitemapEntries = [];
for (const route of ROUTE_KEYS) {
  for (const language of languagesConfig.languages) {
    const alternates = languagesConfig.languages
      .map(
        (entry) =>
          `    <xhtml:link rel="alternate" hreflang="${entry.code}" href="${localeUrl(languagesConfig, entry.code, route)}"/>`,
      )
      .join('\n');
    sitemapEntries.push(`  <url>
    <loc>${localeUrl(languagesConfig, language.code, route)}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${localeUrl(languagesConfig, defaultCode, route)}"/>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${route === 'home' ? 'monthly' : 'yearly'}</changefreq>
    <priority>${route === 'home' ? '1.0' : '0.7'}</priority>
  </url>`);
  }
}

writeFile(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.join('\n')}
</urlset>
`,
);

writeFile(
  'robots.txt',
  `User-agent: *
Allow: /

Sitemap: ${languagesConfig.siteUrl.replace(/\/$/, '')}/sitemap.xml
`,
);

writeFile('.nojekyll', '');

console.log(`✓ Built ${pageCount + 1 + languagesConfig.languages.length} pages in ${languagesConfig.languages.length} languages`);
for (const language of languagesConfig.languages) {
  console.log(`  ${language.code}  ${urlFor(languagesConfig, language.code, 'home')}`);
}
console.log(`  → ${path.relative(rootDir, distDir)}/`);
