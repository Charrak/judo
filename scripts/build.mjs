#!/usr/bin/env node
/**
 * Static build.
 *
 * Reads the central dictionaries in src/i18n (plus the editable overrides in
 * content/texts) and emits one HTML document per language and route, the news
 * pages, the neutral language chooser, localized 404 pages, robots.txt and a
 * sitemap with hreflang annotations.
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
import {
  loadDictionaries,
  loadGallery,
  loadNews,
  newsArticleUrl,
  newsIndexUrl,
  isPublishable,
  viewNews,
} from '../src/lib/store.mjs';
import { renderDocument, renderRoot } from '../src/templates/layout.mjs';
import { render as renderHome } from '../src/templates/pages/home.mjs';
import { render as renderAbout } from '../src/templates/pages/about.mjs';
import { render as renderTraining } from '../src/templates/pages/training.mjs';
import { render as renderTeam } from '../src/templates/pages/team.mjs';
import { render as renderGallery } from '../src/templates/pages/gallery.mjs';
import { render as renderContact } from '../src/templates/pages/contact.mjs';
import { render as renderLegal } from '../src/templates/pages/legal.mjs';
import { render as renderNotFound } from '../src/templates/pages/not-found.mjs';
import { renderIndex as renderNewsIndex, renderArticle as renderNewsArticle } from '../src/templates/pages/news.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(rootDir, relative), 'utf8'));

const languagesConfig = readJson('src/config/languages.json');
const site = readJson('src/config/site.json');

const { dictionaries } = loadDictionaries(rootDir, languagesConfig);
const gallery = loadGallery(rootDir, { config: languagesConfig, dictionaries, site });
const newsItems = loadNews(rootDir);
const publishedNews = newsItems.filter((entry) => isPublishable(entry, languagesConfig));

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
// Build into a staging directory and swap it in at the end, so visitors never
// see a half-written site while the admin rebuilds.
const outDir = path.join(rootDir, '.dist-build');

function urlsFor(builder) {
  return Object.fromEntries(languagesConfig.languages.map((language) => [language.code, builder(language.code)]));
}

function makeCtx(langCode, route, pageUrls = null) {
  const language = getLanguage(languagesConfig, langCode);
  const { t, raw } = createTranslator(dictionaries[langCode], langCode);
  const urls = pageUrls ?? urlsFor((code) => urlFor(languagesConfig, code, route));

  return {
    t,
    raw,
    lang: langCode,
    language,
    route,
    config: languagesConfig,
    site,
    gallery,
    hasNews: publishedNews.length > 0,
    languages: languagesConfig.languages,
    urlFor: (code, key) => urlFor(languagesConfig, code, key),
    localeUrl: (code, key) => localeUrl(languagesConfig, code, key),
    pageUrl: (code) => urls[code] ?? urlFor(languagesConfig, code, route),
    newsUrl: (code, slug) => newsArticleUrl(languagesConfig, code, slug),
    image: (key) => {
      const image = site.images[key];
      if (!image) throw new Error(`Unknown image "${key}"`);
      return image;
    },
    year,
  };
}

function writeFile(relative, contents) {
  const target = path.join(outDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

/* --------------------------------------------------------------------- build */

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(path.join(rootDir, 'src/assets'), path.join(outDir, 'assets'), { recursive: true });

// Uploaded images are content, not source – they are copied in after the assets.
const uploadDir = path.join(rootDir, 'content/uploads');
if (fs.existsSync(uploadDir)) {
  fs.cpSync(uploadDir, path.join(outDir, 'assets/uploads'), { recursive: true });
}

let pageCount = 0;
for (const language of languagesConfig.languages) {
  for (const route of ROUTE_KEYS) {
    const ctx = makeCtx(language.code, route);
    const page = PAGE_RENDERERS[route](ctx);
    const html = renderDocument(ctx, page, { noindex: page.noindex === true });
    writeFile(path.join(language.code, language.slugs[route], 'index.html'), html);
    pageCount += 1;
  }
}

/* ---------------------------------------------------------------------- news */

const newsUrls = urlsFor((code) => newsIndexUrl(languagesConfig, code));
const allNews = languagesConfig.languages.map((language) => ({
  code: language.code,
  entries: publishedNews.map((entry) => viewNews(entry, languagesConfig, language.code)),
}));

