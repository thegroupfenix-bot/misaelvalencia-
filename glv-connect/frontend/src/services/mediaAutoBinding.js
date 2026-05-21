import { api } from "../api.js";

const BASE = import.meta.env.VITE_API_URL || "https://misaelvalencia-production.up.railway.app";

async function fetchAsBase64(url) {
  try {
    // Route through backend proxy to bypass browser CORS restrictions on R2 public URLs
    const proxyUrl = `${BASE}/media/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function bindMediaForDocument(doc) {
  try {
    const cd = doc.commercialData || doc.commercial_data;
    let parsedCd = cd;
    if (typeof cd === "string") { try { parsedCd = JSON.parse(cd); } catch { parsedCd = null; } }
    const firstRow = parsedCd?.rows?.[0];
    const category = doc.product_category || firstRow?.category || doc.product || null;
    const origin = doc.origin || firstRow?.origin || null;

    if (!category) return { main: null, secondary: [], branding: null, meta: null };

    const bindResult = await api.bindMedia({ category, origin: origin || undefined, limit: 6 });

    const mainAsset = bindResult?.main || null;
    const secondaryAssets = Array.isArray(bindResult?.secondary) ? bindResult.secondary.slice(0, 2) : [];
    const brandingAssets = Array.isArray(bindResult?.branding) ? bindResult.branding : [];
    const brandingAsset = brandingAssets[0] || null;

    const toUrl = (a) => a?.public_url || a?.thumbnail_url || null;

    const [main, sec0, sec1, branding] = await Promise.all([
      toUrl(mainAsset)   ? fetchAsBase64(toUrl(mainAsset))   : Promise.resolve(null),
      toUrl(secondaryAssets[0]) ? fetchAsBase64(toUrl(secondaryAssets[0])) : Promise.resolve(null),
      toUrl(secondaryAssets[1]) ? fetchAsBase64(toUrl(secondaryAssets[1])) : Promise.resolve(null),
      toUrl(brandingAsset) ? fetchAsBase64(toUrl(brandingAsset)) : Promise.resolve(null),
    ]);

    return { main, secondary: [sec0, sec1].filter(Boolean), branding, meta: bindResult };
  } catch {
    return { main: null, secondary: [], branding: null, meta: null };
  }
}
