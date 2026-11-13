import { esc, attrs, icon, externalHint } from '../lib/html.mjs';

/**
 * All markup lives here. Every string comes from the translation dictionary
 * passed in through `ctx` – components never contain copy.
 */

const NAV_ROUTES = ['home', 'about', 'training', 'team', 'gallery', 'contact'];

/** "venue, city" – but not "… Abu Dhabi, Abu Dhabi" when the venue already names it. */
export function venueLine(t) {
  const venue = t('meta.venue');
  const city = t('meta.city');
  if (!city || venue.toLowerCase().includes(city.toLowerCase())) return venue;
  return `${venue}, ${city}`;
}

export function languageMenu(ctx) {
  const { t, lang, route, urlFor, languages } = ctx;
  const current = languages.find((entry) => entry.code === lang);
  const options = languages
    .map((language) => {
      const isActive = language.code === lang;
      return `<li>
        <a class="lang-menu__link${isActive ? ' is-active' : ''}" href="${esc(ctx.pageUrl(language.code))}"
           hreflang="${esc(language.code)}" lang="${esc(language.code)}"
           data-lang-switch="${esc(language.code)}"${isActive ? ' aria-current="true"' : ''}>
          <img class="lang-menu__flag" src="/assets/flags/${esc(language.flag)}.svg" alt="" width="26" height="20" loading="lazy">
          <span class="lang-menu__name" dir="${esc(language.dir)}">${esc(language.nativeName)}</span>
          <span class="lang-menu__check" aria-hidden="true">${isActive ? icon('check') : ''}</span>
        </a>
      </li>`;
    })
    .join('');

  return `<details class="lang-menu" data-lang-menu>
    <summary class="lang-menu__toggle">
      ${icon('globe', 'lang-menu__globe')}
      <span class="lang-menu__current" aria-hidden="true">${esc(current.code.toUpperCase())}</span>
      ${icon('chevron', 'lang-menu__chevron')}
      <span class="sr-only">${esc(t('ui.languageSwitch'))}</span>
    </summary>
    <div class="lang-menu__panel">
      <p class="lang-menu__title">${esc(t('ui.language'))}</p>
      <ul class="lang-menu__list" role="list">${options}</ul>
    </div>
  </details>`;
}

export function siteHeader(ctx) {
  const { t, route, urlFor, site } = ctx;
  const routes = ctx.hasNews ? ['home', 'about', 'training', 'news', 'team', 'gallery', 'contact'] : NAV_ROUTES;
  const links = routes.map((key) => {
    const isActive = route === key;
    return `<li><a class="nav__link${isActive ? ' is-active' : ''}" href="${esc(urlFor(ctx.lang, key))}"${
      isActive ? ' aria-current="page"' : ''
    }>${esc(t(`nav.${key}`))}</a></li>`;
  }).join('');

  return `<header class="site-header" data-header>
    <div class="shell site-header__inner">
      <a class="brand" href="${esc(urlFor(ctx.lang, 'home'))}" aria-label="${esc(`${site.brand.name} ${site.brand.sub}`)}">
        <img class="brand__mark" src="/assets/logo.svg" alt="" width="46" height="46" decoding="async">
        <span class="brand__text">
          <span class="brand__name">${esc(site.brand.name)}</span>
          <span class="brand__sub">${esc(site.brand.sub)}</span>
        </span>
      </a>

      <nav class="nav" id="site-nav" aria-label="${esc(t('ui.mainNav'))}">
        <ul class="nav__list" role="list">${links}</ul>
        <div class="nav__extra">
          <a class="btn btn--primary btn--block" href="${esc(urlFor(ctx.lang, 'contact'))}#form">${esc(t('actions.trial'))}</a>
          <a class="nav__mail" href="mailto:${esc(site.contact.email)}">${icon('mail')}${esc(site.contact.email)}</a>
        </div>
      </nav>

      <div class="site-header__actions">
        ${languageMenu(ctx)}
        <a class="btn btn--primary btn--sm site-header__cta" href="${esc(urlFor(ctx.lang, 'contact'))}#form">${esc(t('actions.trial'))}</a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-menu-toggle>
          <span class="menu-toggle__box" aria-hidden="true"><span class="menu-toggle__bar"></span><span class="menu-toggle__bar"></span></span>
          <span class="sr-only">${esc(t('ui.openMenu'))}</span>
        </button>
      </div>
    </div>
  </header>`;
}

