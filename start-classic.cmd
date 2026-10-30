@echo off
rem Classic launcher: starts backend :8000 + frontend :5173 and opens / and /admin in Brave (else Chrome, else default).
rem Options: -Preview (production-like on :8000), -NoBrowser, -TimeoutSeconds N. See start.md.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run\classic\start-classic.ps1" %*
if errorlevel 1 pause
