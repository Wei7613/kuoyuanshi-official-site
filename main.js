document.addEventListener('DOMContentLoaded', function () {

  /* ── 功能 0：防止 href="#" 佔位連結跳回頁頂 ── */
  document.querySelectorAll('a[href="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ── 功能 1：新聞 Tab 切換 ── */
  var tabBtns = document.querySelectorAll('.tab-btn');
  var newsItems = document.querySelectorAll('.news-item');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var target = btn.getAttribute('data-tab');
      newsItems.forEach(function (item) {
        if (target === 'all' || item.getAttribute('data-cat') === target) {
          item.style.display = 'grid';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  /* ── 功能 2：Header 捲動效果 ── */
  var hdr = document.querySelector('.hdr');
  if (hdr) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        hdr.classList.add('scrolled');
      } else {
        hdr.classList.remove('scrolled');
      }
    });
  }

  /* ── 功能 3：漢堡選單（行動版）── */
  var btnMenu = document.getElementById('btn-menu');
  var mobNav  = document.getElementById('mob-nav');
  if (btnMenu && mobNav) {
    btnMenu.addEventListener('click', function () {
      var isOpen = mobNav.classList.toggle('open');
      btnMenu.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    mobNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobNav.classList.remove('open');
        btnMenu.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('click', function (e) {
      if (!hdr || hdr.contains(e.target)) return;
      mobNav.classList.remove('open');
      btnMenu.setAttribute('aria-expanded', 'false');
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 768) {
        mobNav.classList.remove('open');
        btnMenu.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── 功能 4：搜尋按鈕點擊 ── */
  var searchBtn = document.querySelector('.ico-search');
  if (searchBtn) {
    searchBtn.addEventListener('click', function () {
      var keyword = prompt('請輸入搜尋關鍵字：');
      if (keyword && keyword.trim() !== '') {
        alert('搜尋功能開發中，關鍵字：' + keyword);
      }
    });
  }

  /* ── Nav active highlight on scroll ── */
  var sections = document.querySelectorAll('section[id]');
  var navItems = document.querySelectorAll('#gnav > ul > li');
  window.addEventListener('scroll', function () {
    var cur = '';
    sections.forEach(function (s) {
      if (window.scrollY >= s.offsetTop - 200) cur = s.id;
    });
    navItems.forEach(function (li) {
      var a = li.querySelector('a');
      li.classList.toggle('active', a && a.getAttribute('href') === '#' + cur);
    });
  });

  /* ── Smooth scroll for anchor links ── */
  document.querySelectorAll('#gnav a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

});

console.log('%c KUOYUANSHI INDUSTRIAL © 2026', 'color:#CC1A00;font-weight:bold;');