export function siteFooter(ctx) {
  const { t, lang, route, urlFor, site, year, languages } = ctx;
  const navRoutes = ctx.hasNews ? ['home', 'about', 'training', 'news', 'team', 'gallery', 'contact'] : NAV_ROUTES;
  const navLinks = navRoutes.map(
    (key) =>
      `<li><a class="footer__link" href="${esc(urlFor(lang, key))}">${esc(t(`nav.${key}`))}</a></li>`,
  ).join('');

  const langLinks = languages
    .map(
      (language) => `<li><a class="footer__lang${language.code === lang ? ' is-active' : ''}"
        href="${esc(ctx.pageUrl(language.code))}" hreflang="${esc(language.code)}" lang="${esc(language.code)}"
        data-lang-switch="${esc(language.code)}"${language.code === lang ? ' aria-current="true"' : ''}>
        <img class="footer__flag" src="/assets/flags/${esc(language.flag)}.svg" alt="" width="22" height="17" loading="lazy">
        <span dir="${esc(language.dir)}">${esc(language.nativeName)}</span></a></li>`,
    )
    .join('');

  return `<footer class="site-footer">
    <div class="shell">
      <div class="footer__top">
        <div class="footer__brand">
          <a class="brand brand--footer" href="${esc(urlFor(lang, 'home'))}" aria-label="${esc(`${site.brand.name} ${site.brand.sub}`)}">
            <img class="brand__mark" src="/assets/logo.svg" alt="" width="56" height="56" loading="lazy" decoding="async">
            <span class="brand__text">
              <span class="brand__name">${esc(site.brand.name)}</span>
              <span class="brand__sub">${esc(site.brand.sub)}</span>
            </span>
          </a>
          <p class="footer__tagline">${esc(t('footer.tagline'))}</p>
          <a class="footer__social" href="${esc(site.contact.instagramUrl)}" target="_blank" rel="noopener">
            ${icon('instagram')}<span>${esc(site.contact.instagramHandle)}</span>${externalHint(t)}
          </a>
        </div>

        <div class="footer__cols">
          <div class="footer__col">
            <h2 class="footer__title">${esc(t('footer.explore'))}</h2>
            <ul class="footer__list" role="list">${navLinks}
              <li><a class="footer__link" href="${esc(urlFor(lang, 'legal'))}">${esc(t('nav.legal'))}</a></li>
            </ul>
          </div>
          <div class="footer__col">
            <h2 class="footer__title">${esc(t('footer.contact'))}</h2>
            <ul class="footer__list footer__list--plain" role="list">
              <li>
                <span class="footer__label">${esc(t('footer.location'))}</span>
                <a class="footer__link" href="${esc(site.contact.mapsUrl)}" target="_blank" rel="noopener">${esc(venueLine(t))}${externalHint(t)}</a>
              </li>
              <li>
                <span class="footer__label">${esc(t('footer.hours'))}</span>
                <span class="footer__value">${esc(t('footer.hoursValue'))}</span>
              </li>
              <li><a class="footer__link" href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="footer__bottom">
        <p class="footer__rights">${esc(t('footer.rights', { year }))}</p>
        <div class="footer__languages">
          <span class="footer__label">${esc(t('footer.languages'))}</span>
          <ul class="footer__langs" role="list">${langLinks}</ul>
        </div>
      </div>
    </div>
  </footer>`;
}

