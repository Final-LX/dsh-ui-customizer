// Token 兼容性检查：从 lib/client.js 提取所有覆盖/引用的 --dsw-* / --ds-* token，
// 再与官方 dsh-web-frontend 的 dist CSS 比对，缺了任何一个就非零退出。
// 用法：node tools/test-tokens.cjs [--dist <dir>]
//   缺省在 node_modules 里递归找 dsh-web-frontend 的 dist；
//   --dist 指定 dist 目录便于本地对拍。
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const CLIENT = path.join(ROOT, "lib", "client.js");

function assert(cond, msg) { if (!cond) throw new Error("ASSERT FAILED: " + msg); }

// 解析 --dist
let distArg = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) if (argv[i] === "--dist") distArg = argv[i + 1];

const src = fs.readFileSync(CLIENT, "utf8");

// 提取 token 名
const tokens = new Set();
const re = /--ds[w]?-[\w-]+/g;
let m;
while ((m = re.exec(src)) !== null) tokens.add(m[0]);

// 字体字号 token 在运行时还会追加 "-font-size" 后缀
function variants(t) {
  if (/^--dsw-font-/.test(t) && !/-font-size$/.test(t)) return [t, t + "-font-size"];
  return [t];
}

// 定位 dist CSS（兼容 hoisted 与 pnpm 隔离布局）
function findCssFiles() {
  const roots = [];
  if (distArg) {
    const abs = path.resolve(distArg);
    if (!fs.existsSync(abs)) throw new Error("dist 目录不存在: " + abs);
    roots.push(abs);
  } else {
    const nm = path.join(ROOT, "node_modules");
    if (!fs.existsSync(nm)) throw new Error("node_modules 不存在，先安装 @deepseek-ai/dsh");
    const hoisted = path.join(nm, "@deepseek-ai", "dsh-web-frontend", "dist");
    if (fs.existsSync(hoisted)) roots.push(hoisted);
    const pnpmDir = path.join(nm, ".pnpm");
    if (fs.existsSync(pnpmDir)) {
      for (const name of fs.readdirSync(pnpmDir)) {
        if (!name.includes("dsh-web-frontend")) continue;
        const p = path.join(pnpmDir, name, "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist");
        if (fs.existsSync(p)) roots.push(p);
      }
    }
  }
  const out = [];
  for (const r of roots) listCss(r, out, 0);
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
assert(cssFiles.length > 0, "未找到 dsh-web-frontend 的 dist CSS（用 --dist <dir> 指定）");
const corpus = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

const missing = [];
for (const t of [...tokens].sort()) {
  const ok = variants(t).some((v) => corpus.includes(v));
  if (!ok) missing.push(t);
}

if (missing.length) {
  console.error("缺少 " + missing.length + " 个 token（官方可能已改名/删除）：");
  missing.forEach((t) => console.error("  - " + t));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, tokensChecked: tokens.size, cssFiles: cssFiles.length }, null, 2));
