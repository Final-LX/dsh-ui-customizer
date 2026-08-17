// 用 Electron 离屏把 raster 图（webp/png/jpg）转成多尺寸 ICO（object-fit: cover 填满方形）。
// 用法：cd desktop && npx electron scripts/render-webp-icon.cjs [图片路径]
const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2] || path.join(__dirname, "..", "assets", "icon-source.webp");
const OUT = path.join(__dirname, "..", "assets", "icon.ico");

app.commandLine.appendSwitch("force-device-scale-factor", "1");

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
  const bytes = fs.readFileSync(SRC);
  const ext = path.extname(SRC).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  // cover：铺满方形，超出部分裁掉
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden"><img src="${dataUrl}" style="width:100vw;height:100vh;object-fit:cover;display:block"></body></html>`;

  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html;base64," + Buffer.from(html, "utf8").toString("base64"));
  await new Promise((r) => setTimeout(r, 600));
  const img = await win.webContents.capturePage();
  const master = nativeImage.createFromBuffer(img.toPNG());

  const sizes = [16, 24, 32, 48, 256];
  const pngs = sizes.map((s) => ({ size: s, buffer: master.resize({ width: s, height: s }).toPNG() }));
  const ico = makeIco(pngs);
  fs.writeFileSync(OUT, ico);
  console.log("wrote", OUT, ico.length, "bytes, sizes", sizes.join("/"));
  win.destroy();
  app.quit();
});
