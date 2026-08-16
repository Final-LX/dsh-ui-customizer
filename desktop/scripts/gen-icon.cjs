// 生成桌面图标：多尺寸 ICO（16/24/32/48/256），品牌蓝→强调紫对角渐变的圆角方块。
// 用法：node desktop/scripts/gen-icon.cjs   →  输出 desktop/assets/icon.ico
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const C1 = [0x4f, 0x6e, 0xf7]; // 品牌蓝
const C2 = [0x8b, 0x5c, 0xf6]; // 强调紫
const RADIUS_RATIO = 0.22;      // 圆角占边长的比例

function inRoundedRect(x, y, W, H, R) {
  const dx = Math.max(R - x, x - (W - 1 - R), 0);
  const dy = Math.max(R - y, y - (H - 1 - R), 0);
  return dx * dx + dy * dy <= R * R;
}

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

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function renderPng(size) {
  const W = size, H = size, R = Math.round(size * RADIUS_RATIO);
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(1 + W * 4);
    row[0] = 0; // filter none
    for (let x = 0; x < W; x++) {
      const o = 1 + x * 4;
      if (inRoundedRect(x, y, W, H, R)) {
        const t = (x + y) / (W + H);
        row[o] = Math.round(C1[0] + (C2[0] - C1[0]) * t);
        row[o + 1] = Math.round(C1[1] + (C2[1] - C1[1]) * t);
        row[o + 2] = Math.round(C1[2] + (C2[2] - C1[2]) * t);
        row[o + 3] = 0xff;
      }
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

function makeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type = icon
  header.writeUInt16LE(pngs.length, 4);    // count
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(p.size === 256 ? 0 : p.size, 0);  // width（0 表示 256）
    e.writeUInt8(p.size === 256 ? 0 : p.size, 1);  // height
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);        // palette / reserved
    e.writeUInt16LE(1, 4);                         // planes
    e.writeUInt16LE(32, 6);                        // bit count
    e.writeUInt32LE(p.buffer.length, 8);           // bytes in res
    e.writeUInt32LE(offset, 12);                   // image offset
    entries.push(e);
    offset += p.buffer.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buffer)]);
}

const sizes = [16, 24, 32, 48, 256];
const ico = makeIco(sizes.map((s) => ({ size: s, buffer: renderPng(s) })));

const outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "icon.ico");
fs.writeFileSync(outFile, ico);
console.log("wrote", outFile, ico.length, "bytes, sizes", sizes.join("/"));
