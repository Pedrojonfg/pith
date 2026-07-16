/** Timeline SVG for vault concepts with temporalRange. */

/**
 * @param {object[]} entries — vault entries (pre-filtered)
 * @returns {{ minYear: number, maxYear: number, items: Array<{id:string,label:string,startYear:number,endYear:number,isPoint:boolean}> }}
 */
export function buildTimelineModel(entries) {
  const items = [];
  for (const e of entries || []) {
    const tr = e?.temporalRange;
    if (!tr) continue;
    const startYear = Number(tr.startYear);
    const endYear = Number(tr.endYear);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) continue;
    const span = endYear - startYear;
    items.push({
      id: String(e.id),
      label: String(e.canonicalTitle || e.id),
      startYear,
      endYear,
      isPoint: span <= 1,
    });
  }
  if (!items.length) {
    return { minYear: 0, maxYear: 0, items: [] };
  }
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const it of items) {
    minYear = Math.min(minYear, it.startYear);
    maxYear = Math.max(maxYear, it.endYear);
  }
  if (minYear === maxYear) {
    minYear -= 1;
    maxYear += 1;
  }
  return { minYear, maxYear, items };
}

/**
 * @param {HTMLElement} containerEl
 * @param {object[]} entries
 * @param {{ onSelect?: (id: string) => void }} [options]
 */
export function renderVaultTimeline(containerEl, entries, options = {}) {
  if (!containerEl) return null;
  const model = buildTimelineModel(entries);
  if (!model.items.length) {
    containerEl.innerHTML = `<p class="hint">No dated concepts in the current filter.</p>`;
    return model;
  }

  const width = 900;
  const rowH = 28;
  const padL = 120;
  const padR = 24;
  const padT = 28;
  const height = padT + model.items.length * rowH + 24;
  const span = model.maxYear - model.minYear || 1;
  const innerW = width - padL - padR;

  const xFor = (year) => padL + ((year - model.minYear) / span) * innerW;

  const bars = model.items
    .map((it, i) => {
      const y = padT + i * rowH;
      const x1 = xFor(it.startYear);
      const x2 = xFor(it.endYear);
      const label = escapeXml(it.label.slice(0, 18));
      if (it.isPoint) {
        return `<g class="vault-timeline-item" data-id="${escapeXml(it.id)}" style="cursor:pointer">
          <text x="4" y="${y + 14}" class="vault-timeline-label">${label}</text>
          <circle cx="${x1}" cy="${y + 10}" r="5" fill="#f97316"/>
        </g>`;
      }
      const w = Math.max(4, x2 - x1);
      return `<g class="vault-timeline-item" data-id="${escapeXml(it.id)}" style="cursor:pointer">
        <text x="4" y="${y + 14}" class="vault-timeline-label">${label}</text>
        <rect x="${x1}" y="${y + 4}" width="${w}" height="12" rx="3" fill="#38bdf8" opacity="0.85"/>
      </g>`;
    })
    .join("");

  const axisY = padT - 10;
  containerEl.innerHTML = `
    <div class="vault-timeline-host" tabindex="0">
      <svg class="vault-timeline-svg" viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg">
        <line x1="${padL}" y1="${axisY}" x2="${width - padR}" y2="${axisY}" stroke="#94a3b8" stroke-width="1"/>
        <text x="${padL}" y="${axisY - 6}" fill="#94a3b8" font-size="11">${model.minYear}</text>
        <text x="${width - padR}" y="${axisY - 6}" fill="#94a3b8" font-size="11" text-anchor="end">${model.maxYear}</text>
        ${bars}
      </svg>
      <p class="hint">Scroll / pinch the SVG to zoom (browser zoom on the graphic). Drag not required for v1.</p>
    </div>`;

  containerEl.querySelectorAll(".vault-timeline-item").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-id");
      if (id && typeof options.onSelect === "function") options.onSelect(id);
    });
  });
  return model;
}

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
