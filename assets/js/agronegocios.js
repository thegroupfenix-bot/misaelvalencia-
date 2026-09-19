(function () {
  'use strict';
  var select = document.getElementById('agriLanguage');
  var valid = ['es', 'en', 'pt-br', 'ar', 'zh'];
  function setLanguage(lang) {
    if (!valid.includes(lang)) lang = 'es';
    document.body.className = 'lang-' + lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    select.value = lang;
    document.querySelectorAll('img[data-alt-es]').forEach(function (img) {
      img.alt = img.getAttribute('data-alt-' + lang) || img.getAttribute('data-alt-es');
    });
    try { localStorage.setItem('glv-lang', lang); } catch (e) { /* Keep language usable without storage. */ }
  }
  var initial = 'es';
  try { initial = localStorage.getItem('glv-lang') || 'es'; } catch (e) { /* Use Spanish by default. */ }
  setLanguage(initial);
  select.addEventListener('change', function () { setLanguage(this.value); });
  if (location.pathname.indexOf('agronegocios-fertilizantes') !== -1) {
    var mapBrand = document.querySelector('#mapa-puertos .map-brand span');
    if (mapBrand) mapBrand.textContent = 'Sudamérica · Colombia';
  }
  if (location.pathname.indexOf('pollo-colombiano') !== -1) {
    var poultryActions = document.querySelector('.poultry-hero .poultry-actions');
    if (poultryActions && !poultryActions.querySelector('[data-poultry-brazil-link]')) {
      var brazil = document.createElement('a');
      brazil.href = '/pollo-brasil';
      brazil.className = 'button';
      brazil.setAttribute('data-poultry-brazil-link', 'true');
      brazil.innerHTML = '<span lang-es>Ver pollo brasileño</span><span lang-en>See Brazilian chicken</span><span lang-pt-br>Ver frango brasileiro</span><span lang-ar>عرض الدجاج البرازيلي</span><span lang-zh>查看巴西鸡肉</span>';
      poultryActions.appendChild(brazil);
    }
  }
})();
