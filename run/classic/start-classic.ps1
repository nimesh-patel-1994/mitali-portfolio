<#
.SYNOPSIS
    Classic launcher (start-classic.cmd): starts mitali-portfolio locally and opens it in the browser (Brave, else Chrome,
    else the default browser). Kept unchanged in behaviour from the original hand-made start.cmd; the run kit's start.cmd is the
    second option.

.DESCRIPTION
    Default (development) mode:
      * backend API  -> http://127.0.0.1:8000  (uvicorn with auto-reload, own window)
      * frontend     -> http://localhost:5173  (Vite dev server, own window; proxies /api and /media to the backend)
      * opens        -> http://localhost:5173/ and http://localhost:5173/admin
    -Preview mode (production-like, see start.md):
      * rebuilds the pre-rendered site from the dev database, then serves it from the backend
      * opens        -> http://localhost:8000/ and http://localhost:8000/admin
    Anything already running on its port is reused, not started twice. Close a window to stop that app.

.EXAMPLE
    start-classic.cmd
.EXAMPLE
    start-classic.cmd -Preview
.EXAMPLE
    start-classic.cmd -DryRun      (prints what would happen, incl. the target database; starts nothing)
#>
[CmdletBinding()]
param(
    [switch]$Preview,
    [switch]$NoBrowser,
    [switch]$DryRun,
    [int]$TimeoutSeconds = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# This script lives in run\classic; the project root is two folders up.
$Root = (Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")).Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$ApiHealth = "http://127.0.0.1:8000/api/health"

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "    $Text" -ForegroundColor Green }
function Stop-WithError([string]$Text) {
    Write-Host ""
    Write-Host "ERROR: $Text" -ForegroundColor Red
    Write-Host ""
    if ([Environment]::UserInteractive -and -not ([Environment]::GetCommandLineArgs() -contains "-NonInteractive")) {
        Read-Host "Press Enter to close"
    }
    exit 1
}

function Invoke-Native([string]$WorkingDirectory, [string]$Description, [scriptblock]$Command) {
    # Native tools log to stderr (alembic, npm); in Windows PowerShell 5.1 that must not count as an error.
    Push-Location -LiteralPath $WorkingDirectory
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Command 2>&1 | ForEach-Object { Write-Host "    $_" }
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
        Pop-Location
    }
    if ($code) { Stop-WithError "$Description failed (exit code $code)." }
}

function Test-Port([int]$Port) {
    # Vite binds "localhost", which Node may resolve to IPv6 (::1) only; uvicorn binds 127.0.0.1. Try both.
    foreach ($address in @("127.0.0.1", "::1")) {
        $family = [System.Net.IPAddress]::Parse($address).AddressFamily
        $client = New-Object System.Net.Sockets.TcpClient($family)
        try {
            $task = $client.ConnectAsync($address, $Port)
            if ($task.Wait(500) -and $client.Connected) { return $true }
        }
        catch { }
        finally { $client.Dispose() }
    }
    return $false
}

function Stop-ProcessTree([int]$ProcessId) {
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-ProcessTree $_.ProcessId }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Wait-ForUrl([string]$Url, [string]$Name) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -lt 500) { Write-Ok "$Name is up ($Url)"; return }
        }
        catch { }
        Start-Sleep -Seconds 1
    }
    Stop-WithError "$Name did not respond at $Url within $TimeoutSeconds s. Check its window for errors."
}

function Start-AppWindow([string]$Title, [string]$WorkingDirectory, [string]$Command) {
    # A separate PowerShell window per app, so logs stay visible and closing the window stops the app.
    $script = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$WorkingDirectory'; $Command"
    Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $script) | Out-Null
}

