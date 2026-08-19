# install-web.ps1 — 网页端一键安装 dsh-ui-customizer（只需 Node.js，无需 git / pnpm）
#
# 把插件手动复制进 web profile，再登记 loader，全程不依赖 git 和 pnpm。
#
# 用法：在本仓库目录里运行  .\install-web.ps1
# 前置：只需 Node.js（含 npx）。装完后运行  npx @deepseek-ai/dsh web
#
# 若提示“无法加载……未进行数字签名 / 无法执行脚本”，是 PowerShell 执行策略拦截，
# 只需先放宽当前窗口的策略再跑（只影响当前窗口，关掉即恢复，安全）：
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# 或一行直接跑：
#   powershell -ExecutionPolicy Bypass -File .\install-web.ps1
$ErrorActionPreference = "Stop"

$pluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 校验插件文件齐全
if (-not (Test-Path (Join-Path $pluginDir "package.json")) -or -not (Test-Path (Join-Path $pluginDir "lib\client.js"))) {
    Write-Error "找不到插件文件（package.json 或 lib\client.js）。请在本仓库根目录运行本脚本。"
    exit 1
}

# DSH 数据目录（与 DSH_HOME 环境变量一致，缺省 ~/.dsh）
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$profileDir = Join-Path $dshHome "profiles\web"
$destDir = Join-Path $profileDir "node_modules\dsh-ui-customizer"

# 1) 手动复制插件（package.json + lib）
Write-Host "==> 复制插件到 $destDir ..."
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
Copy-Item (Join-Path $pluginDir "package.json") $destDir -Force
Copy-Item (Join-Path $pluginDir "lib") $destDir -Recurse -Force
Write-Host "    已复制。"

# 2) 在 cordis.patch.yml 登记 loader 行（幂等）
$patchFile = Join-Path $profileDir "cordis.patch.yml"
if (-not (Test-Path $patchFile)) {
    Write-Warning "未找到 $patchFile，请先运行一次  npx @deepseek-ai/dsh web  初始化 profile，再重新执行本脚本。"
} elseif ((Get-Content $patchFile -Raw) -match "dsh-ui-customizer") {
    Write-Host "==> cordis.patch.yml 已登记，跳过。"
} else {
    $row = "- insert:`n    - id: ui-customizer`n      name: dsh-ui-customizer"
    $content = Get-Content $patchFile -Raw
    if ($content -match '(?m)\[\]\s*$') {
        # 空列表：直接替换成 loader 行
        $content = $content -replace '(?m)\[\]\s*$', $row
    } else {
        # 已有其它条目：末尾追加
        $content = $content.TrimEnd() + "`n" + $row + "`n"
    }
    [System.IO.File]::WriteAllText($patchFile, $content, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "==> 已登记 loader 行。"
}

Write-Host ""
Write-Host "安装完成。启动网页版："
Write-Host "  npx @deepseek-ai/dsh web"
Write-Host "然后打开 设置 -> DIY 主题。"
