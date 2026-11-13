import { esc } from '../../lib/html.mjs';
import { ctaBand, faqSection, pageHero, programsSection, scheduleSection } from '../components.mjs';

export function render(ctx) {
  const { raw, image } = ctx;
  const page = raw('pages.training');
  const stepsImage = image('randori');

  const steps = page.firstSteps.items
    .map(
      (item, index) => `<li class="step reveal">
        <span class="step__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
        <div class="step__body">
          <h3 class="step__title">${esc(item.title)}</h3>
          <p class="step__text">${esc(item.text)}</p>
        </div>
      </li>`,
    )
    .join('');

  const body = `
    ${pageHero(ctx, {
      eyebrow: page.hero.eyebrow,
      title: page.hero.title,
      lead: page.hero.lead,
      imageKey: 'randori',
      priority: true,
    })}

    ${programsSection(ctx, {
      tone: 'cream',
      showLinks: false,
      head: { eyebrow: page.groups.eyebrow, title: page.groups.title, lead: page.groups.lead, id: 'groups-title' },
    })}

    ${scheduleSection(ctx, { tone: 'dark' })}

    <section class="section section--cream" id="first-session">
      <div class="shell split split--reverse">
        <figure class="split__media">
          <img src="${esc(stepsImage.src)}" alt="" width="${stepsImage.width}" height="${stepsImage.height}" loading="lazy" decoding="async">
        </figure>
        <div class="split__text">
          <p class="eyebrow">${esc(page.firstSteps.eyebrow)}</p>
          <h2 class="split__title">${esc(page.firstSteps.title)}</h2>
          <p class="split__lead">${esc(page.firstSteps.lead)}</p>
          <ol class="steps">${steps}</ol>
        </div>
      </div>
    </section>

    ${faqSection(ctx)}


    ${ctaBand(ctx, 'home')}
  `;

  return {
    title: page.meta.title,
    description: page.meta.description,
    ogImage: 'randori',
    body,
  };
}
