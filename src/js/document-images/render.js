import { markdownToHtml } from "../markdown.js";
import { prepareMarkdownWithImages } from "./prepare-markdown.js";

/**
 * Render Slow Mode markdown slice with inline document images.
 * @param {string} markdown
 * @param {import("../session-types.js").DocumentImage[]} images
 */
export async function renderSlowMarkdownWithImages(markdown, images) {
  const withImages = await prepareMarkdownWithImages(markdown, images);
  return markdownToHtml(withImages);
}
