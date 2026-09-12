(function () {
  'use strict';
  var fields = [
    ['product', 'Producto'], ['volume', 'Volumen (toneladas)'],
    ['origin', 'Origen de interés'], ['port', 'Puerto colombiano'],
    ['importer', 'Empresa importadora'], ['city', 'Ciudad de destino'],
    ['packaging', 'Tipo de empaque'], ['daily', 'Capacidad diaria de retiro (toneladas/día)'],
    ['storage', 'Días requeridos de almacenamiento']
  ];
  var serviceNames = {
    international: 'Suministro internacional de fertilizantes',
    colombia: 'Gestión portuaria y nacionalización en Colombia',
    domestic: 'Logística nacional y entrega final (operación separada)'
  };
  window.glvAgriQuoteDetails = function () {
    if (document.getElementById('gn_division').value !== 'fertilizantes') return '';
    var service = document.getElementById('agri_service').value;
    var lines = ['Servicio requerido: ' + (serviceNames[service] || '')];
    fields.forEach(function (field) {
      var value = document.getElementById('agri_' + field[0]).value.trim();
      if (value) lines.push(field[1] + ': ' + value);
    });
    return lines.join('\n') + '\n';
  };
  document.addEventListener('DOMContentLoaded', function () {
    var division = document.getElementById('gn_division');
    var group = document.getElementById('agri-request');
    var service = document.getElementById('agri_service');
    function sync() {
      var active = division.value === 'fertilizantes';
      group.hidden = !active;
      group.querySelectorAll('input, select').forEach(function (field) { field.disabled = !active; });
      service.required = active;
    }
    sync();
    division.addEventListener('change', sync);
  });
})();
