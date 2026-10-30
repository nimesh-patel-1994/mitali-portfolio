<#
.SYNOPSIS
  Stops the app windows that start.cmd opened (and optionally the services it started).

.DESCRIPTION
  Kit file owned by the dev-pipeline toolkit. Reads run\pids.json (written by start.ps1). Only stops what start.cmd started:
  apps that were already running when you ran start.cmd are left alone, and so are databases unless you pass -WithServices.

  Usage:  stop.cmd [-WithServices] [-DryRun]
#>
param([switch]$WithServices, [switch]$DryRun)
$ErrorActionPreference = 'Continue'
$kit = $PSScriptRoot
$root = Split-Path -Parent $kit
$onWindows = ($env:OS -eq 'Windows_NT')
$pidFile = Join-Path $kit 'pids.json'

function Say([string]$Message) { if ($DryRun) { Write-Host "[dry-run] $Message" } else { Write-Host $Message } }

if (Test-Path -LiteralPath $pidFile) {
    $items = @()
    try { $items = @(Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json) } catch { Write-Host 'run\pids.json could not be read; nothing to stop by process id.' }
    foreach ($i in $items) {
        if (-not $i.pid) { continue }
        $p = Get-Process -Id ([int]$i.pid) -ErrorAction SilentlyContinue
        if (-not $p) { Write-Host "$($i.name): already closed"; continue }
        Say "stopping $($i.name) (process $($i.pid) and its children)"
        if (-not $DryRun) {
            if ($onWindows) { & taskkill.exe /PID $i.pid /T /F | Out-Null } else { Stop-Process -Id ([int]$i.pid) -Force -ErrorAction SilentlyContinue }
        }
    }
    if (-not $DryRun) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
} else {
    Write-Host 'Nothing recorded as started (run\pids.json is missing). Apps you started by hand are left alone.'
}

if ($WithServices) {
    $manifestPath = Join-Path $kit 'run.json'
    if (Test-Path -LiteralPath $manifestPath) {
        $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        foreach ($s in @($m.services | Where-Object { $_ })) {
            if ($s.stop) {
                Say "stopping service $($s.name): $($s.stop)"
                if (-not $DryRun) { Push-Location -LiteralPath $root; try { & cmd.exe /c $s.stop } finally { Pop-Location } }
            } else { Write-Host "$($s.name): no stop command in run.json; stop it yourself if you want to." }
        }
    }
} else {
    Write-Host 'Databases and other services were left running (use stop.cmd -WithServices to stop the ones that have a stop command).'
}
exit 0
