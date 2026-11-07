<#
.SYNOPSIS
  One-minute smoke test of the running project: every health URL answers, optional journey command passes. Writes run\smoke-report.md.

.DESCRIPTION
  Kit file owned by the dev-pipeline toolkit. Reads run\run.json. Start the apps first (start.cmd) or pass -Start.
  The optional "smoke" section of run.json: { "dir": "web", "journey": "npx playwright test --grep @smoke", "screenshots_dir": "run/smoke-screens" }.
  A journey is a short end-to-end test of the main flow, on test data only. Nothing is deployed or published.

  Usage:  smoke.cmd [-Start] [-DryRun]
#>
param([switch]$Start, [switch]$DryRun)
$ErrorActionPreference = 'Continue'
$kit = $PSScriptRoot
$root = Split-Path -Parent $kit
$onWindows = ($env:OS -eq 'Windows_NT')
function Say([string]$Message) { if ($DryRun) { Write-Host "[dry-run] $Message" } else { Write-Host $Message } }

$manifestPath = Join-Path $kit 'run.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { Write-Host 'ERROR: run\run.json not found. Ask Claude to run /run-kit.' -ForegroundColor Red; exit 1 }
try { $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json } catch { Write-Host "ERROR: run\run.json is not valid JSON: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }

if ($Start) {
    Say 'starting the apps (start.ps1 -NoBrowser)'
    if (-not $DryRun) { & (Join-Path $kit 'start.ps1') -NoBrowser | Out-Host }
}

$rows = New-Object System.Collections.Generic.List[object]
$failed = 0
foreach ($a in @($m.apps | Where-Object { $_ -and $_.health })) {
    if ($DryRun) { Say "would check $($a.name): $($a.health)"; continue }
    $status = 'DOWN'; $ms = 0; $note = ''
    try {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-WebRequest -Uri $a.health -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
        $sw.Stop(); $ms = [int]$sw.ElapsedMilliseconds
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $status = 'OK' } else { $status = "HTTP $($r.StatusCode)" }
    } catch {
        $note = ([string]$_.Exception.Message).Split("`n")[0]
        if ($_.Exception.Response) { $status = "HTTP $([int]$_.Exception.Response.StatusCode)" }
    }
    if ($status -ne 'OK') { $failed++ }
    $rows.Add([pscustomobject]@{ app = $a.name; url = $a.health; status = $status; ms = $ms; note = $note })
    $color = 'Green'; if ($status -ne 'OK') { $color = 'Red' }
    Write-Host ("  {0,-4} {1} ({2}) {3} ms {4}" -f $status, $a.name, $a.health, $ms, $note) -ForegroundColor $color
}

$journeyResult = 'not configured'
$sm = $m.smoke
if ($sm -and $sm.journey) {
    if ($sm.journey -match '(?i)terraform\s+(apply|destroy)|az\s+(group|deployment)\s+(create|delete)|git\s+push') { Write-Host 'ERROR: smoke.journey contains a command that is not allowed.' -ForegroundColor Red; exit 1 }
    Say "journey: $($sm.journey)"
    if (-not $DryRun) {
        if ($failed -gt 0) { $journeyResult = 'skipped (an app is down)' }
        else {
            $dir = $root; if ($sm.dir) { $dir = Join-Path $root $sm.dir }
            Push-Location -LiteralPath $dir
            try { if ($onWindows) { & cmd.exe /c $sm.journey } else { & bash -c $sm.journey }; $rc = $LASTEXITCODE } finally { Pop-Location }
            if ($rc -eq 0) { $journeyResult = 'PASS' } else { $journeyResult = "FAIL (exit code $rc)"; $failed++ }
        }
    }
}
if ($DryRun) { exit 0 }

$verdict = 'PASS'; if ($failed -gt 0) { $verdict = 'FAIL' }
$lines = @("# Smoke report: $($m.project) $($m.phase)", '', "Run: $((Get-Date).ToString('yyyy-MM-dd HH:mm')). Verdict: **$verdict**", '', '| App | URL | Status | Time (ms) |', '|-----|-----|--------|-----------|')
foreach ($r in $rows) { $lines += "| $($r.app) | $($r.url) | $($r.status) | $($r.ms) |" }
$lines += ''; $lines += "Journey: $journeyResult"
if ($sm -and $sm.screenshots_dir) { $lines += "Screenshots: $($sm.screenshots_dir)" }
Set-Content -LiteralPath (Join-Path $kit 'smoke-report.md') -Value $lines -Encoding UTF8
Write-Host ''
if ($failed -gt 0) { Write-Host "SMOKE FAIL ($failed problem(s)). See run\smoke-report.md. Is start.cmd running?" -ForegroundColor Red; exit 1 }
Write-Host 'SMOKE PASS. Report: run\smoke-report.md' -ForegroundColor Green
exit 0
