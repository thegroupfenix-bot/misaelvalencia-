const IMG = "https://www.glvservicesexp.com/imagenes";
const BASE = "https://www.glvservicesexp.com";

const DEFAULTS = {
  title:       "GLV GOS — Global Operating System | GLV Holding Group",
  description: "Enterprise Export & Operations Infrastructure — GLV Global Food Services LLC | GLV Holding Group.",
  image:       `${IMG}/og-glv-corporate.png`,
  url:         BASE,
  type:        "website",
};

const VIEW_SEO = {
  dashboard: {
    title:       "Dashboard — GLV GOS",
    description: "Corporate operations dashboard — GLV Global Operating System.",
    image:       `${IMG}/og-glv-corporate.png`,
  },
  operations: {
    title:       "Operaciones & Logística — GLV GOS",
    description: "International export operations and logistics management — GLV Holding Group.",
    image:       `${IMG}/og-logistics-solutions.png`,
  },
  clients: {
    title:       "Clientes — GLV GOS",
    description: "Client management portal — GLV Holding Group.",
    image:       `${IMG}/og-glv-corporate.png`,
  },
  "gos-leads": {
    title:       "KYC Portal — GLV GOS",
    description: "Client onboarding, compliance review and KYC management — GLV Services SAS.",
    image:       `${IMG}/og-glv-kyc.png`,
  },
  "price-center": {
    title:       "Price Center — GLV GOS",
    description: "Agricultural and food product pricing — GLV Global Food Services.",
    image:       `${IMG}/og-food-products.png`,
  },
  livestock: {
    title:       "Livestock Export Programs — GLV GOS",
    description: "Live animal and livestock export programs — GLV Global Food Services.",
    image:       `${IMG}/og-livestock-export-programs.png`,
  },
  "media-center": {
    title:       "Media Center — GLV GOS",
    description: "Corporate media and document repository — GLV Holding Group.",
    image:       `${IMG}/og-glv-corporate.png`,
  },
  tasks: {
    title:       "Tareas & Calidad ISO — GLV GOS",
    description: "Quality management and task tracking — GLV Holding Group.",
    image:       `${IMG}/og-glv-corporate.png`,
  },
  finance: {
    title:       "Finanzas — GLV GOS",
    description: "Financial operations and reporting — GLV Holding Group.",
    image:       `${IMG}/og-glv-corporate.png`,
  },
};

function setMeta(attr, name, content) {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function applySeo(view) {
  const cfg   = VIEW_SEO[view] || {};
  const title = cfg.title       || DEFAULTS.title;
  const desc  = cfg.description || DEFAULTS.description;
  const image = cfg.image       || DEFAULTS.image;

  document.title = title;

  setMeta("property", "og:title",       title);
  setMeta("property", "og:description", desc);
  setMeta("property", "og:image",       image);
  setMeta("property", "og:type",        DEFAULTS.type);
  setMeta("property", "og:url",         DEFAULTS.url);
  setMeta("property", "og:site_name",   "GLV GOS");

  setMeta("name", "twitter:card",        "summary_large_image");
  setMeta("name", "twitter:title",       title);
  setMeta("name", "twitter:description", desc);
  setMeta("name", "twitter:image",       image);
}