for (const language of languagesConfig.languages) {
  const entries = allNews.find((item) => item.code === language.code).entries;
  const ctx = makeCtx(language.code, 'news', newsUrls);
  const page = renderNewsIndex(ctx, entries);
  writeFile(path.join(language.code, language.slugs.news, 'index.html'), renderDocument(ctx, page, { noindex: page.noindex === true }));
  pageCount += 1;

  for (const entry of entries) {
    const articleUrls = urlsFor((code) => newsArticleUrl(languagesConfig, code, entry.slug));
    const articleCtx = makeCtx(language.code, 'news', articleUrls);
    const related = entries.filter((item) => item.slug !== entry.slug).slice(0, 3);
    const article = renderNewsArticle(articleCtx, entry, related);
    writeFile(
      path.join(language.code, language.slugs.news, entry.slug, 'index.html'),
      renderDocument(articleCtx, article),
    );
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
writeFile('404.html', fs.readFileSync(path.join(outDir, defaultCode, '404.html'), 'utf8'));

/* ----------------------------------------------------------------------- SEO */

function standardAlternates(route) {
  return languagesConfig.languages
    .map(
      (entry) =>
        `    <xhtml:link rel="alternate" hreflang="${entry.code}" href="${localeUrl(languagesConfig, entry.code, route)}"/>`,
    )
    .join('\n');
}

const sitemapEntries = [];
for (const route of ROUTE_KEYS) {
  for (const language of languagesConfig.languages) {
    sitemapEntries.push(`  <url>
    <loc>${localeUrl(languagesConfig, language.code, route)}</loc>
${standardAlternates(route)}
    <xhtml:link rel="alternate" hreflang="x-default" href="${localeUrl(languagesConfig, defaultCode, route)}"/>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${route === 'home' ? 'monthly' : 'yearly'}</changefreq>
    <priority>${route === 'home' ? '1.0' : '0.7'}</priority>
  </url>`);
  }
}

if (publishedNews.length) {
  // news index
  for (const language of languagesConfig.languages) {
    const alternates = languagesConfig.languages
      .map(
        (entry) =>
          `    <xhtml:link rel="alternate" hreflang="${entry.code}" href="${localeUrl(languagesConfig, entry.code, 'news')}"/>`,
      )
      .join('\n');
    sitemapEntries.push(`  <url>
    <loc>${localeUrl(languagesConfig, language.code, 'news')}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${localeUrl(languagesConfig, defaultCode, 'news')}"/>
    <lastmod>${buildDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  for (const entry of publishedNews) {
    const lastmod = (entry.updatedAt || entry.date || buildDate).slice(0, 10);
    for (const language of languagesConfig.languages) {
      const alternates = languagesConfig.languages
        .map(
          (item) =>
            `    <xhtml:link rel="alternate" hreflang="${item.code}" href="${languagesConfig.siteUrl.replace(/\/$/, '')}${newsArticleUrl(
              languagesConfig,
              item.code,
              entry.slug,
            )}"/>`,
        )
        .join('\n');
      sitemapEntries.push(`  <url>
    <loc>${languagesConfig.siteUrl.replace(/\/$/, '')}${newsArticleUrl(languagesConfig, language.code, entry.slug)}</loc>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${languagesConfig.siteUrl.replace(/\/$/, '')}${newsArticleUrl(
        languagesConfig,
        defaultCode,
        entry.slug,
      )}"/>
    <lastmod>${lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>`);
    }
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
Disallow: /admin/

Sitemap: ${languagesConfig.siteUrl.replace(/\/$/, '')}/sitemap.xml
`,
);

writeFile('.nojekyll', '');

/* Swap the finished build into place. */
fs.rmSync(distDir, { recursive: true, force: true });
fs.renameSync(outDir, distDir);

console.log(
  `✓ Built ${pageCount + 1 + languagesConfig.languages.length} pages in ${languagesConfig.languages.length} languages` +
    (publishedNews.length ? ` (+${publishedNews.length} news posts)` : ''),
);
for (const language of languagesConfig.languages) {
  console.log(`  ${language.code}  ${urlFor(languagesConfig, language.code, 'home')}`);
}
console.log(`  → ${path.relative(rootDir, distDir)}/`);
