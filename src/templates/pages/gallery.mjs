import { esc, icon, externalHint } from '../../lib/html.mjs';
import { ctaBand, galleryGrid, pageHero } from '../components.mjs';

export function render(ctx) {
  const { t, raw, site, lang, config } = ctx;
  const page = raw('pages.gallery');
  const items = (ctx.gallery ?? []).map((item) => ({
    src: item.src,
    width: item.width || 1200,
    height: item.height || 800,
    caption: item.captions[lang] || item.captions[config.defaultLanguage] || '',
  }));

  const body = `
    ${pageHero(ctx, {
      eyebrow: page.hero.eyebrow,
      title: page.hero.title,
      lead: page.hero.lead,
      imageKey: 'kids',
      priority: true,
    })}

    <section class="section section--dark" id="gallery">
      <div class="shell">
        ${galleryGrid(ctx, { items, lightbox: true })}
        <div class="gallery-foot">
          <p class="gallery-foot__note">${esc(page.note)}</p>
          <a class="btn btn--ghost-light" href="${esc(site.contact.instagramUrl)}" target="_blank" rel="noopener">
            ${icon('instagram')}<span>${esc(t('actions.moreOnInstagram'))}</span>${externalHint(t)}
          </a>
        </div>
      </div>
    </section>

    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: page.meta.title,
    description: page.meta.description,
    ogImage: 'kids',
    body,
  };
}
