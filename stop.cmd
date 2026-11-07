@echo off
REM Stops the app windows that start.cmd opened. Options: -WithServices (also stop databases that start.cmd started), -DryRun
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\stop.ps1" %*
echo.
pause
endlocal
