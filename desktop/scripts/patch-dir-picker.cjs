// patch-dir-picker.cjs — 给 @deepseek-ai/dsh-host-directory-picker-native 打补丁
//
// 背景：worker.cjs 的 readUtf16() 用固定 32768 字节视图读取 COM 返回的 PWSTR，
// 当实际缓冲（如短路径）小于该长度时，koffi.view() 越界触发原生 fatal error，
// 整个 worker 崩溃，主进程只能报 "win32 folder dialog worker exited before
// reporting a result"。
//
// 补丁内容：
//   1) readUtf16 改用 VirtualQuery 探测已提交内存区域，只读安全长度（不越界）
//   2) CoTaskMemFree 移入 finally，解码抛错也不泄漏
//
// 用法：作为 npm postinstall 运行（幂等，已打补丁则跳过）
"use strict";
const fs = require("fs");
const path = require("path");

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

let src = fs.readFileSync(file, "utf8");

if (src.includes("VirtualQuery")) {
  console.log("[patch-dir-picker] 已打过补丁，跳过");
  process.exit(0);
}

const readUtf16Safe = `const bytes = (() => {
					try {
						const __kernel32 = koffi.load("kernel32.dll");
						const __vq = __kernel32.func("__stdcall", "VirtualQuery", "intptr", ["void *", "void *", "uintptr"]);
						const __mbi = Buffer.alloc(48);
						if (__vq(address, __mbi, 48)) {
							const __base = __mbi.readBigUInt64LE(0);
							const __region = __mbi.readBigUInt64LE(24);
							const __state = __mbi.readUInt32LE(32);
							const __remaining = __region - (BigInt(address) - __base);
							if (__state === 4096 && __remaining > 0n) {
								return Buffer.from(koffi.view(address, __remaining < 32768n ? Number(__remaining) : 32768));
							}
						}
						return Buffer.from(koffi.view(address, 4096));
					} catch (e) {
						return Buffer.from(koffi.view(address, 1024));
					}
				})();`;

const reRead = /const bytes = Buffer\.from\(koffi\.view\(address, 32768\)\);/;
if (!reRead.test(src)) {
  console.error("[patch-dir-picker] 未找到 readUtf16 目标行，补丁中止：" + file);
  process.exit(1);
}
src = src.replace(reRead, readUtf16Safe);

const reFree = /const path = readUtf16\(koffi, nameOut\[0\]\);[\s\S]*?coTaskMemFree\(nameOut\[0\]\);[\s\S]*?return \{[\s\S]*?hr: gotName,[\s\S]*?path[\s\S]*?\};/;
const freeFixed = `let path;
					try {
						path = readUtf16(koffi, nameOut[0]);
					} finally {
						coTaskMemFree(nameOut[0]);
					}
					return {
						hr: gotName,
						path
					};`;
if (!reFree.test(src)) {
  console.error("[patch-dir-picker] 未找到 resultPath 目标块，补丁中止：" + file);
  process.exit(1);
}
src = src.replace(reFree, freeFixed);

fs.writeFileSync(file, src, "utf8");
console.log("[patch-dir-picker] 已打补丁：" + file);
