import { api } from "../api.js";

const BASE = import.meta.env.VITE_API_URL || "https://misaelvalencia-production.up.railway.app";

async function fetchAsBase64(url) {
  try {
    const proxyUrl = `${BASE}/media/proxy?url=${encodeURIComponent(url)}`;
    console.log("[media-bind] fetchAsBase64 → proxy:", proxyUrl.substring(0, 120));
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      console.error("[media-bind] proxy returned", res.status, "for", url.substring(0, 80));
      return null;
    }
    const blob = await res.blob();
    const b64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => { console.error("[media-bind] FileReader error"); resolve(null); };
      reader.readAsDataURL(blob);
    });
    console.log("[media-bind] base64 ok, length:", b64?.length || 0);
    return b64;
  } catch (err) {
    console.error("[media-bind] fetchAsBase64 error:", err.message);
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

    console.log("[media-bind] bindMediaForDocument — category:", category, "origin:", origin, "docId:", doc.id);

    if (!category) {
      console.warn("[media-bind] no category — skipping bind");
      return { main: null, secondary: [], branding: null, meta: null };
    }

    const bindResult = await api.bindMedia({ category, origin: origin || undefined, limit: 6 });
    console.log("[media-bind] bindMedia result:", JSON.stringify({
      main: bindResult?.main?.id,
      mainUrl: bindResult?.main?.public_url?.substring(0, 60),
      secondary: (bindResult?.secondary || []).map(a => a?.id),
      branding: bindResult?.branding?.map?.(a => a?.id),
    }));

    const mainAsset = bindResult?.main || null;
    const secondaryAssets = Array.isArray(bindResult?.secondary) ? bindResult.secondary.slice(0, 2) : [];
    const brandingAssets = Array.isArray(bindResult?.branding) ? bindResult.branding : [];
    const brandingAsset = brandingAssets[0] || null;

    const toUrl = (a) => a?.public_url || a?.thumbnail_url || null;

    const mainUrl    = toUrl(mainAsset);
    const sec0Url    = toUrl(secondaryAssets[0]);
    const sec1Url    = toUrl(secondaryAssets[1]);
    const brandUrl   = toUrl(brandingAsset);

    console.log("[media-bind] URLs to fetch — main:", mainUrl?.substring(0, 60), "sec0:", sec0Url?.substring(0, 60), "brand:", brandUrl?.substring(0, 60));

    const [main, sec0, sec1, branding] = await Promise.all([
      mainUrl    ? fetchAsBase64(mainUrl)    : Promise.resolve(null),
      sec0Url    ? fetchAsBase64(sec0Url)    : Promise.resolve(null),
      sec1Url    ? fetchAsBase64(sec1Url)    : Promise.resolve(null),
      brandUrl   ? fetchAsBase64(brandUrl)   : Promise.resolve(null),
    ]);

    console.log("[media-bind] base64 results — main:", !!main, "sec0:", !!sec0, "sec1:", !!sec1, "branding:", !!branding);

    return { main, secondary: [sec0, sec1].filter(Boolean), branding, meta: bindResult };
  } catch (err) {
    console.error("[media-bind] bindMediaForDocument error:", err.message);
    return { main: null, secondary: [], branding: null, meta: null };
  }
}
