/**
 * Central i18n utilities.
 *
 * Every visible string lives in src/i18n/<lang>.json. Templates never contain
 * copy: they ask for keys through `createTranslator`. A missing key is a build
 * error, so a page can never ship with an untranslated placeholder.
 */

export const ROUTE_KEYS = ['home', 'about', 'training', 'team', 'gallery', 'contact', 'legal'];

/** Flatten a nested dictionary into `path -> value` pairs (arrays stay whole). */
export function flatten(node, prefix = '', out = new Map()) {
  if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object') {
        flatten(value, path, out);
      } else {
        out.set(path, value);
      }
    }
  } else {
    out.set(prefix, node);
  }
  return out;
}

function getPath(dict, path) {
  return path.split('.').reduce((node, key) => {
    if (node === null || node === undefined) return undefined;
    return node[key];
  }, dict);
}

export function interpolate(template, vars = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * @param {object} dict parsed translation file
 * @param {string} lang language code, used in error messages only
 */
export function createTranslator(dict, lang) {
  function raw(path) {
    const value = getPath(dict, path);
    if (value === undefined) {
      throw new Error(`[i18n:${lang}] missing key "${path}"`);
    }
    return value;
  }

  function t(path, vars) {
    const value = raw(path);
    if (typeof value !== 'string') {
      throw new Error(`[i18n:${lang}] "${path}" is not a string (got ${Array.isArray(value) ? 'array' : typeof value})`);
    }
    return interpolate(value, vars);
  }

  return { t, raw, dict, lang };
}

/**
 * Compare every language against the reference language and return a list of
 * human readable problems: missing keys, extra keys and type mismatches.
 */
export function compareDictionaries(reference, referenceCode, others) {
  const refPaths = flatten(reference);
  const problems = [];

  for (const [code, dict] of Object.entries(others)) {
    const paths = flatten(dict);
    for (const key of refPaths.keys()) {
      if (!paths.has(key)) {
        problems.push(`[${code}] missing key: ${key}`);
      }
    }
    for (const key of paths.keys()) {
      if (!refPaths.has(key)) {
        problems.push(`[${code}] key not in ${referenceCode}: ${key}`);
      }
    }
    for (const [key, refValue] of refPaths) {
      if (!paths.has(key)) continue;
      const value = paths.get(key);
      const sameKind = Array.isArray(refValue) ? Array.isArray(value) : typeof refValue === typeof value;
      if (!sameKind) {
        problems.push(`[${code}] type mismatch at ${key}`);
        continue;
      }
      if (Array.isArray(refValue) && refValue.length !== value.length) {
        problems.push(`[${code}] list length mismatch at ${key} (${refValue.length} vs ${value.length})`);
      }
    }
  }
  return problems;
}

/** Language codes declared in the config, in display order. */
export function getLanguages(config) {
  return config.languages;
}

export function getLanguage(config, code) {
  const language = config.languages.find((entry) => entry.code === code);
  if (!language) throw new Error(`Unknown language: ${code}`);
  return language;
}

export function urlFor(config, langCode, routeKey) {
  const language = getLanguage(config, langCode);
  const slug = language.slugs[routeKey];
  if (slug === undefined) throw new Error(`Unknown route "${routeKey}" for language "${langCode}"`);
  return slug ? `/${language.code}/${slug}/` : `/${language.code}/`;
}

export function localeUrl(config, langCode, routeKey) {
  return config.siteUrl.replace(/\/$/, '') + urlFor(config, langCode, routeKey);
}

/** English fallback words that must never appear in non-German translations. */
export const LEFTOVER_WORDS = {
  de: [],
  en: [],
  fr: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'wir', 'dein', 'deine', 'mit', 'für', 'kostenloses', 'probetraining'],
  es: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'wir', 'dein', 'deine', 'kostenloses', 'probetraining'],
  ar: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'wir', 'dein', 'kostenloses', 'probetraining'],
};

/** Find suspicious German leftovers in a non-German dictionary. */
export function findLeftovers(code, dict) {
  const banned = LEFTOVER_WORDS[code] ?? [];
  if (!banned.length) return [];
  const hits = [];
  const pattern = new RegExp(`(^|[^\\p{L}])(${banned.join('|')})([^\\p{L}]|$)`, 'iu');
  for (const [path, value] of flatten(dict)) {
    if (typeof value !== 'string') continue;
    if (pattern.test(value)) hits.push(`${path}: "${value}"`);
  }
  return hits;
}