export function pageHero(ctx, { eyebrow, title, lead, imageKey, imageSrc = null, priority = false }) {
  const image = imageSrc ? { src: imageSrc, width: 1200, height: 800 } : ctx.image(imageKey);
  return `<section class="page-hero">
    <div class="shell page-hero__inner">
      <div class="page-hero__text">
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1 class="page-hero__title">${esc(title)}</h1>
        ${lead ? `<p class="page-hero__lead">${esc(lead)}</p>` : ''}
      </div>
      <figure class="page-hero__media">
        <img src="${esc(image.src)}" alt="" width="${image.width}" height="${image.height}"${
          priority ? ' fetchpriority="high"' : ' loading="lazy"'
        } decoding="async">
      </figure>
    </div>
  </section>`;
}

export function sectionHead({ eyebrow, id, title, lead, level = 2, align = 'start' }) {
  const tag = `h${level}`;
  return `<div class="section-head section-head--${align}">
    ${eyebrow ? `<p class="eyebrow"${id ? ` id="${esc(id)}-eyebrow"` : ''}>${esc(eyebrow)}</p>` : ''}
    <${tag} class="section-head__title"${id ? ` id="${esc(id)}"` : ''}>${esc(title)}</${tag}>
    ${lead ? `<p class="section-head__lead">${esc(lead)}</p>` : ''}
  </div>`;
}

export function valuesSection(ctx, { tone = 'dark' } = {}) {
  const { t, raw } = ctx;
  const items = raw('values.items');
  const list = items
    .map(
      (item, index) => `<li class="value reveal">
        <span class="value__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="value__title">${esc(item.title)}</h3>
        <p class="value__text">${esc(item.text)}</p>
      </li>`,
    )
    .join('');

  return `<section class="section section--${tone}" id="values">
    <div class="shell">
      ${sectionHead({ eyebrow: t('values.eyebrow'), title: t('values.title'), lead: t('values.lead'), id: 'values-title' })}
      <ol class="values">${list}</ol>
    </div>
  </section>`;
}

export function programsSection(ctx, { tone = 'cream', showLinks = true, head = null } = {}) {
  const { t, raw, urlFor, lang } = ctx;
  const items = raw('programs.items');
  const cards = items
    .map((item) => {
      const points = item.points
        .map((point) => `<li>${icon('check')}<span>${esc(point)}</span></li>`)
        .join('');
      return `<article class="program card reveal">
        <header class="program__head">
          <h3 class="program__title">${esc(item.title)}</h3>
          <p class="program__ages">${esc(item.ages)}</p>
        </header>
        <p class="program__text">${esc(item.text)}</p>
        <p class="program__duration"><span class="program__durationLabel">${esc(t('programs.durationLabel'))}</span> ${esc(item.duration)}</p>
        <p class="program__pointsLabel">${esc(t('programs.pointsLabel'))}</p>
        <ul class="program__points" role="list">${points}</ul>
        ${
          showLinks
            ? `<a class="link-arrow" href="${esc(urlFor(lang, 'training'))}">${esc(t('actions.learnMore'))}${icon('arrow', 'link-arrow__icon')}</a>`
            : ''
        }
      </article>`;
    })
    .join('');

  return `<section class="section section--${tone}" id="groups">
    <div class="shell">
      ${sectionHead(
        head ?? { eyebrow: t('programs.eyebrow'), title: t('programs.title'), lead: t('programs.lead'), id: 'groups-title' },
      )}
      <div class="programs">${cards}</div>
    </div>
  </section>`;
}

