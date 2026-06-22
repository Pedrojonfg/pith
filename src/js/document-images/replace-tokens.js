import { PITH_IMAGE_TOKEN_RE } from "./tokens.js";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {import("../session-types.js").DocumentImage|null} image
 * @param {string|null} signedUrl
 */
export function buildImageHtml(image, signedUrl) {
  if (!signedUrl) {
    return `<span class="slow-doc-image-placeholder" role="img" aria-label="Image unavailable">Image unavailable</span>`;
  }
  const w = image?.width ? ` width="${Number(image.width)}"` : "";
  const h = image?.height ? ` height="${Number(image.height)}"` : "";
  const alt = escapeHtml(image?.visionDescription || "Document figure");
  return `<img class="slow-doc-image" src="${escapeHtml(signedUrl)}" alt="${alt}"${w}${h} loading="lazy" decoding="async" />`;
}

/**
 * @param {string} markdown
 * @param {import("../session-types.js").DocumentImage[]} images
 * @param {Record<string, string|null>} [urlById]
 */
export function replacePithImageTokens(markdown, images, urlById = {}) {
  const byId = new Map((images || []).map((img) => [img.imageId, img]));
  return String(markdown || "").replace(PITH_IMAGE_TOKEN_RE, (_, imageId) => {
    const image = byId.get(imageId);
    if (!image) {
      return buildImageHtml(null, null);
    }
    const url = urlById[imageId] ?? null;
    return `\n\n${buildImageHtml(image, url)}\n\n`;
  });
}
