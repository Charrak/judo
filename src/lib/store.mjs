/**
 * Content store shared by the static build and the admin server.
 *
 * Editable content lives in `content/` (tracked, so it survives deployments):
 *   content/texts/<lang>.json   flat overrides for the translation dictionaries
 *   content/news.json           news posts (all languages in one file)
 *   content/gallery.json        gallery order + captions
 *   content/uploads/            uploaded images (copied to /assets/uploads)
 *
 * Secrets and runtime data stay in `data/`, which is ignored by git.
 */
import fs from 'node:fs';
import path from 'node:path';

export const CONTENT_DIR = 'content';
export const TEXTS_DIR = 'content/texts';
export const NEWS_FILE = 'content/news.json';
export const GALLERY_FILE = 'content/gallery.json';
export const UPLOAD_DIR = 'content/uploads';

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Flatten a dictionary, expanding arrays into index paths (`items.0.title`). */
export function flattenAll(node, prefix = '', out = new Map()) {
  if (Array.isArray(node)) {
    node.forEach((value, index) => flattenAll(value, prefix ? `${prefix}.${index}` : String(index), out));
    return out;
  }
  if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      flattenAll(value, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.set(prefix, node);
  return out;
}

export function getPath(root, dotted) {
  return dotted.split('.').reduce((node, key) => (node === null || node === undefined ? undefined : node[key]), root);
}

export function setPath(root, dotted, value) {
  const parts = dotted.split('.');
  let node = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (node[key] === null || node[key] === undefined) {
      node[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    node = node[key];
  }
  node[parts[parts.length - 1]] = value;
}

/** Deep clone + apply `{ "a.b.c": "text" }` overrides; unknown paths are dropped. */
export function applyTextOverrides(dict, overrides) {
  const clone = JSON.parse(JSON.stringify(dict));
  const known = flattenAll(clone);
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value !== 'string' || !known.has(key)) continue;
    setPath(clone, key, value);
  }
  return clone;
}

export function loadDictionaries(rootDir, config) {
  const dictionaries = {};
  const overrides = {};
  for (const language of config.languages) {
    const base = readJson(path.join(rootDir, 'src', 'i18n', `${language.code}.json`), {});
    const map = readJson(path.join(rootDir, TEXTS_DIR, `${language.code}.json`), {}) ?? {};
    overrides[language.code] = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
    dictionaries[language.code] = applyTextOverrides(base, overrides[language.code]);
  }
  return { dictionaries, overrides };
}

/* ------------------------------------------------------------------- news */

export function normalizeNews(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const translations = {};
  for (const [code, value] of Object.entries(entry.translations ?? {})) {
    translations[code] = {
      title: String(value?.title ?? '').trim(),
      body: String(value?.body ?? '').trim(),
    };
  }
  return {
    id: String(entry.id ?? ''),
    slug: String(entry.slug ?? '').trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? '') ? entry.date : new Date().toISOString().slice(0, 10),
    published: entry.published !== false,
    image: typeof entry.image === 'string' && entry.image.startsWith('/') ? entry.image : '',
    translations,
    createdAt: entry.createdAt ?? '',
    updatedAt: entry.updatedAt ?? '',
  };
}

export function loadNews(rootDir) {
  const data = readJson(path.join(rootDir, NEWS_FILE), { items: [] });
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items.map(normalizeNews).filter(Boolean);
}

export function saveNews(rootDir, items) {
  writeJson(path.join(rootDir, NEWS_FILE), { items });
}

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

/** A post is publishable when it has a slug and a title + body in every language. */
export function isPublishable(entry, config) {
  if (!entry || !entry.published || !entry.slug) return false;
  return config.languages.every((language) => {
    const translation = entry.translations?.[language.code];
    return translation && translation.title.length >= 2 && translation.body.length >= 10;
  });
}

export function newsIndexUrl(config, code) {
  const language = config.languages.find((entry) => entry.code === code);
  if (!language) throw new Error(`Unknown language: ${code}`);
  return `/${language.code}/${language.slugs.news}/`;
}

export function newsArticleUrl(config, code, slug) {
  return `${newsIndexUrl(config, code)}${slug}/`;
}

export function formatDate(locale, isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  try {
    return new Intl.DateTimeFormat(locale.replace('_', '-'), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoDate;
  }
}

/** Turn a stored post into the per-language view model used by the templates. */
export function viewNews(entry, config, code) {
  const language = config.languages.find((item) => item.code === code);
  const translation = entry.translations?.[code] ?? { title: '', body: '' };
  const paragraphs = translation.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const plain = translation.body.replace(/\s+/g, ' ').trim();
  return {
    id: entry.id,
    slug: entry.slug,
    date: entry.date,
    dateLabel: formatDate(language?.locale ?? 'de_DE', entry.date),
    title: translation.title,
    body: translation.body,
    paragraphs,
    excerpt: plain.length > 190 ? `${plain.slice(0, 187).trimEnd()}…` : plain,
    image: entry.image,
  };
}

/* ---------------------------------------------------------------- gallery */

export function defaultGallery(config, dictionaries, site) {
  return (site.gallery ?? [])
    .filter((key) => site.images?.[key])
    .map((key) => {
      const image = site.images[key];
      const captions = {};
      for (const language of config.languages) {
        captions[language.code] = dictionaries[language.code]?.pages?.gallery?.captions?.[key] ?? '';
      }
      return {
        id: `default-${key}`,
        src: image.src,
        width: image.width,
        height: image.height,
        captions,
        uploaded: false,
      };
    });
}

export function normalizeGalleryItem(item, config) {
  if (!item || typeof item !== 'object' || typeof item.src !== 'string') return null;
  if (!item.src.startsWith('/assets/')) return null;
  const captions = {};
  for (const language of config.languages) {
    captions[language.code] = String(item.captions?.[language.code] ?? '').trim();
  }
  return {
    id: String(item.id ?? ''),
    src: item.src,
    width: Number(item.width) || 0,
    height: Number(item.height) || 0,
    captions,
    // files below /assets/uploads/ are always files the operator uploaded
    uploaded: Boolean(item.uploaded) || item.src.startsWith('/assets/uploads/'),
  };
}

export function loadGallery(rootDir, { config, dictionaries, site }) {
  const data = readJson(path.join(rootDir, GALLERY_FILE), null);
  if (!data || !Array.isArray(data.items)) return defaultGallery(config, dictionaries, site);
  const fallback = defaultGallery(config, dictionaries, site);
  return data.items
    .map((item) => normalizeGalleryItem(item, config))
    .filter(Boolean)
    .map((item) => {
      const seed = fallback.find((entry) => entry.src === item.src);
      if (!seed) return item;
      const captions = { ...seed.captions, ...Object.fromEntries(Object.entries(item.captions).filter(([, value]) => value)) };
      return { ...item, captions, width: item.width || seed.width, height: item.height || seed.height };
    });
}

export function saveGallery(rootDir, items) {
  writeJson(path.join(rootDir, GALLERY_FILE), { items });
}
