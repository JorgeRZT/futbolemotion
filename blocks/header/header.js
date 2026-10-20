import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(width >= 900px)');

function cleanLinks(el) {
  el.querySelectorAll('.button').forEach((a) => a.classList.remove('button', 'primary', 'secondary'));
  el.querySelectorAll('.button-container').forEach((p) => p.classList.remove('button-container'));
}

function toggleMenu(nav, force) {
  const expanded = force ?? nav.getAttribute('aria-expanded') !== 'true';
  nav.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  nav.querySelector('.nav-hamburger').setAttribute('aria-label', expanded ? 'Cerrar menú' : 'Abrir menú');
  document.body.style.overflowY = expanded && !isDesktop.matches ? 'hidden' : '';
}

function buildSearch() {
  const form = document.createElement('form');
  form.className = 'nav-search';
  form.setAttribute('role', 'search');
  form.innerHTML = `
    <input type="search" name="q" placeholder="¿Qué es lo que buscas?" aria-label="Buscar productos" autocomplete="off">
    <button type="submit" aria-label="Buscar"><img src="${window.hlx.codeBasePath}/icons/search.svg" alt="" width="20" height="20"></button>`;
  form.addEventListener('submit', (e) => e.preventDefault());
  return form;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  if (!fragment) return;
  cleanLinks(fragment);

  const [topbarSec, brandSec, sectionsSec, toolsSec] = [...fragment.children];
  block.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';

  if (topbarSec) {
    const topbar = document.createElement('div');
    topbar.className = 'nav-topbar';
    topbar.innerHTML = topbarSec.querySelector('p')?.innerHTML || '';
    wrapper.append(topbar);
  }

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Navegación principal');
  nav.setAttribute('aria-expanded', 'false');

  const main = document.createElement('div');
  main.className = 'nav-main';

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-controls', 'nav-sections');
  hamburger.setAttribute('aria-label', 'Abrir menú');
  hamburger.innerHTML = '<span class="nav-hamburger-icon"></span>';
  hamburger.addEventListener('click', () => toggleMenu(nav));

  const brandLink = brandSec?.querySelector('a');
  const brand = document.createElement('a');
  brand.className = 'nav-brand';
  brand.href = brandLink?.getAttribute('href') || '/';
  brand.innerHTML = `<img src="${window.hlx.codeBasePath}/icons/futbolemotion.svg" alt="${brandLink?.textContent.trim() || 'Fútbol Emotion'}" width="160" height="30">`;

  const tools = document.createElement('ul');
  tools.className = 'nav-tools';
  toolsSec?.querySelectorAll('li').forEach((li) => {
    const item = document.createElement('li');
    const a = li.querySelector('a');
    if (a) {
      const label = a.textContent.trim();
      a.setAttribute('aria-label', label);
      a.innerHTML = `${a.querySelector('.icon')?.outerHTML || ''}<span>${label}</span>`;
      item.append(a);
    }
    tools.append(item);
  });

  main.append(hamburger, brand, buildSearch(), tools);

  const sections = document.createElement('div');
  sections.className = 'nav-sections';
  sections.id = 'nav-sections';
  const list = sectionsSec?.querySelector('ul');
  if (list) {
    list.querySelectorAll(':scope > li').forEach((li) => {
      if (li.querySelector('strong')) li.classList.add('nav-highlight');
      if (li.querySelector('em')) li.classList.add('nav-end');
    });
    sections.append(list);
  }

  nav.append(main, sections);
  wrapper.append(nav);
  block.append(wrapper);

  isDesktop.addEventListener('change', () => toggleMenu(nav, false));
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, false);
      hamburger.focus();
    }
  });
}
