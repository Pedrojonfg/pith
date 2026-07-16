/** Map view for vault concepts with resolved geoLocation (Leaflet CDN). */

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletLoading = null;

/**
 * @param {object[]} entries
 * @returns {Array<{id:string,label:string,lat:number,lng:number,definition?:string}>}
 */
export function buildMapMarkers(entries) {
  const out = [];
  for (const e of entries || []) {
    const g = e?.geoLocation;
    if (!g || g.geocodeStatus !== "resolved") continue;
    const lat = Number(g.lat);
    const lng = Number(g.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      id: String(e.id),
      label: String(e.canonicalTitle || e.id),
      lat,
      lng,
      definition: Array.isArray(e.definitions) ? String(e.definitions[0]?.text || "") : "",
    });
  }
  return out;
}

function ensureLeaflet() {
  if (typeof window !== "undefined" && window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletLoading;
}

/**
 * @param {HTMLElement} containerEl
 * @param {object[]} entries
 * @param {{ onSelect?: (id: string) => void }} [options]
 */
export async function renderVaultMap(containerEl, entries, options = {}) {
  if (!containerEl) return null;
  const markers = buildMapMarkers(entries);
  if (!markers.length) {
    containerEl.innerHTML = `<p class="hint">No geocoded places in the current filter.</p>`;
    return { markers };
  }

  containerEl.innerHTML = `<div class="vault-map-host" style="height:min(60vh,420px);width:100%;border-radius:8px;overflow:hidden"></div>`;
  const mapEl = containerEl.querySelector(".vault-map-host");
  let L;
  try {
    L = await ensureLeaflet();
  } catch {
    containerEl.innerHTML = `<p class="hint">Map library could not be loaded.</p>`;
    return { markers };
  }

  const map = L.map(mapEl).setView([markers[0].lat, markers[0].lng], 3);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 18,
  }).addTo(map);

  const latLngs = [];
  for (const m of markers) {
    latLngs.push([m.lat, m.lng]);
    const marker = L.marker([m.lat, m.lng]).addTo(map);
    marker.bindPopup(`<strong>${escapeHtml(m.label)}</strong>`);
    marker.on("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(m.id);
    });
  }
  if (latLngs.length > 1) map.fitBounds(latLngs, { padding: [24, 24] });
  setTimeout(() => map.invalidateSize(), 50);
  return { markers, map };
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
