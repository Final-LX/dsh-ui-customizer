# install.ps1 — 一键安装 dsh-ui-customizer 到 web profile（只用插件的网页用户）
#
# 这是给「只用插件、不用桌面端」的网页用户用的。桌面端（desktop/）自带插件，
# 不需要跑这个脚本。
#
# 用法：在插件目录里运行  .\install.ps1
# 前置：机器上要有 dsh 或 npx（Node）
$ErrorActionPreference = "Stop"

$pluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1) 把插件装进 web profile（pnpm 装到 profile 的 node_modules）
Write-Host "==> 安装插件到 web profile ..."
if (Get-Command dsh -ErrorAction SilentlyContinue) {
    dsh plugin --profile web add "file:$pluginDir"
} else {
    npx @deepseek-ai/dsh plugin --profile web add "file:$pluginDir"
}

# 2) 在 cordis.patch.yml 登记 loader 行（幂等）
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE ".dsh" }
$patchFile = Join-Path $dshHome "profiles\web\cordis.patch.yml"
if (-not (Test-Path $patchFile)) {
    Write-Warning "未找到 $patchFile，请先运行一次 dsh web 初始化 profile，再重新执行本脚本。"
} elseif ((Get-Content $patchFile -Raw) -match "dsh-ui-customizer") {
    Write-Host "==> cordis.patch.yml 已登记，跳过。"
} else {
    $row = "- insert:`n    - id: ui-customizer`n      name: dsh-ui-customizer"
    $content = Get-Content $patchFile -Raw
    $content = $content -replace "(?m)^\[\]\s*$", $row
    Set-Content -Path $patchFile -Value $content -Encoding UTF8
    Write-Host "==> 已登记 loader 行。"
}

Write-Host ""
Write-Host "安装完成。请重启服务并刷新页面："
Write-Host "  npx @deepseek-ai/dsh web"
Write-Host "然后打开 设置 -> DIY 主题。"
