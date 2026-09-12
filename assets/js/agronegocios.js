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
})();
