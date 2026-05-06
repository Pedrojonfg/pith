const { createCanvas } = require("canvas");
const fs = require("fs");

[192, 512].forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0f0f0f";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#7dd3fc";
  ctx.font = `bold ${size * 0.35}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ML", size / 2, size / 2);
  fs.writeFileSync(`icon-${size}.png`, canvas.toBuffer("image/png"));
});
