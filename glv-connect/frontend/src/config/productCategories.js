// Product Category Engine — GLV SAT v3
// Each category defines its products, dynamic form fields, units, and calculation mode.

export const PRODUCT_CATEGORIES = {
  LIVE_ANIMALS: {
    label: { es: "Animales Vivos", en: "Live Animals", fr: "Animaux Vivants", zh: "活体动物", ar: "حيوانات حية" },
    color: "#059669",
    icon: "ti-paw",
    products: {
      SHEEP: { label: { es: "Ovinos", en: "Sheep", fr: "Ovins" }, defaultBreed: "Merino / Dorper / Rambouillet" },
      CATTLE: { label: { es: "Bovinos", en: "Cattle", fr: "Bovins" }, defaultBreed: "Nelore / Angus / Hereford" },
    },
    units: ["Cabezas / Head", "KG Peso Vivo / Live KG", "Tonelada Métrica / MT"],
    defaultUnit: "KG Peso Vivo / Live KG",
    calculationMode: "LIVE_ANIMAL",
    containerCapacity: null,
    fields: [
      { key: "breed",           label: { es: "Raza",                  en: "Breed" },              type: "text",   required: false, placeholder: "Merino / Dorper" },
      { key: "headCount",       label: { es: "Número de Cabezas",     en: "Head Count" },         type: "number", required: true  },
      { key: "avgWeight",       label: { es: "Peso Promedio (kg)",    en: "Average Weight (kg)" },type: "number", required: true,  default: 45 },
      { key: "weightRange",     label: { es: "Rango de Peso",         en: "Weight Range" },       type: "text",   required: false, placeholder: "38–55 kg" },
      { key: "mortalityMargin", label: { es: "Margen Mortalidad (%)", en: "Mortality Margin (%)" },type: "number",required: false, default: 2 },
      { key: "quarantineDays",  label: { es: "Días de Cuarentena",   en: "Quarantine Days" },    type: "number", required: false, default: 30 },
      { key: "vetInspection",   label: { es: "Inspección Veterinaria",en: "Vet Inspection" },     type: "select", options: ["SGS","MAPA","SENASA","Estatal"], required: false },
      { key: "halalCert",       label: { es: "Certificación Halal",  en: "Halal Certification" }, type: "checkbox",required: false },
    ],
  },

  FROZEN_MEAT: {
    label: { es: "Carnes Congeladas", en: "Frozen Meat", fr: "Viandes Congelées", zh: "冷冻肉类", ar: "اللحوم المجمدة" },
    color: "#2563eb",
    icon: "ti-meat",
    products: {
      LAMB_CUTS: { label: { es: "Cortes de Cordero", en: "Lamb Cuts" } },
      BEEF_CUTS: { label: { es: "Cortes de Res",     en: "Beef Cuts" } },
      CARCASSES: { label: { es: "Carcasas",           en: "Carcasses" } },
    },
    units: ["KG", "Tonelada Métrica / MT", "Contenedor / Container", "Cartón / Carton"],
    defaultUnit: "Tonelada Métrica / MT",
    calculationMode: "WEIGHT",
    containerCapacity: 25,
    fields: [
      { key: "cutType",      label: { es: "Tipo de Corte",         en: "Cut Type" },       type: "text",   required: true,  placeholder: "Rack, Pierna, Lomo..." },
      { key: "packaging",    label: { es: "Empaque",               en: "Packaging" },      type: "select", options: ["Vacuum","Cryovac","IQF Bulk","Master Carton"], required: true },
      { key: "netWeight",    label: { es: "Peso Neto por Unidad",  en: "Net Weight/Unit" },type: "number", required: false },
      { key: "grossWeight",  label: { es: "Peso Bruto por Unidad", en: "Gross Weight/Unit" },type: "number", required: false },
      { key: "freezingTemp", label: { es: "Temperatura (-°C)",     en: "Temp (-°C)" },     type: "number", required: false, default: 18 },
    ],
  },

  COMMODITIES: {
    label: { es: "Granos y Commodities", en: "Grains & Commodities", fr: "Matières Premières", zh: "大宗商品", ar: "السلع الأساسية" },
    color: "#d97706",
    icon: "ti-grain",
    products: {
      SOYBEANS: { label: { es: "Soja en Grano", en: "Soybeans" },     containerCapacity: 27 },
      CORN:     { label: { es: "Maíz Amarillo", en: "Yellow Corn" },  containerCapacity: 27 },
      WHEAT:    { label: { es: "Trigo",          en: "Wheat" },         containerCapacity: 25 },
      RICE:     { label: { es: "Arroz",          en: "Rice" },          containerCapacity: 27 },
      SUGAR:    { label: { es: "Azúcar Blanca",  en: "White Sugar" }, containerCapacity: 27 },
    },
    units: ["Tonelada Métrica / MT", "Contenedor / Container", "Saco / Bag", "Granel / Bulk Vessel"],
    defaultUnit: "Tonelada Métrica / MT",
    calculationMode: "WEIGHT",
    containerCapacity: 27,
    fields: [
      { key: "moisture",    label: { es: "Humedad (%)",         en: "Moisture (%)" },        type: "number", required: false, default: 14 },
      { key: "protein",     label: { es: "Proteína (%)",        en: "Protein (%)" },         type: "number", required: false },
      { key: "brokenPct",   label: { es: "Granos Rotos (%)",   en: "Broken Grains (%)" },   type: "number", required: false },
      { key: "packaging",   label: { es: "Presentación",       en: "Packaging" },           type: "select", options: ["Bolsa 50kg","Big Bag 1MT","Granel / Bulk","Contenedor"], required: true },
      { key: "bagCapacity", label: { es: "Caps. Contenedor (MT)",en: "Container Cap (MT)" },type: "number", required: false, default: 27 },
      { key: "gmo",         label: { es: "OGM / GMO",          en: "GMO Status" },          type: "select", options: ["Non-GMO","GMO","IP Non-GMO"], required: false },
    ],
  },

  OILS: {
    label: { es: "Aceites Vegetales", en: "Vegetable Oils", fr: "Huiles Végétales", zh: "植物油", ar: "الزيوت النباتية" },
    color: "#7c3aed",
    icon: "ti-droplet",
    products: {
      PALM_OIL:     { label: { es: "Aceite de Palma",  en: "Palm Oil" } },
      SOYBEAN_OIL:  { label: { es: "Aceite de Soja",  en: "Soybean Oil" } },
    },
    units: ["Litro / Liter", "Tonelada Métrica / MT", "Contenedor / Container", "IBC Tank", "Flexi Tank"],
    defaultUnit: "Tonelada Métrica / MT",
    calculationMode: "WEIGHT",
    containerCapacity: 20,
    fields: [
      { key: "oilType",     label: { es: "Tipo de Aceite",  en: "Oil Type" },       type: "text",   required: true },
      { key: "packaging",   label: { es: "Presentación",    en: "Packaging" },     type: "select", options: ["IBC 1000L","Flexi Tank","Bidón 200L","Granel Cisterna"], required: true },
      { key: "ffa",         label: { es: "Acidez FFA (%)", en: "FFA Acidity (%)" },type: "number", required: false },
      { key: "gmo",         label: { es: "GMO Status",      en: "GMO Status" },     type: "select", options: ["Non-GMO","GMO","IP Non-GMO"], required: false },
    ],
  },

  FRUIT_PRODUCTS: {
    label: { es: "Frutas y Pulpas", en: "Fruit Products", fr: "Fruits & Pulpes", zh: "水果产品", ar: "منتجات الفاكهة" },
    color: "#db2777",
    icon: "ti-plant",
    products: {
      AVOCADO:    { label: { es: "Aguacate Hass",   en: "Hass Avocado" } },
      BANANA:     { label: { es: "Banano Cavendish",en: "Cavendish Banana" } },
      PULP_IQF:   { label: { es: "Pulpa IQF",       en: "IQF Pulp" } },
    },
    units: ["KG", "Tonelada Métrica / MT", "Paleta / Pallet", "Caja / Box"],
    defaultUnit: "Tonelada Métrica / MT",
    calculationMode: "WEIGHT",
    containerCapacity: 18,
    fields: [
      { key: "fruitType",  label: { es: "Tipo de Fruta",   en: "Fruit Type" },     type: "text",    required: true },
      { key: "frozen",     label: { es: "IQF / Congelado", en: "IQF / Frozen" },   type: "select",  options: ["Fresco / Fresh","IQF","Congelado / Frozen","Deshidratado"], required: true },
      { key: "packaging",  label: { es: "Empaque",         en: "Packaging" },      type: "text",    required: false, placeholder: "Caja 10kg, Bolsa 5kg..." },
      { key: "caliber",    label: { es: "Calibre / Grado", en: "Grade / Caliber" },type: "text",    required: false },
    ],
  },

  EGGS: {
    label: { es: "Huevos y Derivados", en: "Eggs & Derivatives", fr: "Œufs", zh: "蛋类产品", ar: "البيض" },
    color: "#ea580c",
    icon: "ti-egg",
    products: {
      FERTILE_EGGS:  { label: { es: "Huevo Fértil",     en: "Fertile Eggs" } },
      COMMERCIAL:    { label: { es: "Huevo Comercial",  en: "Commercial Eggs" } },
    },
    units: ["Unidad / Unit", "Caja / Box", "Paleta / Pallet", "Contenedor / Container"],
    defaultUnit: "Caja / Box",
    calculationMode: "UNIT",
    containerCapacity: 1080000, // units per container
    fields: [
      { key: "eggType",    label: { es: "Tipo de Huevo",   en: "Egg Type" },     type: "select",  options: ["Fértil Incubable","Comercial Blanco","Comercial Rojo","Orgánico"], required: true },
      { key: "hatchRate",  label: { es: "Tasa de Eclosión (%)",en: "Hatch Rate (%)" },type: "number", required: false, default: 90 },
      { key: "packaging",  label: { es: "Empaque",         en: "Packaging" },    type: "select",  options: ["Caja 360u","Caja 180u","Bandeja 30u","Paleta"], required: true },
      { key: "certSanitary",label:{ es: "Cert. Sanitario", en: "Sanitary Cert" },type: "text",   required: false },
    ],
  },

  CUSTOM: {
    label: { es: "Otro Producto", en: "Other Product", fr: "Autre Produit", zh: "其他产品", ar: "منتج آخر" },
    color: "#6b7280",
    icon: "ti-package",
    products: {},
    units: ["KG", "Tonelada Métrica / MT", "Unidad / Unit", "Contenedor / Container", "Litro / Liter", "Otro"],
    defaultUnit: "KG",
    calculationMode: "WEIGHT",
    containerCapacity: 25,
    fields: [
      { key: "customName",  label: { es: "Nombre del Producto",    en: "Product Name" },      type: "text",   required: true },
      { key: "customDesc",  label: { es: "Descripción / Specs",    en: "Description / Specs" },type: "textarea",required: false },
      { key: "customUnit",  label: { es: "Unidad de Medida",       en: "Unit of Measure" },   type: "text",   required: false },
      { key: "customHs",    label: { es: "Código HS / Arancelario",en: "HS Code" },            type: "text",   required: false },
    ],
  },
};

