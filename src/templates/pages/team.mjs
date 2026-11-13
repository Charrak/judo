import { esc, icon } from '../../lib/html.mjs';
import { ctaBand, pageHero, sectionHead } from '../components.mjs';

export function render(ctx) {
  const { t, raw, image, urlFor, lang } = ctx;
  const page = raw('pages.team');
  const portrait = image('circle');

  const facts = page.founder.facts
    .map(
      (fact) => `<div class="facts__row">
        <dt class="facts__label">${esc(fact.label)}</dt>
        <dd class="facts__value">${esc(fact.value)}</dd>
      </div>`,
    )
    .join('');

  const pillars = page.philosophy.items
    .map(
      (item, index) => `<li class="pillar card reveal">
        <span class="pillar__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="pillar__title">${esc(item.title)}</h3>
        <p class="pillar__text">${esc(item.text)}</p>
      </li>`,
    )
    .join('');

  const body = `
    ${pageHero(ctx, {
      eyebrow: page.hero.eyebrow,
      title: page.hero.title,
      lead: page.hero.lead,
      imageKey: 'coach',
      priority: true,
    })}

    <section class="section section--cream" id="founder">
      <div class="shell split">
        <div class="split__text">
          <p class="eyebrow">${esc(page.founder.eyebrow)}</p>
          <h2 class="split__name">${esc(page.founder.name)}</h2>
          <p class="split__role">${esc(page.founder.role)}</p>
          <p class="split__lead">${esc(page.founder.text)}</p>
          <dl class="facts">${facts}</dl>
        </div>
        <figure class="split__media split__media--framed">
          <img src="${esc(portrait.src)}" alt="" width="${portrait.width}" height="${portrait.height}" loading="lazy" decoding="async">
          <figcaption class="split__caption">${esc(t('pages.home.coach.quote'))}</figcaption>
        </figure>
      </div>
    </section>

    <section class="section section--dark" id="coaching">
      <div class="shell">
        ${sectionHead({ eyebrow: page.philosophy.eyebrow, title: page.philosophy.title, id: 'coaching-title' })}
        <ol class="pillars">${pillars}</ol>
      </div>
    </section>

    <section class="section section--cream" id="join">
      <div class="shell join">
        <div class="join__text">
          <p class="eyebrow">${esc(page.join.eyebrow)}</p>
          <h2 class="join__title">${esc(page.join.title)}</h2>
          <p class="join__lead">${esc(page.join.text)}</p>
        </div>
        <div class="join__actions">
          <a class="btn btn--primary" href="${esc(urlFor(lang, 'contact'))}#form">${esc(page.join.cta)}${icon('arrow', 'btn__icon')}</a>
          <a class="btn btn--ghost-dark" href="${esc(urlFor(lang, 'contact'))}">${esc(t('actions.contact'))}</a>
        </div>
      </div>
    </section>

    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: page.meta.title,
    description: page.meta.description,
    ogImage: 'coach',
    body,
  };
}
