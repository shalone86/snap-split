// Make the PNG icons (iOS needs a PNG apple-touch-icon; SVG isn't enough) from
// public/icon.svg (rounded) and public/icon-maskable.svg (full square, art inside the middle 80%).
// Needs Playwright with Chromium:  npx -y playwright@1 install chromium  (once), then:
//   node scripts/make-icons.cjs
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "public");
(async () => {
  const b = await chromium.launch();
  const jobs = [["icon.svg", "icons/icon-192.png", 192, true], ["icon.svg", "icons/icon-512.png", 512, true],
    ["icon-maskable.svg", "icons/maskable-192.png", 192], ["icon-maskable.svg", "icons/maskable-512.png", 512],
    ["icon-maskable.svg", "icons/apple-touch-icon.png", 180]];
  fs.mkdirSync(path.join(dir, "icons"), { recursive: true });
  for (const [src, out, size, transparent] of jobs) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    const svg = fs.readFileSync(path.join(dir, src), "utf8").replace("<svg ", `<svg width="${size}" height="${size}" `);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: path.join(dir, out), omitBackground: !!transparent });
    await p.close();
    console.log("wrote", out);
  }
  await b.close();
})();