export function scheduleTable(ctx, { withCta = true } = {}) {
  const { t, raw, site } = ctx;
  // Group consecutive slots of the same day so the day is printed once.
  const days = [];
  for (const slot of site.schedule) {
    const last = days[days.length - 1];
    if (last && last.day === slot.day) last.slots.push(slot);
    else days.push({ day: slot.day, slots: [slot] });
  }

  const rows = days
    .map((group) =>
      group.slots
        .map((slot, index) => {
          const head =
            index === 0
              ? `<th class="schedule__day" scope="rowgroup" rowspan="${group.slots.length}">${esc(
                  t(`schedule.days.${group.day}`),
                )}</th>`
              : '';
          return `<tr>${head}
          <td class="schedule__time" data-label="${esc(t('schedule.columns.time'))}"><span dir="ltr">${esc(slot.time)}</span></td>
          <td class="schedule__group" data-label="${esc(t('schedule.columns.group'))}">${esc(t(`schedule.groups.${slot.group}`))}</td>
        </tr>`;
        })
        .join(''),
    )
    .join('');

  return `<div class="schedule">
    <table class="schedule__table">
      <caption class="sr-only">${esc(t('schedule.title'))}</caption>
      <thead>
        <tr>
          <th scope="col">${esc(t('schedule.columns.day'))}</th>
          <th scope="col">${esc(t('schedule.columns.time'))}</th>
          <th scope="col">${esc(t('schedule.columns.group'))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="schedule__meta">
      <p class="schedule__venue">${icon('pin')}<span>${esc(t('meta.venue'))}</span></p>
      <p class="schedule__note">${icon('clock')}<span>${esc(t('schedule.note'))}</span></p>
    </div>
    ${
      withCta
        ? `<div class="schedule__cta"><a class="btn btn--ghost-light" href="${esc(ctx.urlFor(ctx.lang, 'contact'))}#form">${esc(t('actions.trial'))}${icon('arrow', 'btn__icon')}</a></div>`
        : ''
    }
  </div>`;
}

export function scheduleSection(ctx, { tone = 'dark' } = {}) {
  const { t } = ctx;
  return `<section class="section section--${tone}" id="schedule">
    <div class="shell schedule-wrap">
      <div class="schedule-wrap__text">
        ${sectionHead({ eyebrow: t('schedule.eyebrow'), title: t('schedule.title'), lead: t('schedule.lead'), id: 'schedule-title' })}
      </div>
      <div class="schedule-wrap__table">${scheduleTable(ctx)}</div>
    </div>
  </section>`;
}

export function galleryGrid(ctx, { keys = null, items = null, lightbox = false } = {}) {
  const entries =
    items ??
    keys.map((key) => {
      const image = ctx.image(key);
      return {
        src: image.src,
        width: image.width,
        height: image.height,
        caption: ctx.t(`pages.gallery.captions.${key}`),
      };
    });

  const markup = entries
    .map((entry, index) => {
      const inner = `<img src="${esc(entry.src)}" alt="${esc(entry.caption)}" width="${entry.width}" height="${entry.height}" loading="lazy" decoding="async">
        <span class="tile__caption">${esc(entry.caption)}</span>`;
      if (!lightbox) {
        return `<figure class="tile reveal">${inner}</figure>`;
      }
      return `<li class="tile reveal">
        <a class="tile__button" href="${esc(entry.src)}" data-gallery-item data-index="${index}"
          data-src="${esc(entry.src)}" data-caption="${esc(entry.caption)}" data-width="${entry.width}" data-height="${entry.height}">
          ${inner}
        </a>
      </li>`;
    })
    .join('');

  if (lightbox) {
    return `<ul class="gallery" role="list" data-gallery>${markup}</ul>`;
  }
  return `<div class="gallery gallery--static">${markup}</div>`;
}

