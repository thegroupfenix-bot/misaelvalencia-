import { api } from "../api.js";

const BASE = import.meta.env.VITE_API_URL || "https://misaelvalencia-production.up.railway.app";

function getAuthHeader() {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("glv_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function fetchAsBase64(url, assetId) {
  const label = assetId ? `asset#${assetId}` : url.substring(0, 60);
  const t0 = Date.now();
  try {
    const proxyUrl = `${BASE}/media/proxy?url=${encodeURIComponent(url)}`;
    const headers = getAuthHeader();
    console.log("[media-bind] fetch →", label, "| auth:", !!headers.Authorization, "| proxy:", proxyUrl.substring(0, 120));
    const res = await fetch(proxyUrl, { headers });
    const elapsed = Date.now() - t0;
    if (!res.ok) {
      console.error("[media-bind] proxy", res.status, "for", label, `(${elapsed}ms)`);
      return null;
    }
    const blob = await res.blob();
    const b64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => { console.error("[media-bind] FileReader error for", label); resolve(null); };
      reader.readAsDataURL(blob);
    });
    console.log("[media-bind] base64 ok —", label, `| length:${b64?.length || 0} | ${Date.now() - t0}ms`);
    return b64 || null;
  } catch (err) {
    console.error("[media-bind] fetchAsBase64 error for", label, ":", err.message, `(${Date.now() - t0}ms)`);
    return null;
  }
}

export async function bindMediaForDocument(doc) {
  console.log("[media-bind] ── pipeline start ── docId:", doc.id, "type:", doc.type);
  try {
    const cd = doc.commercialData || doc.commercial_data;
    let parsedCd = cd;
    if (typeof cd === "string") { try { parsedCd = JSON.parse(cd); } catch { parsedCd = null; } }
    const firstRow = parsedCd?.rows?.[0];

    // API returns camelCase (productCategory); also check snake_case and row fallback
    const category =
      doc.productCategory ||
      doc.product_category ||
      firstRow?.category ||
      doc.product ||
      null;

    // Product-level code (e.g. "CATTLE" vs "SHEEP") — already produced by
    // CommercialEngine.jsx as row.product. Resolving media off this instead
    // of `category` alone is what prevents cross-product image bleed
    // (e.g. a BOVINE operation rendering OVINE imagery).
    const productCode =
      firstRow?.product ||
      doc.productCode ||
      null;

    const origin = doc.origin || firstRow?.origin || null;

    console.log("[media-bind] category:", category, "| productCode:", productCode, "| origin:", origin, "| firstRow.category:", firstRow?.category, "| doc.productCategory:", doc.productCategory);

    if (!category) {
      console.warn("[media-bind] no category resolved — skipping bind. doc keys:", Object.keys(doc).join(", "));
      return { main: null, secondary: [], branding: null, meta: null };
    }

    console.log("[media-bind] calling api.bindMedia — category:", category, "productCode:", productCode, "origin:", origin);
    const bindResult = await api.bindMedia({ category, productCode: productCode || undefined, origin: origin || undefined, limit: 6 });
    console.log("[media-bind] resolution:", bindResult?.resolution);

    const mainAsset      = bindResult?.main || null;
    const secondaryAssets = Array.isArray(bindResult?.secondary) ? bindResult.secondary.slice(0, 2) : [];
    const brandingAssets  = Array.isArray(bindResult?.branding)  ? bindResult.branding               : [];
    const brandingAsset   = brandingAssets[0] || null;

    console.log("[media-bind] bindMedia matched:", bindResult?.totalMatched, "| main:", mainAsset?.id, "tags:", mainAsset?.tags, "| sec:", secondaryAssets.map(a => a?.id), "| brand:", brandingAsset?.id);

    const toUrl = (a) => a?.public_url || a?.thumbnail_url || null;

    const mainUrl  = toUrl(mainAsset);
    const sec0Url  = toUrl(secondaryAssets[0]);
    const sec1Url  = toUrl(secondaryAssets[1]);
    const brandUrl = toUrl(brandingAsset);

    console.log("[media-bind] URLs — main:", mainUrl?.substring(0, 70), "| sec0:", sec0Url?.substring(0, 60), "| brand:", brandUrl?.substring(0, 60));

    const [main, sec0, sec1, branding] = await Promise.all([
      mainUrl  ? fetchAsBase64(mainUrl,  mainAsset?.id)          : Promise.resolve(null),
      sec0Url  ? fetchAsBase64(sec0Url,  secondaryAssets[0]?.id) : Promise.resolve(null),
      sec1Url  ? fetchAsBase64(sec1Url,  secondaryAssets[1]?.id) : Promise.resolve(null),
      brandUrl ? fetchAsBase64(brandUrl, brandingAsset?.id)      : Promise.resolve(null),
    ]);

    console.log("[media-bind] ── pipeline complete ── main:", !!main, "| sec0:", !!sec0, "| sec1:", !!sec1, "| branding:", !!branding);

    return { main, secondary: [sec0, sec1].filter(Boolean), branding, meta: bindResult };
  } catch (err) {
    console.error("[media-bind] bindMediaForDocument error:", err.message);
    return { main: null, secondary: [], branding: null, meta: null };
  }
}
