// electron-builder afterPack 钩子：用 rcedit 给打包出的 exe 设置鲸鱼图标。
// 这样即使 signAndEditExecutable: false（跳过 winCodeSign 的 rcedit），也能给 exe 内嵌图标。
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const productFilename = context.packager.appInfo.productFilename; // "DSH"
  const exe = path.join(context.appOutDir, productFilename + ".exe");
  const icon = path.join(__dirname, "..", "assets", "icon.ico");
  if (!fs.existsSync(exe) || !fs.existsSync(icon)) {
    console.log("after-pack: 跳过（缺 exe 或 icon）", exe, icon);
    return;
  }
  const { rcedit } = await import("rcedit"); // rcedit@5 是 ESM，用动态 import
  try {
    await rcedit(exe, { icon });
    console.log("after-pack: 已设置 exe 图标 ->", exe);
  } catch (e) {
    console.error("after-pack: 设置图标失败：", e && e.message ? e.message : e);
  }
};
