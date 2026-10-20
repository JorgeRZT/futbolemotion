import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const SECTION_NAMES = ['brands', 'links', 'member', 'main', 'legal'];

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  block.textContent = '';
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  [...footer.children].forEach((section, i) => {
    if (SECTION_NAMES[i]) section.classList.add(`footer-${SECTION_NAMES[i]}`);
  });

  // app store badges: wrap each image with the link that follows it
  footer.querySelectorAll('p:has(> picture)').forEach((p) => {
    const next = p.nextElementSibling;
    const link = next?.querySelector(':scope > a:only-child');
    if (link) {
      const label = link.textContent.trim();
      link.textContent = '';
      link.setAttribute('aria-label', label);
      link.className = 'footer-badge';
      link.append(p.querySelector('picture'));
      p.replaceChildren(link);
      next.remove();
    }
  });

  footer.querySelectorAll('.button').forEach((a) => {
    if (!a.closest('.footer-member')) a.classList.remove('button', 'primary', 'secondary');
  });

  block.append(footer);
}
