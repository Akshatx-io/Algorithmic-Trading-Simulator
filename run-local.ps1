<#
.SYNOPSIS
  Run the HFT Trading Simulator locally with ZERO external infra.
  No Docker, no Postgres, no Redis required.

  - Database : local SQLite file (hft.db) — schema auto-created on first run
  - Redis    : in-memory fakeredis fallback (USE_FAKE_REDIS=true)

.USAGE
  Backend only:        .\run-local.ps1
  Backend + frontend:  .\run-local.ps1 -WithFrontend
#>
param([switch]$WithFrontend)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# --- Local-dev environment (no external services) ---
$env:ENVIRONMENT    = "development"
$env:DATABASE_URL   = "sqlite:///./hft.db"
$env:USE_FAKE_REDIS = "true"
if (-not $env:JWT_SECRET_KEY) {
    $env:JWT_SECRET_KEY = "local-dev-secret-please-change-32-chars-minimum"
}

# --- Python venv ---
if (-not (Test-Path ".venv")) {
    Write-Host "[setup] creating virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}
& .\.venv\Scripts\Activate.ps1

# --- Dependencies (install once; fast no-op afterwards) ---
if (-not (Test-Path ".venv\.deps_installed")) {
    Write-Host "[setup] installing backend dependencies..." -ForegroundColor Cyan
    python -m pip install --upgrade pip | Out-Null
    pip install -e ".[dev]"
    New-Item -ItemType File ".venv\.deps_installed" | Out-Null
}

# --- Optional frontend in a second window ---
if ($WithFrontend) {
    Write-Host "[frontend] launching Vite dev server in a new window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-NoExit","-Command",
        "Set-Location '$PSScriptRoot\frontend'; if (-not (Test-Path 'node_modules\zustand')) { npm install }; npm run dev"
    )
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  API      : http://localhost:8000" -ForegroundColor Green
Write-Host "  Swagger  : http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  Health   : http://localhost:8000/health" -ForegroundColor Green
if ($WithFrontend) { Write-Host "  Frontend : http://localhost:5173" -ForegroundColor Green }
Write-Host "  (SQLite + in-memory Redis - no Docker needed)" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

# --- Run the API (foreground, hot-reload) ---
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
