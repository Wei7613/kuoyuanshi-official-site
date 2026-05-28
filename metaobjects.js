/* metaobjects.js — 從 Shopify Storefront API 動態載入官網 CMS 內容
 *
 * 漸進增強策略：
 *   - 有 Metaobjects 資料 → 取代 DOM 靜態內容
 *   - API 失敗或無資料 → 保持 HTML 靜態內容不變（fallback）
 *
 * 管理後台：Shopify Admin → Content → Metaobjects
 *   - 首頁設定    (kuoyuanshi_home_cfg)          → Hero、標頭、公告、董事長訊息
 *   - 首頁板塊    (kuoyuanshi_home_blocks)       → 核心事業 × 3、關於我們卡片 × 4
 *   - Footer     (kuoyuanshi_footer)            → 4 欄導覽、聯絡資訊、社群、品牌文字、版權
 *   - 最新消息    (kuoyuanshi_news_item)         → 首頁 + news.html 共用
 *   - 關於頁主內容 (kuoyuanshi_president_message) → about.html 公司簡介 / 核心價值 / 董事長 / 相關資訊
 *   - 關於頁歷程   (kuoyuanshi_about_history)     → about.html 發展歷程
 *   - 聯絡我們     (kuoyuanshi_contact_page)      → contact.html 聯絡方式
 *   - 事業地圖     (kuoyuanshi_business_map)      → brand-agency.html 標題 / 頁籤 / layer 標籤
 */
