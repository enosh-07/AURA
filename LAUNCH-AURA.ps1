# AURA Launcher - Starts Backend & Launches Desktop App
$backend = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
if (-not $backend) {
    Write-Host "[1/2] Starting AURA Backend API on http://localhost:4000..." -ForegroundColor Cyan
    Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "$PSScriptRoot\backend" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/2] AURA Backend API is running on port 4000." -ForegroundColor Green
}

Write-Host "[2/2] Launching AURA Desktop..." -ForegroundColor Cyan
$releaseExe = "$PSScriptRoot\src-tauri\target\release\aura.exe"
if (Test-Path $releaseExe) {
    Start-Process -FilePath $releaseExe
} else {
    Set-Location $PSScriptRoot
    npm run tauri:dev
}
