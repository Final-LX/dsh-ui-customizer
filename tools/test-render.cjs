// 真实 React 渲染测试：用 dsh 自带的 react + react-dom/server 渲染分区与设置行组件，
// 确认组件在真实 React 环境下能正常执行（非 mock）。node tools/test-render.cjs
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { createRequire } = require("node:module");

// 动态解析 @deepseek-ai/dsh 的位置：CI 上 `pnpm add -D @deepseek-ai/dsh` 会装进 node_modules；
// 本地开发则回退到 npx 缓存路径。
let dshPkgJson;
try {
  dshPkgJson = require.resolve("@deepseek-ai/dsh/package.json");
} catch (e) {
  dshPkgJson = "C:/Users/Administrator/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh/package.json";
}
const req = createRequire(dshPkgJson);
const React = req("react");
const ReactDOMServer = req("react-dom/server");

const CLIENT = process.argv[2] || path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(CLIENT, "utf8");

let handoff = null;
const registrations = [];
const sandbox = {
  window: { __ModuleLoader__: { load: (h) => (handoff = h) } },
  document: {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: "", style: {}, className: "", parentNode: null }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const bundleExports = handoff.factory((spec) => {
  if (spec === "react") return React;
  throw new Error("unexpected require: " + spec);
});

const mockCtx = {
  theme: { overrideTokens: () => () => {} },
  slots: {
    inject: (_n, cb) => { cb(); return () => {}; },
    register: (options, component) => { registrations.push({ options, component }); return () => {}; },
  },
  effect: () => () => {},
};
bundleExports.apply(mockCtx);

const sectionReg = registrations.find((r) => r.options.name === "settings.section");
const itemReg = registrations.find((r) => r.options.name === "settings.diy.item");
if (!sectionReg || !itemReg) throw new Error("未找到分区或条目注册");

// 分区渲染：验证 renderSlot 子槽接线
const sectionHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(sectionReg.component, { renderSlot: (name) => "[" + name + "]" })
);
if (!sectionHtml.includes("[settings.diy.item]")) throw new Error("分区未渲染子槽 settings.diy.item");

// 设置行渲染：验证控件齐全
const html = ReactDOMServer.renderToStaticMarkup(React.createElement(itemReg.component, {}));
["DIY 主题", "皮肤中心", "配色", "字体", "背景", "组件", "应用", "还原", "重置为默认", 'type="text"', 'type="color"', 'type="range"', 'type="file"'].forEach((needle) => {
  if (!html.includes(needle)) throw new Error("render 输出缺少: " + needle);
});

console.log(JSON.stringify({
  ok: true,
  sectionOk: sectionHtml.includes("[settings.diy.item]"),
  htmlLength: html.length,
  hasPanel: html.includes("DIY 主题"),
}, null, 2));
