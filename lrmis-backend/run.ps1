$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectRoot "..\venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    Write-Error "Python virtual environment was not found at: $Python"
}

Set-Location $ProjectRoot
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
