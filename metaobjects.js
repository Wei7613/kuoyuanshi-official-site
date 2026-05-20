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
      '  newsItems: metaobjects(type: "kuoyuanshi_news_item", first: 50) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  businessAreas: metaobjects(type: "kuoyuanshi_business_area", first: 10) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  presidentMessage: metaobjects(type: "kuoyuanshi_president_message", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  homeMessage: metaobjects(type: "kuoyuanshi_home_message", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  homeConfig: metaobjects(type: "kuoyuanshi_home_config", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  aboutCards: metaobjects(type: "kuoyuanshi_about_card", first: 10) {',
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

  // ── Hero 輪播（JS 控制：背景圖 + caption 同步輪換）───────────
  // 每 5 秒換一張，各 slide 的 title/description/cta 同步更新
  var OVERLAYS = [
    'linear-gradient(160deg,rgba(20,10,5,.92) 0%,rgba(60,30,10,.5) 100%)',
    'linear-gradient(160deg,rgba(5,10,20,.92) 0%,rgba(10,30,60,.5) 100%)',
    'linear-gradient(160deg,rgba(5,20,5,.92) 0%,rgba(10,50,20,.5) 100%)'
  ];

  function renderHero(data) {
    var section = document.getElementById('mv');
    if (!section) return;
    var edges = (data.heroSlides && data.heroSlides.edges) || [];
    if (!edges.length) { section.style.opacity = '1'; return; }

    var slides    = sortByOrder(edges.map(function (e) { return fieldsToObj(e.node); }));
    var domSlides = section.querySelectorAll('.mv-slide');
    var caption   = section.querySelector('.mv-caption');
    var h1        = caption && caption.querySelector('h1');
    var p         = caption && caption.querySelector('p');
    var ctaLink   = caption && caption.querySelector('.mv-story-link');

    // 設定每張 slide 的背景圖，並停用 CSS keyframe 動畫
    slides.forEach(function (s, i) {
      if (!domSlides[i]) return;
      domSlides[i].style.animation = 'none';
      domSlides[i].style.opacity   = '0';
      if (s.image_url) {
        domSlides[i].style.backgroundImage =
          OVERLAYS[i % OVERLAYS.length] + ', url("' + s.image_url + '")';
      }
    });

    // 切換到指定 slide：同步更新背景 opacity 與 caption 文字
    function showSlide(idx) {
      var s = slides[idx];
      // 所有 slide 淡出，目標 slide 淡入（CSS transition 產生 cross-fade）
      domSlides.forEach(function (el) { el.style.opacity = '0'; });
      if (domSlides[idx]) domSlides[idx].style.opacity = '1';
      // caption 更新
      if (h1 && s.title)       h1.textContent = s.title;
      if (p  && s.description) p.textContent  = s.description;
      if (ctaLink) {
        if (s.cta_text) {
          var icon = ctaLink.querySelector('span.ci');
          ctaLink.textContent = '';
          if (icon) ctaLink.appendChild(icon);
          ctaLink.appendChild(document.createTextNode(' ' + s.cta_text));
        }
        if (s.cta_url) ctaLink.href = s.cta_url;
      }
    }

    var current = 0;
    showSlide(0);
    section.style.opacity = '1';

    // 多於 1 張才啟動自動輪播
    if (slides.length > 1) {
      setInterval(function () {
        current = (current + 1) % slides.length;
        showSlide(current);
      }, 5000);
    }
  }

  // ── 最新消息 ───────────────────────────────────────────────
  // index.html → #news-list（每個頁籤最多 5 則）
  // news.html  → #news-full-list（顯示全部）
  function renderNews(data) {
    var indexList = document.getElementById('news-list');
    var fullList  = document.getElementById('news-full-list');
    var list = indexList || fullList;
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

    // index.html 每個頁籤上限 5 則；news.html 不限
    attachTabFilter(list, indexList ? 5 : 0);
  }

  function attachTabFilter(list, maxPerTab) {
    var tabs = document.querySelectorAll('.tab-btn');
    if (!tabs.length) return;

    function applyFilter(cat) {
      var shown = 0;
      list.querySelectorAll('.news-item').forEach(function (item) {
        var matches = (cat === 'all' || item.getAttribute('data-cat') === cat);
        if (matches && (!maxPerTab || shown < maxPerTab)) {
          item.style.display = '';
          shown++;
        } else {
          item.style.display = 'none';
        }
      });
    }

    // 套用初始頁籤狀態
    var activeBtn = document.querySelector('.tab-btn.active');
    applyFilter(activeBtn ? activeBtn.getAttribute('data-tab') : 'all');

    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabs.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        applyFilter(btn.getAttribute('data-tab'));
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

  // ── 董事長致詞（共用渲染）──────────────────────────────────
  // CMS 欄位：quote, message_date, signature_image_url, signer_name, signer_title, signer_title_2, photo_url
  function _applyMsgData(section, msg) {
    var quote = section.querySelector('.msg-quote');
    if (quote && msg.quote) {
      quote.innerHTML = esc(msg.quote).replace(/\n/g, '<br>');
    }

    var sigBlock = section.querySelector('.msg-sig-block');
    if (sigBlock) {
      var dateEl  = sigBlock.querySelector('.msg-date');
      if (dateEl) dateEl.textContent = msg.message_date || '';

      var sigWrap = sigBlock.querySelector('.msg-signature');
      var sigImg  = sigBlock.querySelector('.msg-sig-img');
      if (sigImg) {
        if (msg.signature_image_url) {
          sigImg.src = msg.signature_image_url;
          sigImg.alt = esc(msg.signer_name || '簽名');
          if (sigWrap) sigWrap.style.display = '';
        } else {
          if (sigWrap) sigWrap.style.display = 'none';
        }
      }

      var nameEl   = sigBlock.querySelector('.msg-name strong');
      if (nameEl) nameEl.textContent = msg.signer_name || '';

      var title1El = sigBlock.querySelector('.msg-title1');
      if (title1El) title1El.textContent = msg.signer_title || '';

      var title2El = sigBlock.querySelector('.msg-title2');
      if (title2El) title2El.textContent = msg.signer_title_2 || '';
    }

    var photo = section.querySelector('.msg-photo img');
    if (photo && msg.photo_url) {
      photo.src = msg.photo_url;
      photo.alt = msg.signer_name || '董事長';
    }
  }

  // 首頁（index.html）— kuoyuanshi_home_message
  function renderHomePresident(data) {
    var section = document.querySelector('.msg-sect');
    if (!section) return;
    var edges = (data.homeMessage && data.homeMessage.edges) || [];
    if (edges.length) {
      var msg = fieldsToObj(edges[0].node);
      _applyMsgData(section, msg);
      // cta_url：控制「了解更多關於我們」連結目標
      if (msg.cta_url) {
        var ctaLink = section.querySelector('a[href]');
        if (ctaLink) ctaLink.href = msg.cta_url;
      }
    }
    section.style.opacity = '1';
  }

  // About 頁（about.html）— kuoyuanshi_president_message
  function renderAboutPresident(data) {
    var inner = document.querySelector('.pg-sect.gray .msg-inner');
    if (!inner) return;
    var section = inner.closest ? inner.closest('.pg-sect.gray') : null;
    var edges = (data.presidentMessage && data.presidentMessage.edges) || [];
    if (edges.length) _applyMsgData(inner, fieldsToObj(edges[0].node));
    if (section) section.style.opacity = '1';
  }

  // ── 首頁通用設定（feat-sect / about-sect / caution-bar / footer）──
  // CMS 欄位：business_label, business_heading, about_label, about_heading,
  //           about_overview_text, about_overview_url, notice_label, notice_text,
  //           news_more_url, footer_address_tw, footer_address_vn, footer_email,
  //           footer_linkedin_url, footer_facebook_url, footer_youtube_url, footer_copyright
  function renderHomeConfig(data) {
    var edges = (data.homeConfig && data.homeConfig.edges) || [];
    if (!edges.length) return;
    var cfg = fieldsToObj(edges[0].node);
    var el;

    // feat-sect 標題
    el = document.querySelector('.feat-sect .sect-label');
    if (el && cfg.business_label) el.textContent = cfg.business_label;
    el = document.querySelector('.feat-sect h2');
    if (el && cfg.business_heading) el.textContent = cfg.business_heading;

    // about-sect 標題
    el = document.querySelector('.about-sect .sect-label');
    if (el && cfg.about_label) el.textContent = cfg.about_label;
    el = document.querySelector('.about-sect h2');
    if (el && cfg.about_heading) el.textContent = cfg.about_heading;

    // about-sect 總覽連結
    var overviewLink = document.querySelector('.about-hd a');
    if (overviewLink) {
      if (cfg.about_overview_url) overviewLink.href = cfg.about_overview_url;
      if (cfg.about_overview_text) {
        var icon = overviewLink.querySelector('span.ci');
        overviewLink.textContent = '';
        if (icon) overviewLink.appendChild(icon);
        overviewLink.appendChild(document.createTextNode(' ' + cfg.about_overview_text));
      }
    }

    // 公告列
    el = document.querySelector('.caution-label');
    if (el && cfg.notice_label) el.textContent = cfg.notice_label;
    el = document.querySelector('.caution-text');
    if (el && cfg.notice_text) el.textContent = cfg.notice_text;

    // 最新消息「查看全部」連結
    el = document.querySelector('.news-more-link');
    if (el && cfg.news_more_url) el.href = cfg.news_more_url;

    // footer 聯絡資訊
    el = document.querySelector('[data-ftr="address-tw"]');
    if (el && cfg.footer_address_tw) el.textContent = cfg.footer_address_tw;
    el = document.querySelector('[data-ftr="address-vn"]');
    if (el && cfg.footer_address_vn) el.textContent = cfg.footer_address_vn;
    el = document.querySelector('[data-ftr="email"]');
    if (el && cfg.footer_email) {
      el.textContent = cfg.footer_email;
      el.href = 'mailto:' + cfg.footer_email;
    }

    // footer 社群連結
    el = document.querySelector('[data-ftr="linkedin"]');
    if (el && cfg.footer_linkedin_url) el.href = cfg.footer_linkedin_url;
    el = document.querySelector('[data-ftr="facebook"]');
    if (el && cfg.footer_facebook_url) el.href = cfg.footer_facebook_url;
    el = document.querySelector('[data-ftr="youtube"]');
    if (el && cfg.footer_youtube_url) el.href = cfg.footer_youtube_url;

    // footer 版權文字
    el = document.querySelector('.ftr-copy');
    if (el && cfg.footer_copyright) el.textContent = cfg.footer_copyright;
  }

  // ── 關於我們卡片（about-sect）──────────────────────────────────
  // CMS 欄位：label_en, title_zh, image_url, url, sort_order
  function renderAboutCards(data) {
    var grid = document.querySelector('.about-cards');
    if (!grid) return;
    var edges = (data.aboutCards && data.aboutCards.edges) || [];
    if (!edges.length) return;

    var cards = sortByOrder(edges.map(function (e) { return fieldsToObj(e.node); }));
    grid.innerHTML = cards.map(function (c) {
      var href    = esc(c.url || '#');
      var imgHtml = c.image_url
        ? '<img src="' + esc(c.image_url) + '" alt="' + esc(c.title_zh || '') + '" loading="lazy">'
        : '<div class="ac-thumb-placeholder"></div>';
      return [
        '<a href="' + href + '" class="about-card">',
        '  <div class="ac-thumb">' + imgHtml + '</div>',
        '  <div class="ac-body">',
        '    <p class="ac-label">'  + esc(c.label_en || '') + '</p>',
        '    <h3 class="ac-title">' + esc(c.title_zh || '') + '</h3>',
        '    <span class="ac-link"><span class="ci"></span> 了解更多</span>',
        '  </div>',
        '</a>'
      ].join('');
    }).join('');
  }

  // ── 初始化 ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    fetchData()
      .then(function (json) {
        var d = json.data || {};
        renderHero(d);
        renderNews(d);
        renderBusiness(d);
        renderHomePresident(d);
        renderAboutPresident(d);
        renderHomeConfig(d);
        renderAboutCards(d);
        // about-sect 最後統一恢復可見度
        var ab = document.querySelector('.about-sect');
        if (ab) ab.style.opacity = '1';
      })
      .catch(function (err) {
        // 靜默 fallback：保持靜態 HTML，同時恢復所有 opacity 避免內容永遠隱藏
        var mv = document.getElementById('mv');
        if (mv) mv.style.opacity = '1';
        var s = document.querySelector('.msg-sect');
        if (s) s.style.opacity = '1';
        var a = document.querySelector('.pg-sect.gray .msg-inner');
        if (a && a.closest) { var p = a.closest('.pg-sect.gray'); if (p) p.style.opacity = '1'; }
        var ab = document.querySelector('.about-sect');
        if (ab) ab.style.opacity = '1';
        if (typeof console !== 'undefined') {
          console.warn('[metaobjects] 載入失敗，使用靜態內容', err);
        }
      });
  });
})();
