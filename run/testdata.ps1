<#
.SYNOPSIS
  Resets and reseeds the TEST data of this project with one command.

.DESCRIPTION
  Kit file owned by the dev-pipeline toolkit. Reads the "testdata" section of run\run.json:
    { "target": "database app_dev on localhost", "dir": "backend", "reset": ["dotnet ef database drop --force", "dotnet ef database update"], "seed": ["dotnet run --project tools/Seed"] }
  Safety: it refuses to run unless "target" names a test, dev, local or sandbox database, it shows exactly what it will run and asks you to confirm
  (or pass -Yes), and commands that touch cloud resources are rejected. It never reads .env files or connection strings.

  Usage:  testdata.cmd [-Reset] [-Seed] [-Yes] [-DryRun]      (no switch = reset then seed)
#>
param([switch]$Reset, [switch]$Seed, [switch]$Yes, [switch]$DryRun)
$ErrorActionPreference = 'Continue'
$kit = $PSScriptRoot
$root = Split-Path -Parent $kit
$onWindows = ($env:OS -eq 'Windows_NT')
function Fail([string]$Message) { Write-Host "ERROR: $Message" -ForegroundColor Red; exit 1 }

$manifestPath = Join-Path $kit 'run.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { Fail 'run\run.json not found. Ask Claude to run /run-kit.' }
try { $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json } catch { Fail "run\run.json is not valid JSON: $($_.Exception.Message)" }
$td = $m.testdata
if (-not $td) { Fail 'run\run.json has no "testdata" section. Ask Claude to run /testdata.' }
if (-not $td.target -or ([string]$td.target) -notmatch '(?i)(test|dev|local|sandbox)') { Fail 'testdata.target must name a test, dev, local or sandbox database (for example "database app_dev on localhost"). Refusing to run.' }
if (([string]$td.target) -match '(?i)prod|live|staging') { Fail 'testdata.target looks like a production or shared environment. Refusing to run.' }
if (-not $Reset -and -not $Seed) { $Reset = $true; $Seed = $true }
$cmds = New-Object System.Collections.Generic.List[string]
if ($Reset) { foreach ($c in @($td.reset)) { if ($c) { $cmds.Add([string]$c) } } }
if ($Seed) { foreach ($c in @($td.seed)) { if ($c) { $cmds.Add([string]$c) } } }
if ($cmds.Count -eq 0) { Fail 'Nothing to run: testdata.reset and testdata.seed are empty.' }
foreach ($c in $cmds) {
    if ($c -match '(?i)terraform|az\s+|azcopy|git\s+push|prod|production|--connection|connectionstring|password|pwd=') { Fail "Command '$c' is not allowed here (cloud, production, or a connection string)." }
}
Write-Host "Target: $($td.target)"
foreach ($c in $cmds) { Write-Host "  will run: $c" }
if ($DryRun) { Write-Host '[dry-run] nothing was run.'; exit 0 }
if (-not $Yes) { $a = Read-Host 'Run these on that test database? (y/N)'; if ($a -notmatch '^(y|yes)$') { Write-Host 'Cancelled.'; exit 0 } }
$dir = $root; if ($td.dir) { $dir = Join-Path $root $td.dir }
Push-Location -LiteralPath $dir
try {
    foreach ($c in $cmds) {
        Write-Host "> $c"
        if ($onWindows) { & cmd.exe /c $c } else { & bash -c $c }
        if ($LASTEXITCODE -ne 0) { Fail "'$c' failed with exit code $LASTEXITCODE." }
    }
} finally { Pop-Location }
Write-Host 'Test data is ready.' -ForegroundColor Green
exit 0
