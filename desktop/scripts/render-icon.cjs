// 用 Electron 离屏渲染 DeepSeek 鲸鱼 SVG → 多尺寸 ICO。
// 用法：cd desktop && npx electron scripts/render-icon.cjs
const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SVG_PATH = path.join(__dirname, "..", "assets", "icon.svg");
const OUT = path.join(__dirname, "..", "assets", "icon.ico");
const FILL = "#4D6BFE"; // DeepSeek 品牌蓝

let svg = fs.readFileSync(SVG_PATH, "utf8");
svg = svg
  .replace(/<style>[\s\S]*?<\/style>\s*/, "")
  .replace('width="50.000000" height="50.000000"', 'width="100%" height="100%"')
  .replace("<path", `<path fill="${FILL}"`);

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(p.size === 256 ? 0 : p.size, 0);
    e.writeUInt8(p.size === 256 ? 0 : p.size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += p.buffer.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buffer)]);
}

app.whenReady().then(async () => {
  const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
  const win = new BrowserWindow({
    width: 256, height: 256, show: false, frame: false,
    transparent: true, backgroundColor: "#00000000",
    webPreferences: { offscreen: true }
  });
  await win.loadURL(dataUrl);
  await new Promise((r) => setTimeout(r, 500));
  const img = await win.webContents.capturePage();
  const master = nativeImage.createFromBuffer(img.toPNG());

  const sizes = [16, 24, 32, 48, 256];
  const pngs = sizes.map((s) => ({
    size: s,
    buffer: s === 256 ? master.toPNG() : master.resize({ width: s, height: s }).toPNG()
  }));
  const ico = makeIco(pngs);
  fs.writeFileSync(OUT, ico);
  console.log("wrote", OUT, ico.length, "bytes, sizes", sizes.join("/"));
  win.destroy();
  app.quit();
});
