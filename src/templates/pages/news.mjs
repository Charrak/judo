import { esc, icon } from '../../lib/html.mjs';
import { ctaBand, pageHero } from '../components.mjs';

/** List of published posts (also used as the "no posts yet" page). */
export function renderIndex(ctx, entries) {
  const { t, lang } = ctx;
  const lead = entries.length ? t('news.lead') : t('news.empty');
  const heroImage = entries.find((entry) => entry.image)?.image ?? null;

  const cards = entries
    .map((entry) => {
      const href = ctx.newsUrl(lang, entry.slug);
      const media = entry.image
        ? `<a class="news-card__media" href="${esc(href)}" tabindex="-1" aria-hidden="true">
            <img src="${esc(entry.image)}" alt="" width="960" height="640" loading="lazy" decoding="async">
          </a>`
        : '';
      return `<article class="news-card${entry.image ? ' news-card--media' : ''} reveal">
        ${media}
        <div class="news-card__body">
          <p class="news-card__date"><time datetime="${esc(entry.date)}">${esc(entry.dateLabel)}</time></p>
          <h2 class="news-card__title"><a href="${esc(href)}">${esc(entry.title)}</a></h2>
          <p class="news-card__excerpt">${esc(entry.excerpt)}</p>
          <a class="link-arrow" href="${esc(href)}">${esc(t('news.readMore'))}${icon('arrow', 'link-arrow__icon')}</a>
        </div>
      </article>`;
    })
    .join('');

  const body = `
    ${pageHero(ctx, {
      eyebrow: t('news.eyebrow'),
      title: t('news.title'),
      lead,
      imageSrc: heroImage,
      imageKey: 'circle',
      priority: true,
    })}

    <section class="section section--cream" id="news">
      <div class="shell">
        ${
          entries.length
            ? `<div class="news-list">${cards}</div>`
            : `<div class="news-empty reveal">
                <p class="news-empty__text">${esc(t('news.empty'))}</p>
                <a class="btn btn--primary" href="${esc(ctx.site.contact.instagramUrl)}" target="_blank" rel="noopener">
                  ${icon('instagram')}<span>${esc(ctx.site.contact.instagramHandle)}</span>
                </a>
              </div>`
        }
      </div>
    </section>

    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: t('news.meta.title'),
    description: t('news.meta.description'),
    ogImage: heroImage || 'circle',
    body,
    noindex: entries.length === 0,
  };
}

/** Single post. */
export function renderArticle(ctx, entry, related = []) {
  const { t, lang } = ctx;

  const paragraphs = entry.paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('');
  const figure = entry.image
    ? `<figure class="news-article__figure">
        <img src="${esc(entry.image)}" alt="" width="1200" height="800" fetchpriority="high" decoding="async">
      </figure>`
    : '';

  const more = related.length
    ? `<aside class="news-article__more">
        <h2 class="news-article__moreTitle">${esc(t('news.all'))}</h2>
        <ul class="news-article__moreList" role="list">
          ${related
            .map(
              (item) => `<li>
                <a class="news-article__moreLink" href="${esc(ctx.newsUrl(lang, item.slug))}">
                  <span class="news-article__moreDate">${esc(item.dateLabel)}</span>
                  <span class="news-article__moreTitleText">${esc(item.title)}</span>
                </a>
              </li>`,
            )
            .join('')}
        </ul>
      </aside>`
    : '';

  const body = `
    <article class="news-article">
      <header class="news-article__head">
        <div class="shell news-article__headInner">
          <p class="eyebrow eyebrow--gold"><time datetime="${esc(entry.date)}">${esc(entry.dateLabel)}</time></p>
          <h1 class="news-article__title">${esc(entry.title)}</h1>
        </div>
      </header>

      <div class="section section--cream news-article__main">
        <div class="shell news-article__shell">
          ${figure}
          <div class="news-article__body">${paragraphs}</div>
          <div class="news-article__foot">
            <a class="btn btn--ghost-dark" href="${esc(ctx.urlFor(lang, 'news'))}">
              ${icon('arrow', 'btn__icon btn__icon--back')}<span>${esc(t('news.back'))}</span>
            </a>
          </div>
          ${more}
        </div>
      </div>
    </article>

    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: `${entry.title} – ${t('nav.news')}`,
    description: entry.excerpt || t('news.meta.description'),
    ogImage: entry.image || 'circle',
    body,
  };
}
