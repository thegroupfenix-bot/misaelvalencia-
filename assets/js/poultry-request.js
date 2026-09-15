(function () {
  'use strict';
  var fields = [['role', 'Perfil'], ['product', 'Producto'], ['cut', 'Corte o categoría'], ['volume', 'Volumen estimado (toneladas)'], ['destination', 'Destino'], ['packaging', 'Presentación y empaque'], ['temperature', 'Conservación']];
  var names = {buy:'Comprar pollo colombiano',sell:'Exportar producto avícola con GLV',whole:'Pollo entero',parts:'Partes',breast:'Pechuga',leg:'Pierna pernil',thigh:'Muslo',wings:'Alas',feet:'Patas',offal:'Menudencias permitidas',special:'Cortes especiales',frozen:'Congelado',chilled:'Refrigerado, si aplica'};
  window.glvPoultryQuoteDetails = function () {
    if (document.getElementById('gn_division').value !== 'pollo-colombiano') return '';
    return fields.map(function (field) {
      var value = document.getElementById('poultry_' + field[0]).value.trim();
      if (['role','cut','temperature'].includes(field[0])) value = names[value] || value;
      return value ? field[1] + ': ' + value : '';
    }).filter(Boolean).join('\n') + '\n';
  };
  document.addEventListener('DOMContentLoaded', function () {
    var division = document.getElementById('gn_division');
    var group = document.getElementById('poultry-request');
    var params = new URLSearchParams(location.search);
    if (params.get('division') === 'pollo-colombiano') {
      division.value = 'pollo-colombiano';
      var role = params.get('poultry');
      if (role === 'buy' || role === 'sell') document.getElementById('poultry_role').value = role;
    }
    function sync() {
      var active = division.value === 'pollo-colombiano';
      group.hidden = !active;
      group.querySelectorAll('input,select').forEach(function (field) { field.disabled = !active; });
      document.getElementById('poultry_role').required = active;
    }
    sync();
    division.addEventListener('change', sync);
    division.dispatchEvent(new Event('change'));
  });
})();
