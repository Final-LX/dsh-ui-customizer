// 用法: node tools/set-wallpaper.cjs <图片路径>
// 把本地壁纸转成 web 尺寸(1920px) JPEG data URI，保存到 assets/wallpaper.txt，
// 并内嵌进 lib/client.js 的 `var WALLPAPER_DATA_URI = "";` 行。
const path = require("node:path");
const fs = require("node:fs");

const SHARP = "C:/Users/Administrator/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/sharp";
const sharp = require(SHARP);

const IMG = process.argv[2];
const CLIENT = path.join(__dirname, "..", "lib", "client.js");
const ASSET = path.join(__dirname, "..", "assets", "wallpaper.txt");

(async () => {
  if (!IMG) {
    console.error("usage: node tools/set-wallpaper.cjs <image-path>");
    process.exit(1);
  }
  const jpeg = await sharp(IMG)
    .resize({ width: 1920, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const dataUri = "data:image/jpeg;base64," + jpeg.toString("base64");

  fs.mkdirSync(path.dirname(ASSET), { recursive: true });
  fs.writeFileSync(ASSET, dataUri, "utf8");

  let src = fs.readFileSync(CLIENT, "utf8");
  const marker = 'var WALLPAPER_DATA_URI = "";';
  if (!src.includes(marker)) {
    console.error("marker not found in " + CLIENT);
    process.exit(1);
  }
  src = src.replace(marker, "var WALLPAPER_DATA_URI = " + JSON.stringify(dataUri) + ";");
  fs.writeFileSync(CLIENT, src, "utf8");

  console.log(JSON.stringify({
    jpegKB: Math.round(jpeg.length / 1024),
    dataUriChars: dataUri.length,
    clientBytes: Buffer.byteLength(src)
  }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
