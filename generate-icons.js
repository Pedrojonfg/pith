const { createCanvas } = require("canvas");
const fs = require("fs");

const BG = "#111318";
const ACCENT = "#18c4aa";

[192, 512].forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);

  let label = "Pith";
  let fontScale = 0.28;
  ctx.font = `bold ${size * fontScale}px sans-serif`;
  if (ctx.measureText(label).width > size * 0.82) {
    label = "P";
    fontScale = 0.42;
    ctx.font = `bold ${size * fontScale}px sans-serif`;
  }

  ctx.fillStyle = ACCENT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, size / 2, size / 2);
  fs.writeFileSync(`icon-${size}.png`, canvas.toBuffer("image/png"));
});
