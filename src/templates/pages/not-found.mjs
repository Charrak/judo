import { esc, icon } from '../../lib/html.mjs';

export function render(ctx) {
  const { t, urlFor, lang } = ctx;
  const body = `
    <section class="section section--dark not-found">
      <div class="shell not-found__inner">
        <p class="eyebrow eyebrow--gold">${esc(t('notFound.eyebrow'))}</p>
        <p class="not-found__code" aria-hidden="true">404</p>
        <h1 class="not-found__title">${esc(t('notFound.title'))}</h1>
        <p class="not-found__text">${esc(t('notFound.text'))}</p>
        <div class="not-found__actions">
          <a class="btn btn--primary" href="${esc(urlFor(lang, 'home'))}">${esc(t('notFound.home'))}${icon('arrow', 'btn__icon')}</a>
          <a class="btn btn--ghost-light" href="${esc(urlFor(lang, 'contact'))}">${esc(t('notFound.contact'))}</a>
        </div>
      </div>
    </section>
  `;

  return {
    title: `${t('notFound.title')} – ${t('meta.tagline')}`,
    description: t('notFound.text'),
    ogImage: 'hall',
    body,
  };
}
