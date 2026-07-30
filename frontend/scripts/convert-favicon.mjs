import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const publicDir = path.resolve("public");
const sourceAi = path.join(publicDir, "OET HQ Fevicon.ai");
const appIcon = path.resolve("src/app/icon.png");
const publicFavicon = path.join(publicDir, "favicon.png");
const appleTouch = path.join(publicDir, "apple-touch-icon.png");

const data = new Uint8Array(fs.readFileSync(sourceAi));
const pdf = await getDocument({ data, disableWorker: true }).promise;
const page = await pdf.getPage(1);
const base = page.getViewport({ scale: 1 });
// Render large enough to crop cleanly.
const scale = 2;
const viewport = page.getViewport({ scale });
const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, canvas.width, canvas.height);
await page.render({ canvasContext: ctx, viewport }).promise;

const { width, height } = canvas;
const imageData = ctx.getImageData(0, 0, width, height);
const px = imageData.data;

function isBlue(i) {
  const r = px[i];
  const g = px[i + 1];
  const b = px[i + 2];
  const a = px[i + 3];
  return a > 200 && b > 120 && b > r + 30 && b > g + 20;
}

// Find connected blue components and keep the largest circular-ish blob (the 64px preview).
const visited = new Uint8Array(width * height);
const components = [];

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = y * width + x;
    if (visited[idx] || !isBlue(idx * 4)) continue;
    let minX = x;
    let maxX = x;
    let minY = y;
    let maxY = y;
    let count = 0;
    const stack = [[x, y]];
    visited[idx] = 1;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      count += 1;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (visited[nIdx] || !isBlue(nIdx * 4)) continue;
          visited[nIdx] = 1;
          stack.push([nx, ny]);
        }
      }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const ratio = bw / bh;
    components.push({ minX, maxX, minY, maxY, count, bw, bh, ratio });
  }
}

components.sort((a, b) => b.count - a.count);
const candidates = components.filter((c) => c.ratio > 0.85 && c.ratio < 1.15 && c.bw > 40);
const best = candidates[0] || components[0];
if (!best) {
  throw new Error("Could not locate favicon circle in artwork");
}

const pad = Math.round(Math.max(best.bw, best.bh) * 0.08);
const sx = Math.max(0, best.minX - pad);
const sy = Math.max(0, best.minY - pad);
const sw = Math.min(width - sx, best.bw + pad * 2);
const sh = Math.min(height - sy, best.bh + pad * 2);

const cropped = createCanvas(sw, sh);
const cctx = cropped.getContext("2d");
cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

function writeSquare(size, filePath) {
  const out = createCanvas(size, size);
  const octx = out.getContext("2d");
  // Transparent background for crisp tab icons.
  octx.clearRect(0, 0, size, size);
  octx.drawImage(cropped, 0, 0, size, size);
  fs.writeFileSync(filePath, out.toBuffer("image/png"));
}

writeSquare(512, publicFavicon);
writeSquare(512, appIcon);
writeSquare(180, appleTouch);
writeSquare(32, path.join(publicDir, "favicon-32x32.png"));
writeSquare(16, path.join(publicDir, "favicon-16x16.png"));

console.log("Cropped favicon from component", {
  page: `${base.width}x${base.height}`,
  box: best,
  candidates: candidates.length
});
console.log("Wrote", publicFavicon, appIcon, appleTouch);
