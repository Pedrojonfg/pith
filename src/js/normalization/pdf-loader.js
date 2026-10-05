import { deLog } from "../debug-enrich.js";
/**
 * Shared pdf.js dynamic loader (CDN in browser, local package in Node tests).
 */

const PDFJS_VERSION = "4.4.168";
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build`;

let pdfjsModulePromise = null;

export async function loadPdfJs() {
  if (!pdfjsModulePromise) {
    deLog("[pdf-loader.loadPdfJs] Loading pdf.js:", { version: PDFJS_VERSION });
    pdfjsModulePromise = (async () => {
      let pdfjs;
      let workerSrc;
      const isNode = typeof process !== "undefined" && Boolean(process.versions?.node);

      if (isNode) {
        const { createRequire } = await import("node:module");
        const { pathToFileURL } = await import("node:url");
        const req = createRequire(import.meta.url);
        const pdfPath = req.resolve("pdfjs-dist/build/pdf.mjs");
        const workerPath = req.resolve("pdfjs-dist/build/pdf.worker.mjs");
        const mod = await import(pathToFileURL(pdfPath).href);
        pdfjs = mod.default ?? mod;
        workerSrc = pathToFileURL(workerPath).href;
      } else {
        const mod = await import(`${PDFJS_BASE}/pdf.min.mjs`);
        pdfjs = mod.default ?? mod;
        workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      }

      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      console.info("[pdf-loader.loadPdfJs] pdf.js ready:", {
        version: PDFJS_VERSION,
        source: isNode ? "node_modules" : "cdn",
      }); // [debug-enrich]
      return pdfjs;
    })();
  }
  return pdfjsModulePromise;
}
