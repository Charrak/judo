import { esc, icon, externalHint } from '../../lib/html.mjs';
import { contactForm, pageHero, venueLine } from '../components.mjs';

export function render(ctx) {
  const { t, raw, site } = ctx;
  const page = raw('pages.contact');
  const info = page.info;

  const cards = [
    {
      icon: 'pin',
      title: info.locationTitle,
      value: venueLine(t),
      note: info.locationNote,
      href: site.contact.mapsUrl,
      external: true,
      cta: t('actions.planRoute'),
    },
    {
      icon: 'instagram',
      title: info.instagramTitle,
      value: site.contact.instagramHandle,
      note: info.instagramNote,
      href: site.contact.instagramUrl,
      external: true,
      cta: t('actions.moreOnInstagram'),
    },
    {
      icon: 'clock',
      title: info.hoursTitle,
      value: info.hoursNote,
      note: t('schedule.note'),
      href: ctx.urlFor(ctx.lang, 'training'),
      external: false,
      cta: t('actions.schedule'),
    },
    {
      icon: 'mail',
      title: info.languagesTitle,
      value: info.languagesNote,
      note: '',
      href: `mailto:${site.contact.email}`,
      external: false,
      cta: t('actions.writeMail'),
    },
  ]
    .map(
      (card) => `<li class="info-card card reveal">
        <span class="info-card__icon" aria-hidden="true">${icon(card.icon)}</span>
        <h2 class="info-card__title">${esc(card.title)}</h2>
        <p class="info-card__value">${esc(card.value)}</p>
        ${card.note ? `<p class="info-card__note">${esc(card.note)}</p>` : ''}
        <a class="link-arrow" href="${esc(card.href)}"${card.external ? ' target="_blank" rel="noopener"' : ''}>
          ${esc(card.cta)}${icon('arrow', 'link-arrow__icon')}${card.external ? externalHint(t) : ''}
        </a>
      </li>`,
    )
    .join('');

  const body = `
    ${pageHero(ctx, {
      eyebrow: page.hero.eyebrow,
      title: page.hero.title,
      lead: page.hero.lead,
      imageKey: 'hall',
      priority: true,
    })}

    <section class="section section--cream" id="form">
      <div class="shell contact">
        <div class="contact__side">
          <ul class="info-cards" role="list">${cards}</ul>
        </div>
        <div class="contact__form">
          <div class="form-card">
            <p class="eyebrow">${esc(t('actions.trial'))}</p>
            <h2 class="form-card__title">${esc(t('form.title'))}</h2>
            <p class="form-card__lead">${esc(t('form.lead'))}</p>
            <p class="form-card__response">${icon('clock')}<span><strong>${esc(info.responseTitle)}:</strong> ${esc(info.responseNote)}</span></p>
            ${contactForm(ctx)}
            <noscript><p class="form__noscript">${esc(page.noscript)}</p></noscript>
          </div>
        </div>
      </div>
    </section>
  `;

  return {
    title: page.meta.title,
    description: page.meta.description,
    ogImage: 'hall',
    body,
  };
}
