import assert from 'assert';
import { renderPage, aemPathFor } from '../src/render.js';

describe('renderPage', () => {
  it('renders the model with the template and injects head.html', () => {
    const html = renderPage({
      model: { metadata: { title: 'Hola' }, sections: [{ blog: { title: 'Blog' } }] },
      template: '<html><head><title>{{metadata.title}}</title></head><body><main>{{#sections}}{{#blog}}<h2>{{title}}</h2>{{/blog}}{{/sections}}</main></body></html>',
      head: '<script src="/scripts/aem.js"></script>',
    });
    assert.ok(html.includes('<title>Hola</title>'));
    assert.ok(html.includes('<h2>Blog</h2>'));
    assert.ok(html.indexOf('/scripts/aem.js') < html.indexOf('</head>'));
  });
});

describe('aemPathFor', () => {
  it('only matches configured pages', () => {
    assert.equal(aemPathFor('/example-from-aem-and-commerce', ['example-from-aem-and-commerce']), 'example-from-aem-and-commerce');
    assert.equal(aemPathFor('/example-from-aem-and-commerce/', ['example-from-aem-and-commerce']), 'example-from-aem-and-commerce');
    assert.equal(aemPathFor('/', ['example-from-aem-and-commerce']), null);
  });
});
