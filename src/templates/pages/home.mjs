import { esc } from '../../lib/html.mjs';
import { icon } from '../../lib/html.mjs';
import {
  galleryGrid,
  programsSection,
  scheduleSection,
  sectionHead,
  valuesSection,
  ctaBand,
} from '../components.mjs';

export function render(ctx) {
  const { t, raw, lang, urlFor, image, site } = ctx;
  const hero = raw('pages.home.hero');
  const intro = raw('pages.home.intro');
  const coach = raw('pages.home.coach');
  const gallery = raw('pages.home.gallery');
  const heroImage = image(site.heroImage);
  const introImage = image('grip');
  const coachImage = image('coach');

  const stats = hero.stats
    .map(
      (stat) => `<div class="hero__stat">
        <dt class="hero__statLabel">${esc(stat.label)}</dt>
        <dd class="hero__statValue">${esc(stat.value)}</dd>
      </div>`,
    )
    .join('');

  const badges = intro.badges
    .map((badge) => `<li class="badge">${icon('check')}<span>${esc(badge)}</span></li>`)
    .join('');

  const body = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero__mediaWrap">
        <img class="hero__media" src="${esc(heroImage.src)}" alt="" width="${heroImage.width}" height="${heroImage.height}" fetchpriority="high" decoding="async">
      </div>
      <div class="hero__shade" aria-hidden="true"></div>
      <div class="shell hero__inner">
        <p class="eyebrow eyebrow--gold">${esc(hero.eyebrow)}</p>
        <h1 class="hero__title" id="hero-title">${esc(hero.title)}</h1>
        <p class="hero__lead">${esc(hero.lead)}</p>
        <div class="hero__actions">
          <a class="btn btn--primary btn--lg" href="${esc(urlFor(lang, 'contact'))}#form">${esc(hero.primary)}${icon('arrow', 'btn__icon')}</a>
          <a class="btn btn--ghost-light btn--lg" href="${esc(urlFor(lang, 'training'))}">${esc(hero.secondary)}</a>
        </div>
        <dl class="hero__stats">${stats}</dl>
      </div>
      <a class="hero__scroll" href="#intro">${icon('arrowUp', 'hero__scrollIcon')}<span>${esc(t('ui.scrollMore'))}</span></a>
    </section>

    <section class="section section--cream" id="intro">
      <div class="shell split split--intro">
        <div class="split__text">
          <p class="eyebrow">${esc(intro.eyebrow)}</p>
          <h2 class="split__title">${esc(intro.title)}</h2>
          <p class="split__lead">${esc(intro.textPrimary)}</p>
          <p class="split__body">${esc(intro.textSecondary)}</p>
          <p class="split__signature">${esc(intro.signature)}</p>
          <ul class="badges" role="list">${badges}</ul>
        </div>
        <figure class="split__media split__media--framed">
          <img src="${esc(introImage.src)}" alt="" width="${introImage.width}" height="${introImage.height}" loading="lazy" decoding="async">
        </figure>
      </div>
    </section>

    ${valuesSection(ctx, { tone: 'dark' })}

    ${programsSection(ctx, { tone: 'cream' })}

    ${scheduleSection(ctx, { tone: 'dark' })}

    <section class="section section--cream" id="coach">
      <div class="shell split split--reverse">
        <figure class="split__media">
          <img src="${esc(coachImage.src)}" alt="" width="${coachImage.width}" height="${coachImage.height}" loading="lazy" decoding="async">
        </figure>
        <div class="split__text">
          <p class="eyebrow">${esc(coach.eyebrow)}</p>
          <h2 class="split__title">${esc(coach.title)}</h2>
          <p class="split__lead">${esc(coach.text)}</p>
          <blockquote class="quote">
            <p class="quote__text">${esc(coach.quote)}</p>
            <cite class="quote__cite">${esc(t('pages.team.founder.name'))}</cite>
          </blockquote>
          <a class="link-arrow" href="${esc(urlFor(lang, 'team'))}">${esc(coach.cta)}${icon('arrow', 'link-arrow__icon')}</a>
        </div>
      </div>
    </section>

    <section class="section section--dark" id="impressions">
      <div class="shell">
        ${sectionHead({ eyebrow: gallery.eyebrow, title: gallery.title, lead: gallery.lead, id: 'impressions-title' })}
        ${galleryGrid(ctx, { keys: site.homeGallery, lightbox: true })}
        <div class="section__footer">
          <a class="btn btn--ghost-light" href="${esc(urlFor(lang, 'gallery'))}">${esc(t('actions.gallery'))}${icon('arrow', 'btn__icon')}</a>
        </div>
      </div>
    </section>

    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: t('pages.home.meta.title'),
    description: t('pages.home.meta.description'),
    ogImage: 'hero',
    body,
  };
}
