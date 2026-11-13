import { esc, icon } from '../../lib/html.mjs';
import { ctaBand, pageHero, sectionHead, valuesSection } from '../components.mjs';

export function render(ctx) {
  const { raw, image } = ctx;
  const page = raw('pages.about');
  const story = image('competition');
  const heroImage = 'circle';

  const storyParagraphs = page.story.paragraphs
    .map((paragraph, index) =>
      index === 0
        ? `<p class="split__lead">${esc(paragraph)}</p>`
        : `<p class="split__body">${esc(paragraph)}</p>`,
    )
    .join('');

  const goals = page.goals.items
    .map(
      (item, index) => `<li class="goal card reveal">
        <span class="goal__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <h3 class="goal__title">${esc(item.title)}</h3>
        <p class="goal__text">${esc(item.text)}</p>
      </li>`,
    )
    .join('');

  const body = `
    ${pageHero(ctx, {
      eyebrow: page.hero.eyebrow,
      title: page.hero.title,
      lead: page.hero.lead,
      imageKey: heroImage,
      priority: true,
    })}

    <section class="section section--cream" id="story">
      <div class="shell split">
        <div class="split__text">
          <p class="eyebrow">${esc(page.story.eyebrow)}</p>
          <h2 class="split__title">${esc(page.story.title)}</h2>
          ${storyParagraphs}
        </div>
        <figure class="split__media split__media--framed">
          <img src="${esc(story.src)}" alt="" width="${story.width}" height="${story.height}" loading="lazy" decoding="async">
        </figure>
      </div>
    </section>

    <section class="section section--dark" id="philosophy">
      <div class="shell philosophy">
        <div class="philosophy__text">
          <p class="eyebrow">${esc(page.philosophy.eyebrow)}</p>
          <h2 class="philosophy__title">${esc(page.philosophy.title)}</h2>
          ${page.philosophy.paragraphs.map((paragraph) => `<p class="philosophy__body">${esc(paragraph)}</p>`).join('')}
        </div>
        <blockquote class="philosophy__quote">
          ${icon('spark', 'philosophy__quoteIcon')}
          <p>${esc(page.philosophy.quote)}</p>
        </blockquote>
      </div>
    </section>

    ${valuesSection(ctx, { tone: 'cream' })}

    <section class="section section--dark" id="goals">
      <div class="shell">
        ${sectionHead({ eyebrow: page.goals.eyebrow, title: page.goals.title, id: 'goals-title' })}
        <ol class="goals">${goals}</ol>
      </div>
    </section>

    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: page.meta.title,
    description: page.meta.description,
    ogImage: heroImage,
    body,
  };
}
