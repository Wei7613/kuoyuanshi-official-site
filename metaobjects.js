/* metaobjects.js — 從 Shopify Storefront API 動態載入官網 CMS 內容
 *
 * 漸進增強策略：
 *   - 有 Metaobjects 資料 → 取代 DOM 靜態內容
 *   - API 失敗或無資料 → 保持 HTML 靜態內容不變（fallback）
 *
 * 管理後台：Shopify Admin → Content → Metaobjects
 */
(function () {
  var DOMAIN   = 'jwhu9y-ef.myshopify.com';
  var TOKEN    = '5ec473e0b0f60f8c6334134f405a9035';
  var VERSION  = '2024-10';
  var ENDPOINT = 'https://' + DOMAIN + '/api/' + VERSION + '/graphql.json';

  var QUERY = JSON.stringify({
    query: [
      '{',
      '  heroSlides: metaobjects(type: "kuoyuanshi_hero_slide", first: 10) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  newsItems: metaobjects(type: "kuoyuanshi_news_item", first: 10) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  businessAreas: metaobjects(type: "kuoyuanshi_business_area", first: 10) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  presidentMessage: metaobjects(type: "kuoyuanshi_president_message", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '}'
    ].join('\n')
  });

  // ── 工具函式 ───────────────────────────────────────────────
  function fieldsToObj(node) {
    var obj = {};
    (node.fields || []).forEach(function (f) { obj[f.key] = f.value; });
    return obj;
  }

  function sortByOrder(items) {
    return items.slice().sort(function (a, b) {
      return (parseInt(a.sort_order, 10) || 0) - (parseInt(b.sort_order, 10) || 0);
    });
  }

  function esc(str) {
    // XSS 防護：轉義 HTML 特殊字元
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Storefront API 請求 ────────────────────────────────────
  function fetchData() {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': TOKEN
      },
      body: QUERY
    }).then(function (r) { return r.json(); });
  }

  // ── Hero 輪播（更新背景圖與第一幕文字）──────────────────────
  // CSS 動畫用 nth-child(1/2/3) 綁定，只更新背景不重建結構
  function renderHero(data) {
    var section = document.getElementById('mv');
    if (!section) return;
    var edges = (data.heroSlides && data.heroSlides.edges) || [];
    if (!edges.length) return;

    var slides = sortByOrder(edges.map(function (e) { return fieldsToObj(e.node); }));
    var domSlides = section.querySelectorAll('.mv-slide');

    slides.forEach(function (s, i) {
      if (!domSlides[i] || !s.image_url) return;
      var overlay = i === 0
        ? 'linear-gradient(160deg,rgba(20,10,5,.92) 0%,rgba(60,30,10,.5) 100%)'
        : i === 1
          ? 'linear-gradient(160deg,rgba(5,10,20,.92) 0%,rgba(10,30,60,.5) 100%)'
          : 'linear-gradient(160deg,rgba(5,20,5,.92) 0%,rgba(10,50,20,.5) 100%)';
      domSlides[i].style.backgroundImage = overlay + ', url("' + s.image_url + '")';
      domSlides[i].style.backgroundSize = 'cover';
      domSlides[i].style.backgroundPosition = 'center';
    });

    // 第一幕文字（hero caption）
    var caption = section.querySelector('.mv-caption');
    if (!caption || !slides[0]) return;
    var h1 = caption.querySelector('h1');
    var p  = caption.querySelector('p');
    if (h1 && slides[0].title)       h1.textContent = slides[0].title;
    if (p  && slides[0].description) p.textContent  = slides[0].description;

    // CTA 按鈕：重建連結內容，保留 icon span
    var ctaLink = caption.querySelector('.mv-story-link');
    if (ctaLink && slides[0].cta_text) {
      var icon = ctaLink.querySelector('span.ci');
      ctaLink.textContent = '';
      if (icon) ctaLink.appendChild(icon);
      ctaLink.appendChild(document.createTextNode(' ' + slides[0].cta_text));
    }
  }

  // ── 最新消息 ───────────────────────────────────────────────
  function renderNews(data) {
    var list = document.getElementById('news-list');
    if (!list) return;
    var edges = (data.newsItems && data.newsItems.edges) || [];
    if (!edges.length) return;

    var items = sortByOrder(edges.map(function (e) { return fieldsToObj(e.node); }));
    list.innerHTML = items.map(function (n) {
      var isBiz    = n.category === 'biz';
      var label    = esc(n.category_label || (isBiz ? '業務資訊' : '公司動態'));
      var badgeCls = 'ni-badge' + (isBiz ? ' red' : '');
      var href     = esc(n.url || '#');
      return [
        '<a href="' + href + '" class="news-item" data-cat="' + esc(n.category || 'pr') + '">',
        '  <span class="ni-date">'  + esc(n.date || '')  + '</span>',
        '  <span class="' + badgeCls + '">' + label + '</span>',
        '  <span class="ni-title">' + esc(n.title || '') + '</span>',
        '  <span class="ni-arrow"><span class="ci"></span></span>',
        '</a>'
      ].join('');
    }).join('');

    // 重新綁定 tab 篩選（main.js 初始化後可能失效，補一次）
    attachTabFilter(list);
  }

  function attachTabFilter(list) {
    var tabs = document.querySelectorAll('.tab-btn');
    if (!tabs.length) return;
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabs.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var cat = btn.getAttribute('data-tab');
        list.querySelectorAll('.news-item').forEach(function (item) {
          item.style.display = (cat === 'all' || item.getAttribute('data-cat') === cat) ? '' : 'none';
        });
      });
    });
  }

  // ── 核心事業 ───────────────────────────────────────────────
  function renderBusiness(data) {
    var grid = document.querySelector('.feat-grid');
    if (!grid) return;
    var edges = (data.businessAreas && data.businessAreas.edges) || [];
    if (!edges.length) return;

    var areas = sortByOrder(edges.map(function (e) { return fieldsToObj(e.node); }));
    grid.innerHTML = areas.map(function (b) {
      var href    = esc(b.url || '#');
      var imgHtml = b.image_url
        ? '<img src="' + esc(b.image_url) + '" alt="' + esc(b.title_zh || '') + '" loading="lazy">'
        : '<div class="feat-thumb-placeholder"></div>';
      return [
        '<a href="' + href + '" class="feat-card">',
        '  <div class="feat-thumb">' + imgHtml + '</div>',
        '  <div class="feat-body">',
        '    <p class="feat-label">'  + esc(b.label_en || '') + '</p>',
        '    <h3 class="feat-title">' + esc(b.title_zh || '') + '</h3>',
        '    <span class="feat-link"><span class="ci"></span> 了解更多</span>',
        '  </div>',
        '</a>'
      ].join('');
    }).join('');
  }

  // ── 董事長致詞 ─────────────────────────────────────────────
  // .msg-sect 只在 index.html；about.html 外層是 .pg-sect，fallback 到 document.body
  // CMS 欄位：quote, message_date, signature_image_url, signer_name, signer_title, signer_title_2, photo_url
  function renderPresident(data) {
    var section = document.querySelector('.msg-sect') || document.body;
    var edges = (data.presidentMessage && data.presidentMessage.edges) || [];
    if (!edges.length) return;

    var msg = fieldsToObj(edges[0].node);

    var quote = section.querySelector('.msg-quote');
    if (quote && msg.quote) {
      quote.innerHTML = esc(msg.quote).replace(/\n/g, '<br>');
    }

    var sigBlock = section.querySelector('.msg-sig-block');
    if (sigBlock) {
      // Line 1：日期
      var dateEl = sigBlock.querySelector('.msg-date');
      if (dateEl && msg.message_date) dateEl.textContent = msg.message_date;

      // Line 2：手寫簽名圖片（有 URL 才顯示）
      var sigWrap = sigBlock.querySelector('.msg-signature');
      var sigImg  = sigBlock.querySelector('.msg-sig-img');
      if (sigImg && msg.signature_image_url) {
        sigImg.src = msg.signature_image_url;
        sigImg.alt = esc(msg.signer_name || '簽名');
        if (sigWrap) sigWrap.style.display = '';
      }

      // Line 3：姓名
      var nameEl = sigBlock.querySelector('.msg-name strong');
      if (nameEl && msg.signer_name) nameEl.textContent = msg.signer_name;

      // Line 4：職稱 1（公司名稱）
      var title1El = sigBlock.querySelector('.msg-title1');
      if (title1El && msg.signer_title) title1El.textContent = msg.signer_title;

      // Line 5：職稱 2（職位）
      var title2El = sigBlock.querySelector('.msg-title2');
      if (title2El && msg.signer_title_2) title2El.textContent = msg.signer_title_2;
    }

    var photo = section.querySelector('.msg-photo img');
    if (photo && msg.photo_url) {
      photo.src = msg.photo_url;
      photo.alt = msg.signer_name || '董事長';
    }
  }

  // ── 初始化 ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    fetchData()
      .then(function (json) {
        var d = json.data || {};
        renderHero(d);
        renderNews(d);
        renderBusiness(d);
        renderPresident(d);
      })
      .catch(function (err) {
        // 靜默 fallback：保持靜態 HTML 不變
        if (typeof console !== 'undefined') {
          console.warn('[metaobjects] 載入失敗，使用靜態內容', err);
        }
      });
  });
})();
