# Этап 0.1: Инвентаризация кодовой базы
# Запуск: из корня проекта: .\scripts\audit-stage-0.1.ps1
# Требуется: npm install выполнен заранее

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
if (-not (Test-Path "docs")) { New-Item -ItemType Directory -Path "docs" | Out-Null }

Write-Host "=== 0.1.1 Карта зависимостей ===" -ForegroundColor Cyan
npm list --depth=0 2>&1 | Tee-Object -FilePath "docs\npm-list.txt"

Write-Host "`n=== 0.1.2 ESLint отчёт ===" -ForegroundColor Cyan
npm run lint:report 2>&1
if (Test-Path "eslint-report.txt") { Move-Item -Force "eslint-report.txt" "docs\eslint-report.txt" }

Write-Host "`n=== 0.1.3 TypeScript (если есть tsconfig) ===" -ForegroundColor Cyan
if (Test-Path "tsconfig.json") { npx tsc --noEmit 2>&1 | Tee-Object -FilePath "docs\tsc-noemit.txt" } else { "Проект без TypeScript — пропуск." | Out-File "docs\tsc-noemit.txt" }

Write-Host "`n=== 0.1.4 Мёртвый код: depcheck ===" -ForegroundColor Cyan
npx depcheck 2>&1 | Tee-Object -FilePath "docs\depcheck-report.txt"

Write-Host "`n=== 0.1.5 Размер бандла (build + source-map-explorer) ===" -ForegroundColor Cyan
npm run build 2>&1
if (Test-Path "build\static\js") {
  npx source-map-explorer build/static/js/*.js 2>&1 | Tee-Object -FilePath "docs\source-map-explorer.txt"
}

Write-Host "`nГотово. Отчёты в docs\ и сводка в docs\AUDIT-REFACTOR-0.1.md" -ForegroundColor Green
