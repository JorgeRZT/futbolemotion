/// <reference types="@fastly/js-compute" />

import { ConfigStore } from 'fastly:config-store';
import { CacheOverride } from 'fastly:cache-override';
import * as response from './lib/response.js';
import { log } from './lib/log.js';
import { renderPage, aemPathFor } from './render.js';

const DEFAULTS = {
  // EDS origin that serves code (head.html, templates/, blocks/...) for this branch
  EDS_ORIGIN: 'https://edge--futbolemotion--jorgerzt.aem.live',
  // AEM page model (Sling Model Exporter); mocked with my-custom-api
  AEM_MODEL_URL: 'https://my-custom-api.lopezpellicerjorge.workers.dev/api/futbolemotion/aem/content/futbolemotion/es/{path}.model.json',
  TEMPLATE: '/templates/aem-page.html',
  AEM_PAGES: 'example-from-aem-and-commerce',
  CACHE_TTL: '300',
  PASSTHROUGH: 'false',
};

function getConfig() {
  let store;
  try { store = new ConfigStore('config_default'); } catch (e) { store = null; }
  const cfg = {};
  Object.keys(DEFAULTS).forEach((k) => { cfg[k] = (store && store.get(k)) || DEFAULTS[k]; });
  return cfg;
}

async function fetchText(url, accept) {
  const resp = await fetch(url, { headers: { accept }, cacheOverride: new CacheOverride('override', { ttl: 60 }) });
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  return resp.text();
}

async function renderAemPage(aemPath, cfg) {
  const [model, template, head] = await Promise.all([
    fetchText(cfg.AEM_MODEL_URL.replace('{path}', aemPath), 'application/json').then(JSON.parse),
    fetchText(cfg.EDS_ORIGIN + cfg.TEMPLATE, 'text/html'),
    fetchText(`${cfg.EDS_ORIGIN}/head.html`, 'text/html'),
  ]);
  return new Response(renderPage({ model, template, head }), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=${cfg.CACHE_TTL}`,
      'x-robots-tag': 'noindex, nofollow',
      'x-rendered-by': 'aem-edge-function',
      'x-aem-source': model.path || aemPath,
    },
  });
}

const proxy = (req, cfg) => {
  const url = new URL(req.url);
  return fetch(cfg.EDS_ORIGIN + url.pathname + url.search, { headers: req.headers });
};

async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);
  const cfg = getConfig();
  let finalResponse;
  try {
    const aemPath = req.method === 'GET' ? aemPathFor(url.pathname, cfg.AEM_PAGES.split(',')) : null;
    if (aemPath) {
      try {
        finalResponse = await renderAemPage(aemPath, cfg);
      } catch (err) {
        // AEM unavailable: fall back to the page stored in Edge Delivery (DA / json2html)
        console.log(`render failed, falling back to origin: ${err}`);
        finalResponse = await proxy(req, cfg);
      }
    } else if (cfg.PASSTHROUGH === 'true') {
      // local dev only: serve code and other pages from the EDS origin
      finalResponse = await proxy(req, cfg);
    } else {
      finalResponse = response.notFound();
    }
  } catch (err) {
    console.log(err);
    finalResponse = response.error();
  }
  log(req, finalResponse);
  return finalResponse;
}

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));
