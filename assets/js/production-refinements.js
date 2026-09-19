(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a[href]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === '/pollo-colombiano?v=20260915') link.setAttribute('href', '/pollo-colombiano');
      if (href === '/pollo-brasil?v=20260915') link.setAttribute('href', '/pollo-brasil');
    });
    if (location.pathname.indexOf('pollo-colombiano') !== -1) {
      var heroPhoto = document.querySelector('.poultry-hero figure img');
      var heroCaption = document.querySelector('.poultry-hero figure figcaption');
      if (heroPhoto) {
        heroPhoto.src = '/imagenes/pollo/planta-procesamiento-referencia.jpg';
        heroPhoto.alt = 'Procesamiento avícola, fotografía de referencia';
      }
      if (heroCaption) heroCaption.textContent = 'Fotografía de referencia. No representa una instalación propia de GLV.';
    }
    if (location.pathname.indexOf('pollo-brasil') !== -1) {
      var brazilPhoto = document.querySelector('.poultry-hero figure img');
      if (brazilPhoto) {
        brazilPhoto.style.height = '500px';
        brazilPhoto.style.minHeight = '0';
        brazilPhoto.style.objectPosition = 'center 72%';
      }
    }
    if (location.pathname.indexOf('proteinas-huevo') !== -1) {
      var porkPhoto = document.querySelector('.protein-photo-pending');
      if (porkPhoto) porkPhoto.innerHTML = '<img src="/imagenes/cerdo-procesamiento-referencia.jpg" alt="Procesamiento porcino, fotografía de referencia" loading="lazy"><figcaption>Fotografía de referencia. No representa una instalación propia de GLV.</figcaption>';
    }
  });
})();