export function ctaBand(ctx, pageKey = 'home') {
  const { t, urlFor, lang, image } = ctx;
  const photo = image('hall');
  return `<section class="cta-band">
    <img class="cta-band__media" src="${esc(photo.src)}" alt="" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">
    <div class="shell cta-band__inner">
      <div class="cta-band__text">
        <p class="eyebrow eyebrow--gold">${esc(t('actions.trial'))}</p>
        <h2 class="cta-band__title">${esc(t(`pages.${pageKey}.cta.title`))}</h2>
        <p class="cta-band__lead">${esc(t(`pages.${pageKey}.cta.text`))}</p>
      </div>
      <div class="cta-band__actions">
        <a class="btn btn--primary" href="${esc(urlFor(lang, 'contact'))}#form">${esc(t('actions.trial'))}${icon('arrow', 'btn__icon')}</a>
        <a class="btn btn--ghost-light" href="${esc(urlFor(lang, 'contact'))}">${esc(t('actions.contact'))}</a>
      </div>
    </div>
  </section>`;
}

export function faqSection(ctx) {
  const { t, raw } = ctx;
  const items = raw('pages.training.faq.items')
    .map(
      (item, index) => `<details class="faq__item reveal"${index === 0 ? ' open' : ''}>
        <summary class="faq__question">
          <span>${esc(item.q)}</span>
          <span class="faq__marker" aria-hidden="true"></span>
        </summary>
        <div class="faq__answer"><p>${esc(item.a)}</p></div>
      </details>`,
    )
    .join('');

  return `<section class="section section--cream" id="faq">
    <div class="shell faq-wrap">
      ${sectionHead({ eyebrow: t('pages.training.faq.eyebrow'), title: t('pages.training.faq.title'), id: 'faq-title' })}
      <div class="faq">${items}</div>
    </div>
  </section>`;
}

export function contactForm(ctx) {
  const { t, raw, lang, urlFor } = ctx;
  const options = raw('form.fields.interest.options');
  const privacyLink = `<a class="field__link" href="${esc(urlFor(lang, 'legal'))}#privacy">${esc(
    t('form.fields.consent.linkText'),
  )}</a>`;
  // Escape the localized sentence first, then drop in the (already safe) link.
  const consentLabel = esc(t('form.fields.consent.label')).replace('{link}', privacyLink);

  const optionMarkup = Object.entries(options)
    .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
    .join('');

  return `<form class="form" id="contact-form" novalidate data-contact-form>
    <div class="form__grid">
      <div class="field">
        <label class="field__label" for="field-name">${esc(t('form.fields.name.label'))}</label>
        <input class="field__input" id="field-name" name="name" type="text" autocomplete="name"
          placeholder="${esc(t('form.fields.name.placeholder'))}" required aria-describedby="error-name" data-field="name">
        <p class="field__error" id="error-name" data-error-for="name" hidden></p>
      </div>
      <div class="field">
        <label class="field__label" for="field-email">${esc(t('form.fields.email.label'))}</label>
        <input class="field__input" id="field-email" name="email" type="email" autocomplete="email" inputmode="email"
          placeholder="${esc(t('form.fields.email.placeholder'))}" required aria-describedby="error-email" data-field="email">
        <p class="field__error" id="error-email" data-error-for="email" hidden></p>
      </div>
      <div class="field">
        <label class="field__label" for="field-phone">${esc(t('form.fields.phone.label'))}</label>
        <input class="field__input" id="field-phone" name="phone" type="tel" autocomplete="tel"
          placeholder="${esc(t('form.fields.phone.placeholder'))}" data-field="phone">
      </div>
      <div class="field">
        <label class="field__label" for="field-interest">${esc(t('form.fields.interest.label'))}</label>
        <div class="field__select">
          <select class="field__input field__selectInput" id="field-interest" name="interest" data-field="interest">
            ${optionMarkup}
          </select>
          ${icon('chevron', 'field__selectIcon')}
        </div>
      </div>
      <div class="field field--full">
        <label class="field__label" for="field-message">${esc(t('form.fields.message.label'))}</label>
        <textarea class="field__input field__textarea" id="field-message" name="message" rows="5"
          placeholder="${esc(t('form.fields.message.placeholder'))}" required aria-describedby="error-message" data-field="message"></textarea>
        <p class="field__error" id="error-message" data-error-for="message" hidden></p>
      </div>
    </div>

    <div class="field field--check">
      <input class="field__checkbox" id="field-consent" name="consent" type="checkbox" required aria-describedby="error-consent" data-field="consent">
      <label class="field__consentLabel" for="field-consent">${consentLabel}</label>
    </div>
    <p class="field__error" id="error-consent" data-error-for="consent" hidden></p>

    <input class="field__honeypot" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">

    <div class="form__footer">
      <button class="btn btn--primary" type="submit" data-submit>
        <span data-submit-label>${esc(t('form.submit'))}</span>${icon('arrow', 'btn__icon')}
      </button>
      <p class="form__hint">${esc(t('form.privacyHint'))}</p>
    </div>

    <p class="form__status" role="status" aria-live="polite" data-form-status></p>

    <div class="form__success" data-form-success hidden>
      <p class="form__successIcon" aria-hidden="true">${icon('check')}</p>
      <h3 class="form__successTitle">${esc(t('form.success.title'))}</h3>
      <p class="form__successText">${esc(t('form.success.text'))}</p>
      <button class="btn btn--ghost-dark" type="button" data-form-reset>${esc(t('form.success.again'))}</button>
    </div>
  </form>`;
}

