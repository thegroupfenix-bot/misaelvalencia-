(function () {
  'use strict';
  function translate() {
    var lang = document.documentElement.lang || 'es';
    document.querySelectorAll('option[data-agri-es]').forEach(function (option) {
      option.textContent = option.getAttribute('data-agri-' + lang) || option.getAttribute('data-agri-es');
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    translate();
    document.querySelectorAll('.agri-menu-panel').forEach(function (panel) {
      if (panel.querySelector('[data-glv-poultry-link]')) return;
      var poultry = document.createElement('a');
      poultry.href = '/pollo';
      poultry.setAttribute('data-glv-poultry-link', 'true');
      poultry.innerHTML = '<span lang-es>Pollo / Avícola</span><span lang-en>Poultry</span><span lang-pt-br>Avícola</span><span lang-ar>الدواجن</span><span lang-zh>禽类</span>';
      panel.insertBefore(poultry, panel.firstChild);
    });
    document.querySelectorAll('nav').forEach(function (nav) {
      if (nav.querySelector('[data-glv-poultry-topnav]')) return;
      var quote = nav.querySelector('a[href^="/cotizacion"]');
      if (!quote) return;
      var poultryTop = document.createElement('a');
      poultryTop.href = '/pollo';
      poultryTop.setAttribute('data-glv-poultry-topnav', 'true');
      poultryTop.textContent = 'Pollo / Avícola';
      poultryTop.style.cssText = 'white-space:nowrap;font-weight:700;text-decoration:none;';
      quote.parentNode.insertBefore(poultryTop, quote);
    });
    document.querySelectorAll('a[href^="/pollo-colombiano"]').forEach(function (link) {
      if (link.querySelector('h3')) link.href = '/pollo';
    });
    new MutationObserver(translate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    var params = new URLSearchParams(location.search);
    if (params.get('division') === 'fertilizantes') {
      var field = document.getElementById('gn_division');
      if (field) field.value = 'fertilizantes';
    }
    document.addEventListener('click', function (event) {
      document.querySelectorAll('.agri-menu[open]').forEach(function (menu) {
        if (!menu.contains(event.target)) menu.removeAttribute('open');
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') document.querySelectorAll('.agri-menu[open]').forEach(function (menu) { menu.removeAttribute('open'); });
    });
  });
})();
