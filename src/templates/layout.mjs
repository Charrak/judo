import { esc } from '../lib/html.mjs';
import { localeUrl, urlFor } from '../lib/i18n.mjs';
import { icon } from '../lib/html.mjs';
import { siteHeader, siteFooter, welcomeOverlay, lightbox, venueLine } from './components.mjs';

export const STORAGE_KEY = 'atai.lang';
export const SWITCH_FLAG = 'atai.switch';

function headScript(ctx, urls) {
  const map = JSON.stringify(urls).replace(/</g, '\\u003c');
  return `<script>
  (function () {
    var html = document.documentElement;
    html.classList.remove('no-js');
    html.classList.add('js');
    var key = '${STORAGE_KEY}', flag = '${SWITCH_FLAG}';
    var stored = null, explicit = false;
    try { stored = localStorage.getItem(key); } catch (e) {}
    try { explicit = sessionStorage.getItem(flag) === '1'; sessionStorage.removeItem(flag); } catch (e) {}
    var urls = ${map};
    var lang = html.getAttribute('lang');
    if (stored) {
      if (!explicit && stored !== lang && urls[stored]) {
        location.replace(urls[stored]);
        return;
      }
    } else {
      html.setAttribute('data-entry', 'pending');
    }
  })();
</script>`;
}

export function renderClientData(ctx) {
  const { t, lang, language, config, route, languages } = ctx;
  const urls = Object.fromEntries(languages.map((entry) => [entry.code, ctx.pageUrl(entry.code)]));
  const homes = Object.fromEntries(languages.map((entry) => [entry.code, urlFor(config, entry.code, 'home')]));

  return {
    lang,
    dir: language.dir,
    route,
    storageKey: STORAGE_KEY,
    switchFlag: SWITCH_FLAG,
    urls,
    homes,
    languages: languages.map((entry) => ({ code: entry.code, name: entry.nativeName })),
    strings: {
      welcome: {
        title: t('welcome.title'),
        subtitle: t('welcome.subtitle'),
        hint: t('welcome.hint'),
      },
      ui: {
        close: t('ui.close'),
        previousImage: t('ui.previousImage'),
        nextImage: t('ui.nextImage'),
        imageCounter: t('ui.imageCounter'),
        openMenu: t('ui.openMenu'),
        closeMenu: t('ui.closeMenu'),
        errorSummary: t('form.errors.summary'),
      },
      form: {
        submit: t('form.submit'),
        submitting: t('form.submitting'),
        errors: {
          name: t('form.errors.name'),
          email: t('form.errors.email'),
          message: t('form.errors.message'),
          consent: t('form.errors.consent'),
          generic: t('form.errors.generic'),
        },
      },
    },
  };
}

export function renderDocument(ctx, page, { bodyClass = '', noindex = false } = {}) {
  const { t, lang, language, config, route, site } = ctx;
  const canonical = config.siteUrl.replace(/\/$/, '') + ctx.pageUrl(lang);
  const alternates = config.languages.map((entry) => ({
    code: entry.code,
    htmlLang: entry.code,
    href: config.siteUrl.replace(/\/$/, '') + ctx.pageUrl(entry.code),
    nativeName: entry.nativeName,
  }));
  const ogSource =
    typeof page.ogImage === 'string' && page.ogImage.startsWith('/')
      ? page.ogImage
      : ctx.image(page.ogImage || 'hero').src;
  const ogImage = config.siteUrl.replace(/\/$/, '') + ogSource;
  const clientData = renderClientData(ctx);
  const arabic = lang === 'ar';
  const fontPreload = arabic
    ? `<link rel="preload" href="/assets/fonts/noto-sans-arabic-arabic-wght.woff2" as="font" type="font/woff2" crossorigin>`
    : `<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;

  const localeTags = alternates
    .filter((entry) => entry.code !== lang)
    .map((entry) => {
      const other = ctx.languages.find((item) => item.code === entry.code);
      return `<meta property="og:locale:alternate" content="${esc(other.ogLocale)}">`;
    })
    .join('\n    ');

  const hreflang = alternates
    .map((entry) => `<link rel="alternate" hreflang="${esc(entry.htmlLang)}" href="${esc(entry.href)}">`)
    .join('\n    ');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['SportsActivityLocation', 'LocalBusiness'],
    name: `${site.brand.name} ${site.brand.sub}`,
    description: page.description,
    url: canonical,
    image: ogImage,
    email: site.contact.email,
    sameAs: [site.contact.instagramUrl],
    sport: 'Judo',
    inLanguage: lang,
    address: {
      '@type': 'PostalAddress',
      streetAddress: t('meta.venue'),
      addressLocality: t('meta.city'),
      addressCountry: 'AE',
    },
    areaServed: t('meta.city'),
  };

  const urls = clientData.urls;

  return `<!DOCTYPE html>
<html lang="${esc(lang)}" dir="${esc(language.dir)}" class="no-js">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}">
    <link rel="canonical" href="${esc(canonical)}">
    ${hreflang}
    <link rel="alternate" hreflang="x-default" href="${esc(config.siteUrl.replace(/\/$/, '') + ctx.pageUrl(config.defaultLanguage))}">
    <meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
    <meta name="theme-color" content="#081320">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(`${site.brand.name} ${site.brand.sub}`)}">
    <meta property="og:title" content="${esc(page.title)}">
    <meta property="og:description" content="${esc(page.description)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:image" content="${esc(ogImage)}">
    <meta property="og:image:alt" content="${esc(t('meta.tagline'))}">
    <meta property="og:locale" content="${esc(language.ogLocale)}">
    ${localeTags}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(page.title)}">
    <meta name="twitter:description" content="${esc(page.description)}">
    <meta name="twitter:image" content="${esc(ogImage)}">
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="icon" href="/assets/icon-512.png" sizes="512x512" type="image/png">
    <link rel="stylesheet" href="/assets/styles.css">
    ${fontPreload}
    ${headScript(ctx, urls)}
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body class="${esc(bodyClass)}">
  <a class="skip-link" href="#main">${esc(t('ui.skipToContent'))}</a>
  ${siteHeader(ctx)}
  <main id="main" class="page">
    ${page.body}
  </main>
  ${siteFooter(ctx)}
  ${welcomeOverlay(ctx)}
  ${lightbox(ctx)}
  <script type="application/json" id="app-data">${JSON.stringify(clientData).replace(/</g, '\\u003c')}</script>
  <script src="/assets/app.js" defer></script>
