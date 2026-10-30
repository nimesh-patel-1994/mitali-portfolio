@echo off
REM Builds the Android APK (debug by default) into mobile-publish\android. Options: -Release (needs your own signing settings) -ApiUrl http://host:port -DryRun
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\build-apk.ps1" %*
echo.
pause
endlocal
