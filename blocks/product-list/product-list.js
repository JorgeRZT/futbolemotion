import { createOptimizedPicture, getMetadata, readBlockConfig } from '../../scripts/aem.js';

/*
 * Commerce placeholder authored in AEM (Universal Editor) with a key-value config:
 * category, sort, page-size and optional pinned url-keys.
 * Products are resolved at runtime from Adobe Commerce Catalog Service (productSearch),
 * the same API the storefront drop-ins use; swap renderList() for the
 * @dropins/storefront-product-discovery container when a Commerce backend is connected.
 */
const QUERY = `query productSearch($phrase: String!, $filter: [SearchClauseInput!], $sort: [ProductSearchSortInput!], $pageSize: Int) {
  productSearch(phrase: $phrase, filter: $filter, sort: $sort, page_size: $pageSize) {
    items { productView { sku name urlKey url
      images(roles: ["small_image"]) { url label }
      attributes(roles: ["visible_in_plp"]) { name value }
      ... on SimpleProductView { price { final { amount { value currency } } } }
    } }
  }
}`;

const SORTS = {
  newest: [{ attribute: 'position', direction: 'DESC' }],
  'price-asc': [{ attribute: 'price', direction: 'ASC' }],
  'price-desc': [{ attribute: 'price', direction: 'DESC' }],
};

const toList = (value) => {
  if (!value) return [];
  return (Array.isArray(value) ? value : String(value).split(/[\s,]+/)).filter(Boolean);
};

async function searchProducts(endpoint, config) {
  const urlKeys = toList(config['url-keys']);
  const filter = urlKeys.length
    ? [{ attribute: 'url_key', in: urlKeys }]
    : [{ attribute: 'categoryPath', eq: config.category }];
  const variables = {
    phrase: '',
    filter,
    sort: SORTS[config.sort] || SORTS.newest,
    pageSize: parseInt(config['page-size'], 10) || 10,
  };
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set('query', QUERY.replace(/\s+/g, ' '));
  url.searchParams.set('variables', JSON.stringify(variables));
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Catalog Service ${resp.status}`);
  const { data } = await resp.json();
  return (data?.productSearch?.items || []).map(({ productView }) => productView);
}

function renderList(products) {
  const ul = document.createElement('ul');
  const price = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  products.forEach((p) => {
    const li = document.createElement('li');
    const image = p.images?.[0];
    const badge = p.attributes?.find((a) => a.name === 'badge')?.value;
    const amount = p.price?.final?.amount;
    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-list-image';
    if (image) imageDiv.append(createOptimizedPicture(image.url, image.label || p.name, false, [{ width: '500' }]));
    const body = document.createElement('div');
    body.className = 'product-list-body';
    body.innerHTML = `${badge ? '<p class="product-list-badge"></p>' : ''}<h3><a></a></h3>${amount ? '<p class="product-list-price"></p>' : ''}`;
    if (badge) body.querySelector('.product-list-badge').textContent = badge;
    const link = body.querySelector('a');
    link.href = p.url || `/products/${p.urlKey}`;
    link.textContent = p.name;
    if (amount) body.querySelector('.product-list-price').textContent = price.format(amount.value);
    li.append(imageDiv, body);
    ul.append(li);
  });
  return ul;
}

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const endpoint = config.endpoint || getMetadata('commerce-endpoint');
  const size = parseInt(config['page-size'], 10) || 10;

  // skeleton keeps layout stable while products load
  const skeleton = document.createElement('ul');
  skeleton.className = 'product-list-skeleton';
  skeleton.innerHTML = '<li><div class="product-list-image"></div></li>'.repeat(Math.min(size, 6));
  block.replaceChildren(skeleton);

  if (!endpoint) {
    block.dataset.status = 'unconfigured';
    return;
  }
  try {
    const products = await searchProducts(endpoint, config);
    block.replaceChildren(renderList(products));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('product-list:', e);
    block.dataset.status = 'error';
  }
}
