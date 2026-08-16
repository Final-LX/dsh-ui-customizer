// 生成桌面托盘占位图标：32x32 圆角方块，品牌蓝 #4f6ef7。
// 用法：node desktop/scripts/gen-icon.cjs   →  输出 desktop/assets/icon.png
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const W = 32, H = 32, RADIUS = 8;
const R = 0x4f, G = 0x6e, B = 0xf7;

function inRoundedRect(x, y) {
  const dx = Math.max(RADIUS - x, x - (W - 1 - RADIUS), 0);
  const dy = Math.max(RADIUS - y, y - (H - 1 - RADIUS), 0);
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

const rows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 4);
  row[0] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const o = 1 + x * 4;
    if (inRoundedRect(x, y)) { row[o] = R; row[o + 1] = G; row[o + 2] = B; row[o + 3] = 0xff; }
    else { row[o] = 0; row[o + 1] = 0; row[o + 2] = 0; row[o + 3] = 0; }
  }
  rows.push(row);
}
const raw = Buffer.concat(rows);

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

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // color type RGBA
// compression/filter/interlace = 0
const idat = zlib.deflateSync(raw);
const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);

const outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "icon.png");
fs.writeFileSync(outFile, png);
console.log("wrote", outFile, png.length, "bytes");
