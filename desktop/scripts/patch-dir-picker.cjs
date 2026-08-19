// patch-dir-picker.cjs — 修复 @deepseek-ai/dsh-host-directory-picker-native 的 worker.cjs
//
// 根因：worker.cjs 的 readUtf16() 用固定/猜测长度调用 koffi.view() 读取 COM 返回的
// PWSTR。koffi.view(address, N) 直接对原生内存做 N 字节视图；若 N 超过 COM 通过
// CoTaskMemAlloc 实际分配的字符串缓冲区，就会越界读取并触发 Node 原生 fatal error
//（日志形如 "FATAL ERROR: Error::New napi_get_last_error_info"），worker 进程崩溃，
// 主进程只能报 "win32 folder dialog worker exited before reporting a result"。
//
// 旧的 VirtualQuery 补丁并不能解决该问题：VirtualQuery 只说明内存页是否 committed，
// 不能保证 koffi.view() 的长度不超过 COM 分配的字符串缓冲区，因此仍会 native crash。
//
// 修复：用 Win32 lstrlenW 先取得 NUL 结尾 UTF-16 字符串的真实长度（码元数），再只读
// 那么长的内存；空指针/空串直接返回 ""，长度封顶到 Windows 单段路径上限 32767，
// 绝不猜测长度。同时保留 resultPath 中 CoTaskMemFree 位于 finally 的写法，防止解码
// 抛错时泄漏 COM 分配的内存。
//
// 用法：作为 npm postinstall 运行；幂等（readUtf16 已使用 lstrlenW 则跳过）。
"use strict";
const fs = require("fs");
const path = require("path");

// 安全实现：lstrlenW 精确取长，绝不对 COM 缓冲区做猜测长度的越界视图。
const READ_UTF16_SAFE = `function readUtf16(koffi, address) {
\tif (!address) return "";
\tconst kernel32 = koffi.load("kernel32.dll");
\tconst lstrlenW = kernel32.func("__stdcall", "lstrlenW", "int32", ["void *"]);
\tconst len = lstrlenW(address);
\tif (!len || len <= 0) return "";
\t// Windows 单段路径上限 32767 个 UTF-16 码元；lstrlenW 返回码元数（不含终止 NUL）。
\tconst capped = Math.min(len, 32767);
\treturn Buffer.from(koffi.view(address, capped * 2)).toString("utf16le", 0, capped * 2);
}`;

// 匹配整个 readUtf16 函数体（原始版与 VirtualQuery 旧补丁版都会命中同一尾部）。
const RE_READ_WHOLE = /function readUtf16\(koffi, address\) \{[\s\S]*?return bytes\.toString\("utf16le", 0, end\);[\s\S]*?\n\}/;

// 匹配未打补丁的 resultPath 中“解码后立刻释放、释放不在 finally”的两行。
const RE_FREE_TARGET = /const path = readUtf16\(koffi, nameOut\[0\]\);[\t ]*\n[\t ]*coTaskMemFree\(nameOut\[0\]\);/;
const FREE_FIXED = `let path;
\ttry {
\t\tpath = readUtf16(koffi, nameOut[0]);
\t} finally {
\t\tcoTaskMemFree(nameOut[0]);
\t}`;

// 已打补丁检测：readUtf16 内是否已经调用 lstrlenW。
const RE_READ_PATCHED = /function readUtf16\(koffi, address\) \{[\s\S]*?lstrlenW/;
// resultPath 是否已把 CoTaskMemFree 放入 finally。
const RE_FREE_PATCHED = /readUtf16\(koffi, nameOut\[0\]\);[\s\S]*?finally[\s\S]*?coTaskMemFree\(nameOut\[0\]\);/;

/**
 * 对 worker.cjs 源码做幂等补丁。
 * @param {string} src worker.cjs 原始文本
 * @returns {{changed:boolean, src:string, log:string[], error?:string}}
 */
function patchWorkerSource(src) {
  const result = { changed: false, src, log: [] };

  if (RE_READ_PATCHED.test(src)) {
    result.log.push("readUtf16 已使用 lstrlenW，跳过");
  } else if (RE_READ_WHOLE.test(src)) {
    src = src.replace(RE_READ_WHOLE, READ_UTF16_SAFE);
    result.changed = true;
    result.log.push("readUtf16 已替换为 lstrlenW 精确读取");
  } else {
    result.error = "未找到 readUtf16 函数体，补丁中止";
    return result;
  }

  if (RE_FREE_PATCHED.test(src)) {
    result.log.push("resultPath 已用 finally 保护，跳过");
  } else if (RE_FREE_TARGET.test(src)) {
    src = src.replace(RE_FREE_TARGET, FREE_FIXED);
    result.changed = true;
    result.log.push("resultPath 已把 CoTaskMemFree 移入 finally");
  }

  result.src = src;
  return result;
}

if (require.main === module) {
  const root = path.join(__dirname, "..");
  const candidates = [
    path.join(root, "node_modules", "@deepseek-ai", "dsh-host-directory-picker-native", "lib", "worker.cjs"),
    path.join(root, "node_modules", "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai", "dsh-host-directory-picker-native", "lib", "worker.cjs"),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) {
    console.log("[patch-dir-picker] worker.cjs 未找到，跳过");
    process.exit(0);
  }

  const src = fs.readFileSync(file, "utf8");
  const r = patchWorkerSource(src);
  if (r.error) {
    console.error("[patch-dir-picker] " + r.error + "：" + file);
    process.exit(1);
  }
  for (const line of r.log) console.log("[patch-dir-picker] " + line);

  if (r.changed) {
    fs.writeFileSync(file, r.src, "utf8");
    const verify = fs.readFileSync(file, "utf8");
    if (!verify.includes("lstrlenW")) {
      console.error("[patch-dir-picker] 写回验证失败：lstrlenW 未出现在补丁结果中 → " + file);
      process.exit(1);
    }
    console.log("[patch-dir-picker] 已打补丁：" + file);
  }
}

module.exports = { patchWorkerSource };