// Delivery frequency options
export const DELIVERY_FREQUENCIES = [
  { id: "ONE_SHIPMENT", label: { es: "Embarque único", en: "Single Shipment" } },
  { id: "MONTHLY",      label: { es: "Mensual",         en: "Monthly" } },
  { id: "BIMONTHLY",    label: { es: "Bimestral",       en: "Bimonthly" } },
  { id: "QUARTERLY",    label: { es: "Trimestral",      en: "Quarterly" } },
  { id: "CUSTOM",       label: { es: "Personalizado",   en: "Custom Schedule" } },
];

// Currencies
export const CURRENCIES = [
  { code: "USD", symbol: "$",  name: "US Dollar" },
  { code: "EUR", symbol: "€",  name: "Euro" },
  { code: "BRL", symbol: "R$", name: "Real Brasileño" },
  { code: "COP", symbol: "$",  name: "Peso Colombiano" },
  { code: "AED", symbol: "د.إ",name: "Dirham UAE" },
  { code: "CNY", symbol: "¥",  name: "Yuan Chino" },
];

// Incoterms
export const INCOTERMS = ["CFR","CIF","FOB","EXW","DAP","DDP","FAS","FCA"];

// All 15 system roles
export const ALL_ROLES = [
  { id: "SUPER_ADMIN",        label: { es: "Super Administrador",     en: "Super Admin" },        level: 100 },
  { id: "CORPORATE_ADMIN",    label: { es: "Admin Corporativo",       en: "Corporate Admin" },    level: 90 },
  { id: "CFO",                label: { es: "Director Financiero",     en: "CFO" },                level: 80 },
  { id: "DIRECTOR",           label: { es: "Director",                en: "Director" },           level: 75 },
  { id: "COMMERCIAL_DIRECTOR",label: { es: "Director Comercial",      en: "Commercial Director" },level: 70 },
  { id: "COMPLIANCE",         label: { es: "Cumplimiento / Legal",    en: "Compliance / Legal" }, level: 65 },
  { id: "ACCOUNTING",         label: { es: "Contabilidad",            en: "Accounting" },         level: 60 },
  { id: "TREASURY",           label: { es: "Tesorería",               en: "Treasury" },           level: 60 },
  { id: "AUDIT",              label: { es: "Auditoría",               en: "Audit" },              level: 55 },
  { id: "TAX_REVIEWER",       label: { es: "Revisor Fiscal",          en: "Tax Reviewer" },       level: 50 },
  { id: "COUNTRY_ACCOUNTANT", label: { es: "Contador País",           en: "Country Accountant" }, level: 50 },
  { id: "LOGISTICS",          label: { es: "Logística",               en: "Logistics" },          level: 45 },
  { id: "AGENTE",             label: { es: "Agente Comercial",        en: "Commercial Agent" },   level: 40 },
  { id: "CLIENT",             label: { es: "Cliente",                 en: "Client" },             level: 20 },
  { id: "SUPPLIER",           label: { es: "Proveedor",               en: "Supplier" },           level: 20 },
];
