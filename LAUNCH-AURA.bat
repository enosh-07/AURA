@echo off
title AURA Music Player Launcher
echo ========================================================
echo   Launching AURA Cross-Platform Music Application
echo ========================================================

:: Check if backend is already running on port 4000
netstat -ano | findstr :4000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/2] Starting AURA Backend API Server on http://localhost:4000...
    start /b "" cmd /c "cd /d %~dp0backend && npm run dev >nul 2>&1"
    timeout /t 2 /nobreak >nul
) else (
    echo [1/2] AURA Backend API is already running on port 4000.
)

:: Launch desktop application
echo [2/2] Launching AURA Desktop App...
if exist "%~dp0src-tauri\target\release\aura.exe" (
    start "" "%~dp0src-tauri\target\release\aura.exe"
) else (
    cd /d "%~dp0"
    npm run tauri:dev
)

echo Done!
exit
