import Mustache from 'mustache';

// Builds the full EDS page: AEM page model + Mustache template, with the site's head.html injected,
// the same markup the EDS pipeline would deliver, so blocks decorate as usual in the browser.
export function renderPage({ model, template, head }) {
  const html = Mustache.render(template, model);
  return html.includes('</head>') ? html.replace('</head>', `${head}\n</head>`) : html;
}

// Maps a request path to an AEM page path, or null if the path is not served from AEM.
export function aemPathFor(pathname, pages) {
  const slug = pathname.replace(/^\/+|\/+$/g, '');
  return pages.includes(slug) ? slug : null;
}
