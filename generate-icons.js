const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function drawRect(rgba, width, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= width) continue;
      const idx = (yy * width + xx) * 4;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = color[3];
    }
  }
}

function generateIcon(size, outputPath) {
  const bg = [15, 15, 15, 255];
  const fg = [245, 245, 245, 255];
  const rgba = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i += 1) {
    const idx = i * 4;
    rgba[idx] = bg[0];
    rgba[idx + 1] = bg[1];
    rgba[idx + 2] = bg[2];
    rgba[idx + 3] = bg[3];
  }

  const stroke = Math.max(8, Math.round(size * 0.06));
  const margin = Math.max(24, Math.round(size * 0.18));
  const letterH = size - margin * 2;

  // M
  const mX = margin;
  const mW = Math.max(56, Math.round(size * 0.22));
  drawRect(rgba, size, mX, margin, stroke, letterH, fg);
  drawRect(rgba, size, mX + mW - stroke, margin, stroke, letterH, fg);
  drawRect(rgba, size, mX + stroke, margin, mW - stroke * 2, stroke, fg);
  drawRect(rgba, size, mX + Math.round(mW * 0.38), margin + stroke, stroke, Math.round(letterH * 0.55), fg);

  // L
  const lX = mX + mW + Math.max(18, Math.round(size * 0.08));
  const lH = letterH;
  const lW = Math.max(56, Math.round(size * 0.2));
  drawRect(rgba, size, lX, margin, stroke, lH, fg);
  drawRect(rgba, size, lX, margin + lH - stroke, lW, stroke, fg);

  const scanlines = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(outputPath, png);
}

const root = process.cwd();
generateIcon(192, path.join(root, "icon-192.png"));
generateIcon(512, path.join(root, "icon-512.png"));
console.log("Generated icon-192.png and icon-512.png");
