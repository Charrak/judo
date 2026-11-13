/** Small helpers shared by the page templates. No copy lives here. */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Build an attribute string from an object, skipping null/false values. */
export function attrs(map) {
  return Object.entries(map)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${esc(value)}"`))
    .join('');
}

export function classNames(...names) {
  return names.filter(Boolean).join(' ');
}

const ICON_PATHS = {
  arrow: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  arrowUp: '<path d="M12 20V5"/><path d="m6 11 6-6 6 6"/>',
  chevron: '<path d="m6 9.5 6 6 6-6"/>',
  globe:
    '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8"/><path d="M12 3.4c2.3 2.4 3.5 5.3 3.5 8.6s-1.2 6.2-3.5 8.6c-2.3-2.4-3.5-5.3-3.5-8.6S9.7 5.8 12 3.4Z"/>',
  menu: '<path d="M3.5 7h17"/><path d="M3.5 12h17"/><path d="M3.5 17h17"/>',
  close: '<path d="m6 6 12 12"/><path d="m18 6-12 12"/>',
  instagram:
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5"/><circle cx="12" cy="12" r="3.9"/><circle cx="17.1" cy="6.9" r="1" fill="currentColor" stroke="none"/>',
  mail: '<rect x="3" y="5.2" width="18" height="13.6" rx="2.2"/><path d="m3.8 7.4 8.2 5.6 8.2-5.6"/>',
  pin: '<path d="M12 21s7-5.9 7-11.2A7 7 0 0 0 5 9.8C5 15.1 12 21 12 21Z"/><circle cx="12" cy="9.8" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="8.7"/><path d="M12 7.2v5.1l3.2 2"/>',
  check: '<path d="m4.5 12.4 4.8 4.8L19.5 6.9"/>',
  belt: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7.6 6.5v11"/><path d="M16.4 6.5v11"/>',
  spark:
    '<path d="M12 3.5v4.2"/><path d="M12 16.3v4.2"/><path d="M3.5 12h4.2"/><path d="M16.3 12h4.2"/><circle cx="12" cy="12" r="2.6"/>',
  users:
    '<circle cx="9" cy="8.4" r="3.4"/><path d="M3.2 20c0-3.2 2.6-5.6 5.8-5.6s5.8 2.4 5.8 5.6"/><path d="M16.4 5.4a3.4 3.4 0 0 1 0 6.4"/><path d="M17.6 14.9c2 .6 3.4 2.3 3.4 4.4"/>',
};

export function icon(name, className = '') {
  const path = ICON_PATHS[name];
  if (!path) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon${className ? ` ${className}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

/** Localized "opens in a new tab" hint for screen readers. */
export function externalHint(t) {
  return `<span class="sr-only"> (${esc(t('ui.externalLink'))})</span>`;
}

export function flagPath(code) {
  return `/assets/flags/${code}.svg`;
}
