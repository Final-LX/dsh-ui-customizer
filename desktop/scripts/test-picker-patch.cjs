// test-picker-patch.cjs — 对 patch-dir-picker.cjs 的 patchWorkerSource 做无副作用单测
//
// 不修改 node_modules / dist，只用内嵌 fixture 验证补丁函数的行为。
"use strict";
const assert = require("node:assert");
const { patchWorkerSource } = require("./patch-dir-picker.cjs");

// 原始版 readUtf16：固定 32768 字节猜测长度（越界 native crash 根因）
const RAW_READ = `function readUtf16(koffi, address) {
\tconst bytes = Buffer.from(koffi.view(address, 32768));
\tlet end = 0;
\twhile (end + 1 < bytes.length && bytes[end] !== 0) end += 2;
\treturn bytes.toString("utf16le", 0, end);
}`;

// 旧 VirtualQuery 版 readUtf16：仍是猜测长度 32768/4096/1024
const VQ_READ = `function readUtf16(koffi, address) {
\tconst bytes = (() => {
\t\ttry {
\t\t\tconst __vq = koffi.load("kernel32.dll").func("__stdcall", "VirtualQuery", "intptr", ["void *", "void *", "uintptr"]);
\t\t\treturn Buffer.from(koffi.view(address, 32768));
\t\t} catch (e) {
\t\t\treturn Buffer.from(koffi.view(address, 1024));
\t\t}
\t})();
\tlet end = 0;
\twhile (end + 1 < bytes.length && bytes[end] !== 0) end += 2;
\treturn bytes.toString("utf16le", 0, end);
}`;

// resultPath 未打补丁片段（CoTaskMemFree 不在 finally）
const RAW_FREE = `const path = readUtf16(koffi, nameOut[0]);
coTaskMemFree(nameOut[0]);
return {
\thr: gotName,
\tpath
};`;

function wrap(src, free) {
  return `${src}\n\nfunction resultPath(koffi, nameOut) {\n\t${free}\n}\n`;
}

function assertPatched(fixture, label) {
  const r = patchWorkerSource(fixture);
  assert.ok(!r.error, `${label}: 不应报错，实际 ${r.error}`);
  assert.ok(r.changed, `${label}: 应标记 changed`);
  assert.ok(r.src.includes("lstrlenW"), `${label}: 结果应包含 lstrlenW`);
  assert.ok(!/koffi\.view\(address,\s*32768\)/.test(r.src), `${label}: 结果不应保留 32768 猜测长度`);
  assert.ok(!/koffi\.view\(address,\s*4096\)/.test(r.src), `${label}: 结果不应保留 4096 猜测长度`);
  assert.ok(!/koffi\.view\(address,\s*1024\)/.test(r.src), `${label}: 结果不应保留 1024 猜测长度`);
  assert.ok(!/VirtualQuery/.test(r.src), `${label}: 结果不应保留旧 VirtualQuery 补丁`);
  return r;
}

// 1) 原始版 readUtf16 + 原始 resultPath
assertPatched(wrap(RAW_READ, RAW_FREE), "原始版");

// 2) 旧 VirtualQuery 版 readUtf16 + 原始 resultPath
assertPatched(wrap(VQ_READ, RAW_FREE), "VirtualQuery 旧版");

// 3) 幂等：已打补丁（lstrlenW + finally）应跳过且不报错
const SAFE = patchWorkerSource(wrap(
  `function readUtf16(koffi, address) {
\tconst lstrlenW = koffi.load("kernel32.dll").func("__stdcall", "lstrlenW", "int32", ["void *"]);
\tconst len = lstrlenW(address);
\treturn Buffer.from(koffi.view(address, Math.min(len, 32767) * 2)).toString("utf16le", 0, Math.min(len, 32767) * 2);
}`,
  `let path;
\ttry {
\t\tpath = readUtf16(koffi, nameOut[0]);
\t} finally {
\t\tcoTaskMemFree(nameOut[0]);
\t}
\treturn { hr: gotName, path };`
));
assert.ok(!SAFE.error, "幂等版: 不应报错");
assert.ok(!SAFE.changed, "幂等版: 已安全时不应再次修改");

// 4) 语法自检：补丁结果中的函数体应是合法 JS（粗粒度：用 Function 构造验证 readUtf16 片段）
//    readUtf16 依赖 koffi，无法直接执行，这里只验证“替换后的函数声明可被解析”。
for (const [fixture, label] of [[wrap(RAW_READ, RAW_FREE), "原始"], [wrap(VQ_READ, RAW_FREE), "VQ"]]) {
  const r = patchWorkerSource(fixture);
  const m = /function readUtf16\(koffi, address\) \{[\s\S]*?\n\}/.exec(r.src);
  assert.ok(m, `${label}: 应能提取 readUtf16 函数`);
  // 用 Function 构造仅做语法检查；调用会因缺 koffi 抛错，故不调用。
  assert.doesNotThrow(() => new Function("koffi", `${m[0]}; return readUtf16;`), `${label}: readUtf16 语法应合法`);
}

console.log("picker patch tests passed");