(function () {
  /* 安全逾時：5 秒後強制移除遮罩，避免 API 失敗時頁面永遠空白 */
  setTimeout(function () { document.body.classList.add('cms-ready'); }, 5000);

  var DOMAIN   = 'jwhu9y-ef.myshopify.com';
  var TOKEN    = '5ec473e0b0f60f8c6334134f405a9035';
  var VERSION  = '2024-10';
  var ENDPOINT = 'https://' + DOMAIN + '/api/' + VERSION + '/graphql.json';

  var QUERY = JSON.stringify({
    query: [
      '{',
      '  newsItems: metaobjects(type: "kuoyuanshi_news_item", first: 50) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  aboutPage: metaobject(handle: {type: "kuoyuanshi_president_message", handle: "about-html"}) { fields { key value } }',
      '  aboutHistory: metaobject(handle: {type: "kuoyuanshi_about_history", handle: "about-history"}) { fields { key value } }',
      '  homeConfig: metaobjects(type: "kuoyuanshi_home_cfg", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  homeBlocks: metaobjects(type: "kuoyuanshi_home_blocks", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  footerData: metaobjects(type: "kuoyuanshi_footer", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  businessPage: metaobjects(type: "kuoyuanshi_business_page", first: 1) {',
      '    edges { node { fields { key value } } }',
      '  }',
      '  businessMap: metaobject(handle: {type: "kuoyuanshi_business_map", handle: "business-map"}) { fields { key value } }',
      '  contactPage: metaobject(handle: {type: "kuoyuanshi_contact_page", handle: "contact"}) { fields { key value } }',
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

  // ── Hero 輪播（從 homeConfig 讀取 hero1_* ~ hero3_*）────────
  var OVERLAYS = [
    'linear-gradient(160deg,rgba(20,10,5,.92) 0%,rgba(60,30,10,.5) 100%)',
    'linear-gradient(160deg,rgba(5,10,20,.92) 0%,rgba(10,30,60,.5) 100%)',
    'linear-gradient(160deg,rgba(5,20,5,.92) 0%,rgba(10,50,20,.5) 100%)'
  ];

  function renderHero(data) {
    var section = document.getElementById('mv');
    if (!section) return;
    var edges = (data.homeConfig && data.homeConfig.edges) || [];
    if (!edges.length) { section.style.opacity = '1'; return; }
    var cfg = fieldsToObj(edges[0].node);

    var slides = [];
    for (var i = 1; i <= 3; i++) {
      var s = {
        title:       cfg['hero' + i + '_title'],
        description: cfg['hero' + i + '_description'],
        image_url:   cfg['hero' + i + '_image_url'],
        cta_text:    cfg['hero' + i + '_cta_text'],
        cta_url:     cfg['hero' + i + '_cta_url']
      };
      if (s.title || s.image_url) slides.push(s);
    }
    if (!slides.length) { section.style.opacity = '1'; return; }

    var domSlides = section.querySelectorAll('.mv-slide');
    var caption   = section.querySelector('.mv-caption');
    var h1        = caption && caption.querySelector('h1');
    var p         = caption && caption.querySelector('p');
    var ctaLink   = caption && caption.querySelector('.mv-story-link');

    slides.forEach(function (s, i) {
      if (!domSlides[i]) return;
      domSlides[i].style.animation = 'none';
      domSlides[i].style.opacity   = '0';
      if (s.image_url) {
        domSlides[i].style.backgroundImage =
          OVERLAYS[i % OVERLAYS.length] + ', url("' + s.image_url + '")';
      }
    });

    function showSlide(idx) {
      var s = slides[idx];
      domSlides.forEach(function (el) { el.style.opacity = '0'; });
      if (domSlides[idx]) domSlides[idx].style.opacity = '1';
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
    if (slides.length > 1) {
      setInterval(function () {
        current = (current + 1) % slides.length;
        showSlide(current);
      }, 5000);
    }
  }

  // ── 最新消息（index.html 每頁籤最多 5 則；news.html 不限）──
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

  // ── 核心事業（從 homeBlocks 讀取 biz1_* ~ biz3_*）──────────
  function renderBusiness(data) {
    var grid = document.querySelector('.feat-grid');
    if (!grid) return;
    var edges = (data.homeBlocks && data.homeBlocks.edges) || [];
    if (!edges.length) return;
    var blocks = fieldsToObj(edges[0].node);

    var areas = [];
    for (var i = 1; i <= 3; i++) {
      var label = blocks['biz' + i + '_label_en'];
      var title = blocks['biz' + i + '_title_zh'];
      if (label || title) {
        areas.push({
          label_en:  label,
          title_zh:  title,
          image_url: blocks['biz' + i + '_image_url'],
          url:       blocks['biz' + i + '_url']
        });
      }
    }
    if (!areas.length) return;

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
  function _applyMsgData(section, msg) {
    var quote = section.querySelector('.msg-quote');
    if (quote && msg.quote) {
      quote.innerHTML = esc(msg.quote).replace(/\n/g, '<br>');
    }

    var sigBlock = section.querySelector('.msg-sig-block');
    if (sigBlock) {
      var dateEl = sigBlock.querySelector('.msg-date');
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

  // 首頁董事長訊息（從 homeConfig president_* 欄位讀取）
  function renderHomePresident(data) {
    var section = document.querySelector('.msg-sect');
    if (!section) return;
    var edges = (data.homeConfig && data.homeConfig.edges) || [];
    if (edges.length) {
      var cfg = fieldsToObj(edges[0].node);
      var msg = {
        quote:               cfg.president_quote,
        photo_url:           cfg.president_photo_url,
        message_date:        cfg.president_message_date,
        signer_name:         cfg.president_signer_name,
        signer_title:        cfg.president_signer_title,
        signer_title_2:      cfg.president_signer_title2,
        signature_image_url: cfg.president_signature_url || null
      };
      _applyMsgData(section, msg);
      if (cfg.president_partner_label) {
        var labelEl = section.querySelector('.msg-label');
        if (labelEl) labelEl.textContent = cfg.president_partner_label;
      }
      if (cfg.president_cta_url) {
        var ctaLink = section.querySelector('a[href]');
        if (ctaLink) ctaLink.href = cfg.president_cta_url;
      }
    }
    section.style.opacity = '1';
  }

  // About 頁（about.html）— kuoyuanshi_president_message
  function renderAboutPresident(data) {
    var inner = document.querySelector('.pg-sect.gray .msg-inner');
    if (!inner) return;
    var section = inner.closest ? inner.closest('.pg-sect.gray') : null;
    if (data.aboutPage) _applyMsgData(inner, fieldsToObj(data.aboutPage));
    if (section) section.style.opacity = '1';
  }

  function renderAboutPage(data) {
    var m  = data.aboutPage    ? fieldsToObj(data.aboutPage)    : {};
    // hist 讀關於頁歷程 type；若查不到則保留靜態 HTML fallback
    var mh = data.aboutHistory ? fieldsToObj(data.aboutHistory) : m;
    var el;

    // 公司簡介 section（第一個 .pg-sect，不含 .gray）
    var profileSect = document.querySelector(".pg-sect:not(.gray):not(.hist-sect)");
    if (profileSect) {
      el = profileSect.querySelector(".sect-label"); if (el && m.profile_label) el.textContent = m.profile_label;
      el = profileSect.querySelector("h2"); if (el && m.profile_heading) el.textContent = m.profile_heading;
      var paras = profileSect.querySelectorAll(".prose p:not(.sect-label)");
      ["profile_desc1","profile_desc2","profile_desc3"].forEach(function(k,i){ if (paras[i] && m[k]) paras[i].textContent = m[k]; });
      el = profileSect.querySelector(".pg-img img"); if (el && m.profile_image_url) el.src = m.profile_image_url;
    }

    // 核心價值 section（第一個 .pg-sect.gray，不含 .msg-inner）
    var valuesSects = document.querySelectorAll(".pg-sect.gray");
    var valuesSect = null;
    for (var i = 0; i < valuesSects.length; i++) { if (!valuesSects[i].querySelector(".msg-inner")) { valuesSect = valuesSects[i]; break; } }
    if (valuesSect) {
      el = valuesSect.querySelector(".sect-label"); if (el && m.values_label) el.textContent = m.values_label;
      el = valuesSect.querySelector("h2"); if (el && m.values_heading) el.textContent = m.values_heading;
      var valCards = valuesSect.querySelectorAll(".val-card");
      [1,2,3].forEach(function(n, i) {
        if (!valCards[i]) return;
        el = valCards[i].querySelector(".val-num"); if (el && m["val"+n+"_num"]) el.textContent = m["val"+n+"_num"];
        el = valCards[i].querySelector(".val-title"); if (el && m["val"+n+"_title"]) el.textContent = m["val"+n+"_title"];
        el = valCards[i].querySelector(".val-desc"); if (el && m["val"+n+"_desc"]) el.textContent = m["val"+n+"_desc"];
      });
    }

    // 發展歷程 section（讀 aboutHistory entry）
    var histSect = document.querySelector(".hist-sect");
    if (histSect) {
      el = histSect.querySelector(".sect-label"); if (el && mh.hist_label) el.textContent = mh.hist_label;
      el = histSect.querySelector("h2"); if (el && mh.hist_heading) el.textContent = mh.hist_heading;
      var histItems = histSect.querySelectorAll(".hist-item");
      [1,2,3,4,5,6,7,8].forEach(function(n, i) {
        if (!histItems[i]) return;
        var container = histItems[i].classList.contains("above") ? histItems[i].querySelector(".hist-top") : histItems[i].querySelector(".hist-bot");
        if (!container) return;
        el = container.querySelector(".hist-yr"); if (el && mh["hist"+n+"_year"]) el.textContent = mh["hist"+n+"_year"];
        el = container.querySelector(".hist-ev"); if (el && mh["hist"+n+"_event"]) el.textContent = mh["hist"+n+"_event"];
        el = container.querySelector(".hist-note"); if (el && mh["hist"+n+"_note"]) el.innerHTML = esc(mh["hist"+n+"_note"]).replace(/\n/g,"<br>");
        var imageUrl = mh["hist"+n+"_image_url"];
        if (imageUrl) {
          var photoWrap = container.querySelector(".hist-photo");
          if (!photoWrap) {
            photoWrap = document.createElement("div");
            photoWrap.className = "hist-photo";
            if (!histItems[i].classList.contains("above")) {
              photoWrap.style.marginTop = "12px";
              photoWrap.style.marginBottom = "0";
            }
            var yearEl = container.querySelector(".hist-yr");
            var noteEl = container.querySelector(".hist-note");
            if (histItems[i].classList.contains("above") && yearEl) {
              container.insertBefore(photoWrap, yearEl);
            } else if (noteEl && noteEl.nextSibling) {
              container.insertBefore(photoWrap, noteEl.nextSibling);
            } else {
              container.appendChild(photoWrap);
            }
          }
          var photoEl = photoWrap.querySelector("img");
          if (!photoEl) {
            photoEl = document.createElement("img");
            photoWrap.appendChild(photoEl);
          }
          photoEl.src = imageUrl;
          photoEl.alt = mh["hist"+n+"_event"] || mh["hist"+n+"_year"] || "";
          photoEl.loading = "lazy";
        }
      });
    }

    // 董事長致詞 section label
    var presidentSect = document.querySelector(".pg-sect.gray .msg-inner");
    if (presidentSect) {
      el = presidentSect.querySelector(".sect-label"); if (el && m.msg_label) el.textContent = m.msg_label;
    }

    // 相關資訊 section
    var relSect = document.querySelector(".rel-sect");
    if (relSect) {
      el = relSect.querySelector(".sect-label"); if (el && m.related_label) el.textContent = m.related_label;
      var relCards = relSect.querySelectorAll(".rel-card");
      [1,2,3].forEach(function(n, i) {
        if (!relCards[i]) return;
        if (m["rel"+n+"_url"]) relCards[i].href = m["rel"+n+"_url"];
        el = relCards[i].querySelector(".rel-cat"); if (el && m["rel"+n+"_cat"]) el.textContent = m["rel"+n+"_cat"];
        el = relCards[i].querySelector(".rel-title"); if (el && m["rel"+n+"_title"]) el.textContent = m["rel"+n+"_title"];
        el = relCards[i].querySelector(".rel-img img"); if (el && m["rel"+n+"_image_url"]) { el.src = m["rel"+n+"_image_url"]; el.alt = m["rel"+n+"_cat"] || ""; }
      });
    }
  }

  // ── 首頁通用設定（feat-sect / about-sect / caution-bar / footer）──
  function renderHomeConfig(data) {
    if (!document.getElementById('mv')) return;
    var edges = (data.homeConfig && data.homeConfig.edges) || [];
    if (!edges.length) return;
    var cfg = fieldsToObj(edges[0].node);
    var el;

    el = document.querySelector('.feat-sect .sect-label');
    if (el && cfg.business_label) el.textContent = cfg.business_label;
    el = document.querySelector('.feat-sect h2');
    if (el && cfg.business_heading) el.textContent = cfg.business_heading;

    el = document.querySelector('.about-sect .sect-label');
    if (el && cfg.about_label) el.textContent = cfg.about_label;
    el = document.querySelector('.about-sect h2');
    if (el && cfg.about_heading) el.textContent = cfg.about_heading;

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

    el = document.querySelector('.caution-label');
    if (el && cfg.notice_label) el.textContent = cfg.notice_label;
    el = document.querySelector('.caution-text');
    if (el && cfg.notice_text) el.textContent = cfg.notice_text;

    el = document.querySelector('.news-sect h2');
    if (el && cfg.news_heading) el.textContent = cfg.news_heading;

    el = document.querySelector('.news-more-link');
    if (el && cfg.news_more_url) el.href = cfg.news_more_url;

  }

  // ── Footer（從 kuoyuanshi_footer 讀取）────────────────────────
  function renderFooter(data) {
    var edges = (data.footerData && data.footerData.edges) || [];
    if (!edges.length) return;
    var f = fieldsToObj(edges[0].node);
    var el;

    // 4 欄導覽 — 欄標題為空則隱藏整欄
    for (var c = 1; c <= 4; c++) {
      var col = document.querySelector('[data-ftr-col="' + c + '"]');
      if (!col) continue;
      var heading = f['col' + c + '_heading'];
      if (!heading) { col.style.display = 'none'; continue; }
      col.style.display = '';
      var h3 = col.querySelector('h3');
      if (h3) h3.textContent = heading;
      var links = col.querySelectorAll('.ftr-list a');
      for (var i = 0; i < links.length; i++) {
        var n = i + 1;
        var txt = f['col' + c + '_link' + n + '_text'];
        var url = f['col' + c + '_link' + n + '_url'];
        if (txt !== undefined) links[i].textContent = txt;
        if (url !== undefined) links[i].href = url || '#';
      }
    }

    // 聯絡資訊（col4 特殊欄位）
    el = document.querySelector('[data-ftr="address-tw"]');
    if (el && f.address_tw) el.textContent = f.address_tw;
    el = document.querySelector('[data-ftr="address-vn"]');
    if (el && f.address_vn) el.textContent = f.address_vn;
    el = document.querySelector('[data-ftr="email"]');
    if (el && f.email) { el.textContent = f.email; el.href = 'mailto:' + f.email; }

    // 社群連結
    el = document.querySelector('[data-ftr="linkedin"]');
    if (el && f.linkedin_url) el.href = f.linkedin_url;
    el = document.querySelector('[data-ftr="facebook"]');
    if (el && f.facebook_url) el.href = f.facebook_url;
    el = document.querySelector('[data-ftr="youtube"]');
    if (el && f.youtube_url) el.href = f.youtube_url;

    // 品牌文字
    var brandCompany = (f.brand_company_name || '').trim();
    var brandCompanyEl = document.querySelector('[data-ftr="brand-company-name"]');
    var brandSepEl = document.querySelector('.ftr-brand-sep');
    if (brandCompanyEl) {
      brandCompanyEl.textContent = brandCompany;
      brandCompanyEl.style.display = brandCompany ? '' : 'none';
    }
    if (brandSepEl) {
      brandSepEl.style.display = brandCompany ? '' : 'none';
    }

    // 版權
    el = document.querySelector('[data-ftr="copyright"]');
    if (el && f.copyright) el.textContent = f.copyright;
  }

  // ── 關於我們卡片（從 homeBlocks 讀取 about1_* ~ about4_*）──
  function renderAboutCards(data) {
    var grid = document.querySelector('.about-cards');
    if (!grid) return;
    var edges = (data.homeBlocks && data.homeBlocks.edges) || [];
    if (!edges.length) return;
    var blocks = fieldsToObj(edges[0].node);

    var cards = [];
    for (var i = 1; i <= 4; i++) {
      var label = blocks['about' + i + '_label_en'];
      var title = blocks['about' + i + '_title_zh'];
      if (label || title) {
        cards.push({
          label_en:  label,
          title_zh:  title,
          image_url: blocks['about' + i + '_image_url'],
          url:       blocks['about' + i + '_url']
        });
      }
    }
    if (!cards.length) return;

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

  // ── 事業領域頁（business.html）──────────────────────────────
  function renderBusinessPage(data) {
    var section = document.querySelector('.biz-list');
    if (!section) return;

    var items = document.querySelectorAll('.biz-item');
    var edges = (data.businessPage && data.businessPage.edges) || [];
    if (!items.length || !edges.length) {
      section.style.opacity = '1';
      return;
    }

    var page = fieldsToObj(edges[0].node);
    items.forEach(function (item, index) {
      var prefix = 'biz' + (index + 1) + '_';
      var label = item.querySelector('.biz-label');
      var title = item.querySelector('.biz-title');
      var desc = item.querySelector('.biz-desc');
      var image = item.querySelector('.biz-thumb img');
      var link = item.querySelector('.biz-link');
      var labelValue = page[prefix + 'label_en'];
      var titleValue = page[prefix + 'title_zh'];
      var descValue = page[prefix + 'desc'];
      var imageValue = page[prefix + 'image_url'];
      var ctaTextValue = page[prefix + 'cta_text'];
      var ctaUrlValue = page[prefix + 'cta_url'];

      if (label && labelValue) label.textContent = labelValue;
      if (title && titleValue) title.textContent = titleValue;
      if (desc && descValue) desc.innerHTML = esc(descValue).replace(/\n/g, '<br>');

      if (image && imageValue) {
        image.src = imageValue;
        image.alt = titleValue || labelValue || '';
      }

      if (link) {
        if (ctaTextValue) {
          var icon = link.querySelector('span.ci');
          link.textContent = '';
          if (icon) link.appendChild(icon);
          link.appendChild(document.createTextNode(' ' + ctaTextValue));
        }
        if (ctaUrlValue) link.href = ctaUrlValue;
      }
    });

    section.style.opacity = '1';
  }

  // ── 事業地圖頁（brand-agency.html）───────────────────────────
  function renderBusinessMap(data) {
    if (!document.querySelector('[data-bmap-text]') || !data.businessMap) return;

    var page = fieldsToObj(data.businessMap);
    Object.keys(page).forEach(function (key) {
      var value = page[key];
      if (value === undefined || value === null) return;

      document.querySelectorAll('[data-bmap-text="' + key + '"]').forEach(function (el) {
        el.textContent = value;
      });
    });
  }

  // ── 聯絡我們頁（contact.html）──────────────────────────────
  function renderContactPage(data) {
    if (!document.getElementById('contact-page') || !data.contactPage) return;

    var page = fieldsToObj(data.contactPage);
    var multilineKeys = {
      tw_address_value: true,
      tw_hours_value: true,
      vn_address_value: true,
      vn_hours_value: true,
      response_note: true
    };

    Object.keys(page).forEach(function (key) {
      var value = page[key];
      if (value === undefined || value === null || value === '') return;

      document.querySelectorAll('[data-contact="' + key + '"]').forEach(function (el) {
        if (multilineKeys[key]) {
          el.innerHTML = esc(value).replace(/\n/g, '<br>');
        } else {
          el.textContent = value;
        }
      });

      document.querySelectorAll('[data-contact-placeholder="' + key + '"]').forEach(function (el) {
        el.placeholder = value;
      });

      document.querySelectorAll('[data-contact-option="' + key + '"]').forEach(function (el) {
        el.textContent = value;
      });
    });
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
        renderAboutPage(d);
        renderHomeConfig(d);
        renderFooter(d);
        renderAboutCards(d);
        renderBusinessPage(d);
        renderBusinessMap(d);
        renderContactPage(d);
        var ab = document.querySelector('.about-sect');
        if (ab) ab.style.opacity = '1';
        var fs = document.querySelector('.feat-sect');
        if (fs) fs.style.opacity = '1';
        var ns = document.querySelector('.news-sect');
        if (ns) ns.style.opacity = '1';
        var nfl = document.getElementById('news-full-list');
        if (nfl) nfl.style.opacity = '1';
        document.body.classList.add('cms-ready');
      })
      .catch(function (err) {
        var mv = document.getElementById('mv');
        if (mv) mv.style.opacity = '1';
        var s = document.querySelector('.msg-sect');
        if (s) s.style.opacity = '1';
        var a = document.querySelector('.pg-sect.gray .msg-inner');
        if (a && a.closest) { var p = a.closest('.pg-sect.gray'); if (p) p.style.opacity = '1'; }
        var ab = document.querySelector('.about-sect');
        if (ab) ab.style.opacity = '1';
        var fs = document.querySelector('.feat-sect');
        if (fs) fs.style.opacity = '1';
        var ns = document.querySelector('.news-sect');
        if (ns) ns.style.opacity = '1';
        var nfl = document.getElementById('news-full-list');
        if (nfl) nfl.style.opacity = '1';
        var biz = document.querySelector('.biz-list');
        if (biz) biz.style.opacity = '1';
        document.body.classList.add('cms-ready');
        if (typeof console !== 'undefined') {
          console.warn('[metaobjects] 載入失敗，使用靜態內容', err);
        }
      });
  });
})();
