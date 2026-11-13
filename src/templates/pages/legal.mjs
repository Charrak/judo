import { esc, icon } from '../../lib/html.mjs';
import { interpolate } from '../../lib/i18n.mjs';
import { pageHero } from '../components.mjs';

export function render(ctx) {
  const { t, raw, site, lang, urlFor } = ctx;
  const page = raw('pages.legal');
  const vars = {
    venue: t('meta.venue'),
    city: t('meta.city'),
    country: t('meta.country'),
    email: site.contact.email,
    instagram: site.contact.instagramHandle,
  };

  const chapters = [
    { key: 'imprint', id: 'imprint', data: page.imprint },
    { key: 'privacy', id: 'privacy', data: page.privacy },
  ];

  const renderChapter = (chapter) =>
    `<article class="legal__chapter" id="${chapter.id}" aria-labelledby="${chapter.id}-title">
      <h2 class="legal__title" id="${chapter.id}-title">${esc(chapter.data.title)}</h2>
      ${chapter.data.sections
        .map(
          (section, index) => `<section class="legal__block" aria-labelledby="${chapter.key}-${index}">
            <h3 class="legal__subtitle" id="${chapter.key}-${index}">${esc(section.title)}</h3>
            ${section.paragraphs
              .map((paragraph) => `<p>${esc(interpolate(paragraph, vars))}</p>`)
              .join('')}
          </section>`,
        )
        .join('')}
    </article>`;

  const body = `
    ${pageHero(ctx, {
      eyebrow: page.hero.eyebrow,
      title: page.hero.title,
      lead: page.hero.lead,
      imageKey: 'hall',
      priority: true,
    })}

    <section class="section section--cream" id="legal">
      <div class="shell legal">
        <nav class="legal__toc" aria-label="${esc(page.hero.eyebrow)}">
          <ul role="list">
            ${chapters
              .map(
                (chapter) =>
                  `<li><a class="legal__tocLink" href="#${chapter.id}">${esc(chapter.data.title)}${icon('arrow', 'legal__tocIcon')}</a></li>`,
              )
              .join('')}
          </ul>
          <p class="legal__updated">${esc(page.updated)}</p>
          <p class="legal__contact">
            <a class="link-arrow" href="mailto:${esc(site.contact.email)}">${esc(t('actions.writeMail'))}${icon('arrow', 'link-arrow__icon')}</a>
          </p>
        </nav>

        <div class="legal__content">
          ${chapters.map(renderChapter).join('')}
          <p class="legal__back">
            <a class="link-arrow" href="${esc(urlFor(lang, 'contact'))}">${esc(t('actions.contact'))}${icon('arrow', 'link-arrow__icon')}</a>
          </p>
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