function Find-Browser {
    $candidates = @(
        @{ Name = "Brave"; Exe = "brave.exe"; Paths = @(
            "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
            "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe",
            "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe") },
        @{ Name = "Chrome"; Exe = "chrome.exe"; Paths = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") }
    )
    foreach ($candidate in $candidates) {
        foreach ($path in $candidate.Paths) {
            if ($path -and (Test-Path -LiteralPath $path)) { return @{ Name = $candidate.Name; Path = $path } }
        }
        foreach ($hive in @("HKLM", "HKCU")) {
            $key = "${hive}:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($candidate.Exe)"
            $registered = (Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).'(default)'
            if ($registered -and (Test-Path -LiteralPath $registered)) { return @{ Name = $candidate.Name; Path = $registered } }
        }
    }
    return $null
}

function Open-Urls([string[]]$Urls) {
    if ($NoBrowser) { return }
    $browser = Find-Browser
    if ($browser) {
        Write-Step "Opening $($browser.Name)"
        Start-Process -FilePath $browser.Path -ArgumentList $Urls | Out-Null
    }
    else {
        Write-Step "Opening the default browser"
        foreach ($url in $Urls) { Start-Process $url | Out-Null }
    }
}

# ------------------------------------------------------------------------------------------------ checks
Write-Step "Checking prerequisites"
if (-not (Test-Path -LiteralPath (Join-Path $Backend ".env"))) {
    Stop-WithError "backend\.env is missing. Run backend\scripts\setup_db.ps1 first (see README.md)."
}
if (-not (Test-Port 5442)) {
    Stop-WithError "PostgreSQL 17 is not reachable on port 5442. Start the 'postgresql-x64-17' Windows service."
}
Write-Ok "PostgreSQL 17 on port 5442"

# Target database, as host:port/name only (read through the backend's own settings; no credentials are printed).
$dbProbe = "from sqlalchemy.engine import make_url; from app.core.config import load_settings; " +
    "u = make_url(load_settings().database_url.get_secret_value()); print(f'{u.host}:{u.port or 5432}/{u.database}')"
Push-Location -LiteralPath $Backend
$previousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try { $DbTarget = (python -m uv run python -c $dbProbe 2>$null | Select-Object -Last 1) }
finally { $ErrorActionPreference = $previousPreference; Pop-Location }
if (-not $DbTarget) { $DbTarget = "<could not be determined>" }
Write-Ok "Database: $DbTarget"

if ($DryRun) {
    Write-Step "Dry run: nothing is installed, migrated or started"
    Write-Ok "Project root:  $Root"
    Write-Ok "Backend dir:   $Backend  (exists: $(Test-Path -LiteralPath $Backend))"
    Write-Ok "Frontend dir:  $Frontend  (exists: $(Test-Path -LiteralPath $Frontend))"
    Write-Ok "backend .venv: $(Test-Path -LiteralPath (Join-Path $Backend '.venv'))   frontend node_modules: $(Test-Path -LiteralPath (Join-Path $Frontend 'node_modules'))"
    Write-Ok "Port 8000 in use: $(Test-Port 8000)   Port 5173 in use: $(Test-Port 5173)"
    if ($Preview) {
        Write-Ok "Would run: alembic upgrade head; temporary backend; npm run build:site; backend with SERVE_FRONTEND=true on :8000"
        $dryUrls = @("http://localhost:8000/", "http://localhost:8000/admin")
    }
    else {
        Write-Ok "Would run: alembic upgrade head; backend (uvicorn --reload) on 127.0.0.1:8000; npm run dev on localhost:5173"
        $dryUrls = @("http://localhost:5173/", "http://localhost:5173/admin")
    }
    $dryBrowser = Find-Browser
    if ($NoBrowser) { Write-Ok "Browser: none (-NoBrowser)" }
    elseif ($dryBrowser) { Write-Ok "Browser: $($dryBrowser.Name) ($($dryBrowser.Path)) -> $($dryUrls -join ', ')" }
    else { Write-Ok "Browser: default browser -> $($dryUrls -join ', ')" }
    exit 0
}
if (-not (Test-Path -LiteralPath (Join-Path $Backend ".venv"))) {
    Write-Step "Installing backend dependencies (first run)"
    Invoke-Native $Backend "uv sync" { python -m uv sync }
}
if (-not (Test-Path -LiteralPath (Join-Path $Frontend "node_modules"))) {
    Write-Step "Installing frontend dependencies (first run)"
    Invoke-Native $Frontend "npm ci" { npm ci }
}
Write-Step "Applying database migrations"
Invoke-Native $Backend "alembic upgrade" { python -m uv run alembic upgrade head }

$uvicorn = "python -m uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-server-header --no-access-log"

# ------------------------------------------------------------------------------------------------ preview mode
if ($Preview) {
    if (Test-Port 8000) {
        Stop-WithError "Port 8000 is already in use. Close the running backend window first, then start preview again."
    }
    Write-Step "Starting a temporary backend to build the site"
    $env:SERVE_FRONTEND = "false"
    $builder = Start-Process -FilePath "python" -ArgumentList @("-m", "uv", "run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--no-server-header", "--no-access-log") -WorkingDirectory $Backend -WindowStyle Hidden -PassThru
    try {
        Wait-ForUrl $ApiHealth "Backend API"
        Write-Step "Building the pre-rendered site from the dev database"
        Invoke-Native $Frontend "npm run build:site" { npm run build:site }
    }
    finally {
        # "python -m uv run uvicorn" is a chain of processes (uv -> venv python -> uvicorn); stop the whole tree.
        Stop-ProcessTree $builder.Id
        $deadline = (Get-Date).AddSeconds(15)
        while ((Test-Port 8000) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 300 }
    }
    if (Test-Port 8000) { Stop-WithError "The temporary build backend did not release port 8000." }
    Write-Step "Starting the production-like server"
    Start-AppWindow "mitali-portfolio preview :8000" $Backend "`$env:SERVE_FRONTEND = 'true'; $uvicorn"
    Wait-ForUrl "http://localhost:8000/" "Preview site"
    Open-Urls @("http://localhost:8000/", "http://localhost:8000/admin")
    Write-Host ""
    Write-Ok "Preview running. Close the 'mitali-portfolio preview :8000' window to stop it."
    exit 0
}

# ------------------------------------------------------------------------------------------------ development mode
if (Test-Port 8000) {
    Write-Ok "Backend already running on port 8000 (reused)"
}
else {
    Write-Step "Starting the backend API"
    Start-AppWindow "mitali-portfolio backend :8000" $Backend "$uvicorn --reload"
}
if (Test-Port 5173) {
    Write-Ok "Frontend already running on port 5173 (reused)"
}
else {
    Write-Step "Starting the frontend dev server"
    Start-AppWindow "mitali-portfolio frontend :5173" $Frontend "npm run dev"
}

Wait-ForUrl $ApiHealth "Backend API"
Wait-ForUrl "http://localhost:5173/" "Frontend"
Open-Urls @("http://localhost:5173/", "http://localhost:5173/admin")

Write-Host ""
Write-Ok "All apps are running. Close their windows to stop them."
