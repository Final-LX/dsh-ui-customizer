// 从 assets/wallpaper.txt 读取 data URI，内嵌进 lib/client.js 的
// `var WALLPAPER_DATA_URI = "";` 行。node tools/inject-wallpaper.cjs
const fs = require("node:fs");
const path = require("node:path");

const CLIENT = path.join(__dirname, "..", "lib", "client.js");
const ASSET = path.join(__dirname, "..", "assets", "wallpaper.txt");

const uri = fs.readFileSync(ASSET, "utf8").trim();
if (!uri.startsWith("data:image/")) {
  console.error("assets/wallpaper.txt 内容不是 data URI");
  process.exit(1);
}
let src = fs.readFileSync(CLIENT, "utf8");
const marker = 'var WALLPAPER_DATA_URI = "";';
if (!src.includes(marker)) {
  console.error("marker not found in " + CLIENT);
  process.exit(1);
}
src = src.replace(marker, "var WALLPAPER_DATA_URI = " + JSON.stringify(uri) + ";");
fs.writeFileSync(CLIENT, src, "utf8");
console.log(JSON.stringify({ injected: true, clientBytes: Buffer.byteLength(src) }));