</body>
</html>
`;
}

/** The neutral entry page: language chooser, no header or footer. */
export function renderRoot(ctx) {
  const { t, config, languages, site } = ctx;
  const urls = Object.fromEntries(languages.map((entry) => [entry.code, urlFor(config, entry.code, 'home')]));
  const alternates = languages
    .map((entry) => `<link rel="alternate" hreflang="${esc(entry.code)}" href="${esc(localeUrl(config, entry.code, 'home'))}">`)
    .join('\n    ');
  const canonical = localeUrl(config, config.defaultLanguage, 'home');
  const title = `${site.brand.name} ${site.brand.sub} – Judo in Abu Dhabi`;
  const description = t('meta.tagline');
  const key = JSON.stringify(urls).replace(/</g, '\\u003c');

  const choices = languages
    .map(
      (entry) => `<li>
        <a class="welcome__choice" href="${esc(urls[entry.code])}" hreflang="${esc(entry.code)}" lang="${esc(entry.code)}" dir="${esc(entry.dir)}" data-lang-switch="${esc(entry.code)}">
          <img class="welcome__flag" src="/assets/flags/${esc(entry.flag)}.svg" alt="" width="40" height="30">
          <span class="welcome__name">${esc(entry.nativeName)}</span>
          <span class="welcome__code" aria-hidden="true">${esc(entry.code.toUpperCase())}</span>
        </a>
      </li>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="${esc(config.defaultLanguage)}" dir="ltr" class="no-js" data-root="true">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(canonical)}">
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
    <meta name="theme-color" content="#081320">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(config.siteUrl + '/assets/img/hero-dojo.jpg')}">
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/styles.css">
    <link rel="preload" href="/assets/fonts/outfit-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
    <script>
      (function () {
        var html = document.documentElement;
        html.classList.remove('no-js');
        html.classList.add('js');
        var urls = ${key};
        var stored = null;
        try { stored = localStorage.getItem('${STORAGE_KEY}'); } catch (e) {}
        if (stored && urls[stored]) { location.replace(urls[stored]); return; }
        try { sessionStorage.removeItem('${SWITCH_FLAG}'); } catch (e) {}
      })();
    </script>
</head>
<body class="root">
  <div class="welcome welcome--root">
    <div class="welcome__backdrop" aria-hidden="true"></div>
    <div class="welcome__panel" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-subtitle">
      <img class="welcome__logo" src="/assets/logo.svg" alt="" width="72" height="72">
      <p class="welcome__brand">${esc(site.brand.name)} <span>${esc(site.brand.sub)}</span></p>
      <h1 class="welcome__title" id="welcome-title">${esc(t('welcome.title'))}</h1>
      <p class="welcome__subtitle" id="welcome-subtitle">${esc(t('welcome.subtitle'))}</p>
      <ul class="welcome__choices" role="list">${choices}</ul>
      <p class="welcome__hint">${esc(t('welcome.hint'))}</p>
    </div>
  </div>
  <p class="root__meta">${icon('pin')}<span>${esc(venueLine(t))}</span></p>
  <script src="/assets/app.js" defer></script>
</body>
</html>
`;
}
