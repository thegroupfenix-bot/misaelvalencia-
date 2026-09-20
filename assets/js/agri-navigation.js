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
    document.querySelectorAll('.nav-links').forEach(function (menu) {
      if (menu.querySelector('[data-glv-poultry-topnav]')) return;
      var item = document.createElement('li');
      item.setAttribute('data-glv-poultry-topnav', 'true');
      item.innerHTML = '<a href="/pollo"><span lang-es>Pollo</span><span lang-en>Poultry</span><span lang-pt-br>Avícola</span><span lang-ar>الدواجن</span><span lang-zh>禽类</span></a>';
      var glvMenu = menu.querySelector('.nav-dropdown');
      menu.insertBefore(item, glvMenu || null);
    });
    document.querySelectorAll('nav .nav-right').forEach(function (tools) {
      if (tools.querySelector('[data-glv-poultry-mobile]')) return;
      var mobileLink = document.createElement('a');
      mobileLink.href = '/pollo';
      mobileLink.className = 'glv-poultry-mobile';
      mobileLink.setAttribute('data-glv-poultry-mobile', 'true');
      mobileLink.innerHTML = '<span lang-es>Pollo</span><span lang-en>Poultry</span><span lang-pt-br>Avícola</span><span lang-ar>الدواجن</span><span lang-zh>禽类</span>';
      tools.insertBefore(mobileLink, tools.firstChild);
    });
    document.querySelectorAll('a[href^="/pollo-colombiano"]').forEach(function (link) {
      if (!link.querySelector('h3')) return;
      link.href = '/pollo';
      var title = link.querySelector('h3');
      var copy = link.querySelector('p');
      title.innerHTML = '<span lang-es>Pollo internacional</span><span lang-en>International poultry</span><span lang-pt-br>Frango internacional</span><span lang-ar>الدواجن الدولية</span><span lang-zh>国际禽类</span>';
      copy.innerHTML = '<span lang-es>Opciones comerciales de Colombia y Brasil para elegir el origen de cada operación.</span><span lang-en>Commercial options from Colombia and Brazil to choose the origin for each operation.</span><span lang-pt-br>Opções comerciais da Colômbia e do Brasil para escolher a origem de cada operação.</span><span lang-ar>خيارات تجارية من كولومبيا والبرازيل لاختيار منشأ كل عملية.</span><span lang-zh>提供哥伦比亚和巴西商业选择，以确定每项业务的产地。</span>';
    });
    document.querySelectorAll('a[href^="/pollo-colombiano"]').forEach(function (link) {
      if (!link.querySelector('h3')) link.href = '/pollo-colombiano/';
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
