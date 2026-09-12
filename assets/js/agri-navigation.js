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