export function welcomeOverlay(ctx, { always = false } = {}) {
  const { t, lang, languages, urlFor, site } = ctx;
  const choices = languages
    .map(
      (language) => `<li>
        <a class="welcome__choice" href="${esc(ctx.pageUrl(language.code))}"
           hreflang="${esc(language.code)}" lang="${esc(language.code)}"
           data-lang-switch="${esc(language.code)}">
          <img class="welcome__flag" src="/assets/flags/${esc(language.flag)}.svg" alt="" width="40" height="30">
          <span class="welcome__name" dir="${esc(language.dir)}">${esc(language.nativeName)}</span>
          <span class="welcome__code" aria-hidden="true">${esc(language.code.toUpperCase())}</span>
        </a>
      </li>`,
    )
    .join('');

  return `<div class="welcome" id="welcome-overlay">
    <div class="welcome__backdrop" aria-hidden="true"></div>
    <div class="welcome__panel" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-subtitle">
      <img class="welcome__logo" src="/assets/logo.svg" alt="" width="72" height="72">
      <p class="welcome__brand">${esc(site.brand.name)} <span>${esc(site.brand.sub)}</span></p>
      <h2 class="welcome__title" id="welcome-title">${esc(t('welcome.title'))}</h2>
      <p class="welcome__subtitle" id="welcome-subtitle">${esc(t('welcome.subtitle'))}</p>
      <ul class="welcome__choices" role="list">${choices}</ul>
      <p class="welcome__hint">${esc(t('welcome.hint'))}</p>
    </div>
  </div>`;
}

export function lightbox(ctx) {
  const { t } = ctx;
  return `<dialog class="lightbox" data-lightbox aria-label="${esc(t('actions.gallery'))}">
    <div class="lightbox__inner">
      <button class="lightbox__close" type="button" data-lightbox-close>
        ${icon('close')}<span class="sr-only">${esc(t('ui.close'))}</span>
      </button>
      <img class="lightbox__image" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E" alt="" data-lightbox-image>
      <div class="lightbox__bar">
        <p class="lightbox__caption" data-lightbox-caption></p>
        <p class="lightbox__counter" data-lightbox-counter></p>
      </div>
      <button class="lightbox__nav lightbox__nav--prev" type="button" data-lightbox-prev>
        ${icon('arrow')}<span class="sr-only">${esc(t('ui.previousImage'))}</span>
      </button>
      <button class="lightbox__nav lightbox__nav--next" type="button" data-lightbox-next>
        ${icon('arrow')}<span class="sr-only">${esc(t('ui.nextImage'))}</span>
      </button>
    </div>
  </dialog>`;
}
