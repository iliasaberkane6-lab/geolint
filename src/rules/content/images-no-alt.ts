import type { Rule } from '../../core/types.js';

const MIN_IMAGES = 4;

export const imagesNoAltRule: Rule = {
  id: 'content/images-no-alt',
  category: 'content',
  title: 'Images carry alt text',
  description:
    'Multimodal answer engines read alt text to understand images — and increasingly cite visual content. Images without alt text are invisible to them.',
  severity: 'info',
  check(ctx) {
    if (!ctx.$) {
      return [];
    }
    const $ = ctx.$;
    const imgs = $('img').toArray();
    if (imgs.length < MIN_IMAGES) {
      return [];
    }
    const missing = imgs.filter((el) => {
      const alt = $(el).attr('alt');
      return alt === undefined || alt.trim() === '';
    }).length;
    if (missing / imgs.length <= 0.5) {
      return [];
    }
    return [
      {
        severity: 'info',
        message: `${missing} of ${imgs.length} images have no alt text`,
        detail:
          'Alt text is the primary way AI systems understand what an image shows; missing alt makes visual content uncitable.',
        fix: 'Write descriptive alt text for meaningful images (purely decorative ones can keep alt="").',
      },
    ];
  },
};
