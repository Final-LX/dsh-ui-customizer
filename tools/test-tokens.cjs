// Token 兼容性检查：验证真正进入 overrideTokens 层的 token（KNOWN_TOKENS 白名单）
// 在官方 dsh-web-frontend 的 dist CSS 里都真实存在。
//
// 白名单直接从 lib/client.js 提取（单源维护，避免这里和 client 漂移）。
// 插件自用的 :root CSS 兜底变量（非官方 token）不参与对拍。
//
// 用法：node tools/test-tokens.cjs [--dist <dir>]
//   缺省在 node_modules 里递归找 dsh-web-frontend 的 dist；
//   --dist 指定 dist 目录便于本地对拍。
//   找不到 dsh（未安装）时跳过对拍并以 0 退出，保证 `npm test` 在任意环境可跑；
//   CI 安装了 @deepseek-ai/dsh 后会真正对拍，漂移即非零退出。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "lib", "client.js");

// ---- 从 client.js 提取 KNOWN_TOKENS 数组 ----
function extractKnownTokens() {
  const src = fs.readFileSync(CLIENT, "utf8");
  const start = src.indexOf("var KNOWN_TOKENS = [");
  if (start < 0) throw new Error("client.js 里找不到 KNOWN_TOKENS");
  const open = src.indexOf("[", start);
  const close = src.indexOf("];", open);
  const body = src.slice(open + 1, close);
  const list = [];
  const re = /"(--dsw-[\w-]+)"/g;
  let m;
  while ((m = re.exec(body)) !== null) list.push(m[1]);
  return list;
}
const KNOWN = extractKnownTokens();
if (KNOWN.length === 0) throw new Error("KNOWN_TOKENS 为空");

// ---- 定位 dist CSS（兼容 hoisted 与 pnpm 隔离布局）----
function findCssFiles() {
  const roots = [];
  const distArg = process.argv[2];
  if (distArg && distArg === "--dist") {
    const d = process.argv[3];
    if (d) roots.push(path.resolve(d));
  }
  const nm = path.join(ROOT, "node_modules");
  if (fs.existsSync(path.join(nm, "@deepseek-ai", "dsh-web-frontend", "dist"))) {
    roots.push(path.join(nm, "@deepseek-ai", "dsh-web-frontend", "dist"));
  }
  const pnpmDir = path.join(nm, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const name of fs.readdirSync(pnpmDir)) {
      if (!name.includes("dsh-web-frontend")) continue;
      const p = path.join(pnpmDir, name, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist");
      if (fs.existsSync(p)) roots.push(p);
    }
  }
  const out = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    listCss(r, out, 0);
  }
  return out;
}
function listCss(dir, out, depth) {
  if (depth > 6) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listCss(p, out, depth + 1);
    else if (e.isFile() && p.endsWith(".css")) out.push(p);
  }
}

const cssFiles = findCssFiles();
if (cssFiles.length === 0) {
  console.log(JSON.stringify({
    ok: true,
    skipped: true,
    reason: "未找到 dsh-web-frontend dist CSS（未安装 @deepseek-ai/dsh）；跳过 token 对拍。可 npm install @deepseek-ai/dsh 或加 --dist <dir> 启用。"
  }, null, 2));
  process.exit(0);
}

const corpus = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
const missing = [];
for (const t of KNOWN) {
  if (!corpus.includes(t)) missing.push(t);
}

if (missing.length) {
  console.error("有 " + missing.length + " 个白名单 token 在官方 dist CSS 中缺失（官方可能已改名/删除）：");
  missing.forEach((t) => console.error("  - " + t));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, tokensChecked: KNOWN.length, cssFiles: cssFiles.length }, null, 2));
