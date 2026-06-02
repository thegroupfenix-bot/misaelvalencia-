// AI-powered media classification using Claude vision (Haiku — fast + cheap)
// Requires ANTHROPIC_API_KEY in Railway environment variables

let _client = null;

function isEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient() {
  if (!_client) {
    const Anthropic = require("@anthropic-ai/sdk");
    _client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are an agricultural/livestock/export media classifier for GLV Holding Group,
a global agricultural trading company dealing in live animals (sheep, cattle, goats),
frozen/fresh meat, exotic Colombian fruits, grains, and vegetable oils.

Analyze images and return ONLY valid JSON with no markdown, no explanation.`;

const CLASSIFY_PROMPT = `Analyze this image and return JSON ONLY:
{
  "category": one of: "products/live-animals" | "products/meat" | "products/fruits/colombia" | "products/fruits/brazil" | "products/fruits/peru" | "products/fruits/chile" | "products/fruits" | "products/grains" | "products/oils" | "products/frozen" | "operations/inspection" | "operations/loading" | "operations/certificates" | "operations/audit" | "certificates/halal" | "certificates/sgs" | "certificates/health" | "certificates/origin" | "branding/logos" | "corporate" | "general",
  "subcategory": "short descriptor e.g. dorper | avocado-hass | halal-cert | loading-port",
  "country_origin": "country name or null",
  "product_relation": one of: "LIVE_ANIMALS" | "FROZEN_MEAT" | "COLOMBIAN_EXOTIC_FRUITS" | "FRUIT_PRODUCTS" | "COMMODITIES" | "OILS" | null,
  "smart_name": "kebab-case commercial filename without extension, e.g. dorper-sheep-brazil-export | pitahaya-colombia-premium-fresh | halal-certificate-2026",
  "tags": ["3 to 6 relevant commercial tags"],
  "confidence": 0.0 to 1.0
}`;

async function classifyImage(imageBuffer, mimeType) {
  if (!isEnabled()) return null;

  // Only classify actual images, not PDFs
  if (!mimeType.startsWith("image/")) return null;

  // Limit to jpeg/png/webp/gif for Claude vision
  const supported = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!supported.includes(mimeType)) return null;

  try {
    const client = getClient();
    // Resize to max 1MB for API efficiency (sharp not available here — send as-is if small)
    const base64 = imageBuffer.toString("base64");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          { type: "text", text: CLASSIFY_PROMPT },
        ],
      }],
    });

    const text = response.content[0]?.text?.trim() || "";
    // Strip any accidental markdown fences
    const json = text.replace(/^```json?\s*/i, "").replace(/\s*```$/, "").trim();
    const result = JSON.parse(json);
    console.log(`AI classified: ${result.smart_name} (${result.category}) conf=${result.confidence}`);
    return result;
  } catch (err) {
    console.warn("AI classification skipped:", err.message);
    return null;
  }
}

module.exports = { classifyImage, isEnabled };
