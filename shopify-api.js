/* Shopify Storefront API — 官網商品動態載入 */
(function () {
  var DOMAIN  = 'jwhu9y-ef.myshopify.com';
  var TOKEN   = '5ec473e0b0f60f8c6334134f405a9035';
  var VERSION = '2024-10';
  var ENDPOINT = 'https://' + DOMAIN + '/api/' + VERSION + '/graphql.json';

  var QUERY = JSON.stringify({
    query: [
      '{',
      '  products(first: 4, sortKey: BEST_SELLING) {',
      '    edges {',
      '      node {',
      '        title',
      '        handle',
      '        featuredImage { url altText }',
      '        priceRange {',
      '          minVariantPrice { amount currencyCode }',
      '        }',
      '      }',
      '    }',
      '  }',
      '}'
    ].join('\n')
  });

  function fetchProducts() {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN
      },
      body: QUERY
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      return (data.data && data.data.products)
        ? data.data.products.edges.map(function (e) { return e.node; })
        : [];
    });
  }

  function formatPrice(priceRange) {
    var p = priceRange && priceRange.minVariantPrice;
    if (!p) return '';
    var num = parseFloat(p.amount);
    return p.currencyCode + ' ' + (Number.isInteger(num) ? num : num.toFixed(0));
  }

  function buildCard(product) {
    var img = product.featuredImage
      ? '<img src="' + product.featuredImage.url + '" alt="' + (product.featuredImage.altText || product.title) + '" loading="lazy">'
      : '<div class="sp-thumb-placeholder"></div>';
    var price = formatPrice(product.priceRange);
    var url = 'https://' + DOMAIN + '/products/' + product.handle;
    return [
      '<a href="' + url + '" class="sp-card" target="_blank" rel="noopener">',
      '  <div class="sp-thumb">' + img + '</div>',
      '  <div class="sp-body">',
      '    <h3 class="sp-title">' + product.title + '</h3>',
      price ? '    <p class="sp-price">' + price + '</p>' : '',
      '    <span class="sp-link"><span class="ci"></span> 查看商品</span>',
      '  </div>',
      '</a>'
    ].join('');
  }

  function render(products) {
    var section = document.getElementById('shopify-products');
    if (!section) return;

    if (!products.length) {
      section.style.display = 'none';
      return;
    }

    var grid = section.querySelector('.sp-grid');
    grid.innerHTML = products.map(buildCard).join('');
    section.style.display = '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    fetchProducts()
      .then(render)
      .catch(function () {
        var section = document.getElementById('shopify-products');
        if (section) section.style.display = 'none';
      });
  });
})();
