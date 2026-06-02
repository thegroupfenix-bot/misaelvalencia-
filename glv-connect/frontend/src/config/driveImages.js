export const DRIVE_IMAGES = {
  ovinos_planta:   { fileId: "", label: "Ovinos en planta/cuarentena" },
  carcasa_cordero: { fileId: "", label: "Carcasa completa cordero" },
  corte_rack:      { fileId: "", label: "Rack de cordero premium" },
  corte_pierna:    { fileId: "", label: "Pierna de cordero" },
  corte_lomo:      { fileId: "", label: "Lomo / chuletas" },
  planta_proceso:  { fileId: "", label: "Planta de proceso" },
  granos_soya:     { fileId: "", label: "Soya en grano" },
  granos_maiz:     { fileId: "", label: "Maíz amarillo" },
  aceite_palma:    { fileId: "", label: "Aceite de palma" },
  aguacate_hass:   { fileId: "", label: "Aguacate Hass exportación" },
  pulpa_iqf:       { fileId: "", label: "Pulpas IQF empacadas" },
  logo_azul:       { fileId: "", label: "Logo GLV tinta azul" },
  logo_blanco:     { fileId: "", label: "Logo GLV blanco" },
  buque_ganado:    { fileId: "", label: "Buque ganadero" },
};

export const driveUrl = (fileId) =>
  fileId ? `https://drive.google.com/uc?export=view&id=${fileId}` : null;

export const PRODUCT_IMAGE_MAP = {
  "Ovinos": "ovinos_planta",
  "Bovinos": "ovinos_planta",
  "Soya": "granos_soya",
  "Maíz": "granos_maiz",
  "Aceite": "aceite_palma",
  "Aguacate": "aguacate_hass",
  "Pulpa": "pulpa_iqf",
};
