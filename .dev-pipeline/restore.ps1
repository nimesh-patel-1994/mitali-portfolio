<#
.SYNOPSIS
  Gets this project working on a new computer: checks tools, clones the repositories, recreates machine-specific files, and prints what is left for you to do.

.DESCRIPTION
  Carried inside the project (.dev-pipeline\restore.ps1) and independent of the toolkit, so it works when you have only this project and the Claude marketplace.
  It reads .dev-pipeline\restore.json (written by /machine-setup). Safe by design:
    - It never overwrites an existing folder or file, never pushes, never creates or reads secrets: .env files are only COPIED from their .env.example, and you fill in the values.
    - It installs tools only with -Install, after you confirm (winget).
  <DEV_ROOT> is the folder that holds your projects. Default: the folder above "projects" (or above this project when it is not under "projects").

  Usage:  restore.ps1 [-DevRoot <folder>] [-Install] [-Yes] [-SkipClone] [-DryRun]
#>
param([string]$DevRoot, [switch]$Install, [switch]$Yes, [switch]$SkipClone, [switch]$DryRun)
$ErrorActionPreference = 'Continue'
$dp = $PSScriptRoot
$proj = Split-Path -Parent $dp
$onWindows = ($env:OS -eq 'Windows_NT')
function Say([string]$m) { if ($DryRun) { Write-Host "[dry-run] $m" } else { Write-Host $m } }
function Head([string]$m) { Write-Host ''; Write-Host $m -ForegroundColor Cyan }
function Run([string]$c) { if ($onWindows) { $o = & cmd.exe /c "$c 2>&1" } else { $o = & bash -c "$c 2>&1" }; $global:LASTEXITCODE = $LASTEXITCODE; return ($o -join "`n") }

$manifestPath = Join-Path $dp 'restore.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { Write-Host 'ERROR: .dev-pipeline\restore.json not found. In Claude run /dev-pipeline:machine-setup first (on the computer that has the project).' -ForegroundColor Red; exit 1 }
try { $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json } catch { Write-Host "ERROR: restore.json is not valid JSON: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }

if (-not $DevRoot) {
    $parent = Split-Path -Parent $proj
    if ((Split-Path -Leaf $parent) -eq 'projects') { $DevRoot = Split-Path -Parent $parent } else { $DevRoot = $parent }
}
function Resolve-Dest([string]$p) { if (-not $p) { return $null }; $x = $p.Replace('{DEV_ROOT}', $DevRoot); if ($onWindows) { $x = $x.Replace('/', '\') }; if (-not [IO.Path]::IsPathRooted($x)) { $x = Join-Path $proj $x }; return $x }
Write-Host "Project: $($m.project)    DEV_ROOT: $DevRoot" -ForegroundColor White

# 1. tools
Head '1. Tools'
$missing = @()
foreach ($t in @($m.tools)) {
    if (-not $t.check) { continue }
    $out = Run $t.check
    if ($LASTEXITCODE -eq 0) { Write-Host ("  ok       {0}" -f $t.name) -ForegroundColor DarkGreen }
    else { Write-Host ("  MISSING  {0}   (winget install -e --id {1})" -f $t.name, $t.winget) -ForegroundColor Yellow; $missing += $t }
}
$cl = Get-Command claude -ErrorAction SilentlyContinue
if ($cl) { Write-Host '  ok       Claude Code' -ForegroundColor DarkGreen } else { Write-Host '  MISSING  Claude Code   (npm install -g @anthropic-ai/claude-code, then run: claude, and sign in with the account you want here)' -ForegroundColor Yellow }
if ($missing.Count -gt 0 -and $Install) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Write-Host '  winget is not available on this computer: install the missing tools by hand.' -ForegroundColor Yellow }
    else {
        $go = $Yes; if (-not $go) { $a = Read-Host "Install $($missing.Count) missing tool(s) with winget? (y/N)"; $go = ($a -match '^(y|yes)$') }
        if ($go) { foreach ($t in $missing) { if ($t.winget) { Say "winget install -e --id $($t.winget)"; if (-not $DryRun) { & winget install -e --id $t.winget --accept-package-agreements --accept-source-agreements } } } }
    }
} elseif ($missing.Count -gt 0) { Write-Host '  (run again with -Install to let winget install them after you confirm)' }

# 2. repositories
Head '2. Repositories'
$git = Get-Command git -ErrorAction SilentlyContinue
foreach ($r in @($m.repos)) {
    $dest = Resolve-Dest $r.clone_to
    if (-not $dest) { continue }
    if ($r.role -eq 'workspace' -or $r.role -eq 'project') { Write-Host ('  this     {0} (you are in it)' -f $r.name); continue }
    if (Test-Path -LiteralPath (Join-Path $dest '.git')) {
        $b = (& git -C $dest rev-parse --abbrev-ref HEAD 2>$null)
        Write-Host ("  exists   {0} at {1} (branch {2}); left untouched" -f $r.name, $dest, $b)
        continue
    }
    if (Test-Path -LiteralPath $dest) { Write-Host ("  SKIPPED  {0}: {1} exists but is not a git clone; move it away or clone by hand" -f $r.name, $dest) -ForegroundColor Yellow; continue }
    if ($SkipClone) { Write-Host ("  skipped  {0} (-SkipClone)" -f $r.name); continue }
    if (-not $r.remote) { Write-Host ("  NO REMOTE recorded for {0}: clone it by hand to {1}" -f $r.name, $dest) -ForegroundColor Yellow; continue }
    if (-not $git) { Write-Host '  git is missing: install it first (winget install -e --id Git.Git)' -ForegroundColor Yellow; break }
    Say "git clone $($r.remote) $dest"
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
        & git clone $r.remote $dest
        if ($LASTEXITCODE -eq 0 -and $r.branch) { & git -C $dest checkout $r.branch 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { Write-Host "  branch '$($r.branch)' is not on the remote yet (push it from the other computer first); staying on the default branch." -ForegroundColor Yellow } }
    }
}

# 3. machine-specific repo paths (adopted projects)
Head '3. Local files'
$local = Join-Path $dp 'repos.local.json'
$codeRepos = @($m.repos | Where-Object { $_.role -ne 'workspace' -and $_.clone_to })
if ($m.kind -eq 'adopted' -and $codeRepos.Count -gt 0) {
    if (Test-Path -LiteralPath $local) { Write-Host '  exists   .dev-pipeline\repos.local.json' }
    else {
        $obj = [ordered]@{ repos = @($codeRepos | ForEach-Object { [ordered]@{ name = $_.name; path = (Resolve-Dest $_.clone_to) } }) }
        Say 'writing .dev-pipeline\repos.local.json'
        if (-not $DryRun) { [IO.File]::WriteAllText($local, (ConvertTo-Json -Depth 4 -InputObject $obj) + "`n", (New-Object Text.UTF8Encoding($false))) }
    }
}
foreach ($e in @($m.env_files)) {
    $dest = Join-Path $proj ($e.path.Replace('/', '\')); if (-not $onWindows) { $dest = Join-Path $proj $e.path }
    if (Test-Path -LiteralPath $dest) { Write-Host "  exists   $($e.path) (not read)"; continue }
    if ($e.from) {
        $src = Join-Path $proj ($e.from.Replace('/', '\')); if (-not $onWindows) { $src = Join-Path $proj $e.from }
        if (Test-Path -LiteralPath $src) { Say "copy $($e.from) -> $($e.path)  (fill in the values yourself)"; if (-not $DryRun) { Copy-Item -LiteralPath $src -Destination $dest }; continue }
    }
    Write-Host "  TO DO    create $($e.path) yourself $($e.note)" -ForegroundColor Yellow
}

# 4. what is left for you
Head '4. What is left for you'
if (@($m.databases).Count -gt 0) { Write-Host '  Databases to recreate (data does not travel through git):'; foreach ($d in @($m.databases)) { Write-Host ("    - {0} ({1}): {2}" -f $d.name, $d.engine, $d.recreate) } }
foreach ($s in @($m.manual_steps)) { Write-Host "  - $s" }
Write-Host '  - Fill in the values of the .env files yourself (they are never stored in git).'
Write-Host ''
Write-Host 'Claude plugin (once per Claude account on this computer), in a Claude session:' -ForegroundColor White
Write-Host "    /plugin marketplace add $($m.toolkit.marketplace)"
Write-Host "    /plugin install $($m.toolkit.plugin)"
Write-Host '  (desktop app: Settings > Plugins > add the marketplace, then install dev-pipeline)'
Write-Host ''
$open = $m.open_with; if (-not $open) { $open = '.dev-pipeline\open-claude.ps1' }
Write-Host "Then open the project:  $open    and run  /dev-pipeline:resume" -ForegroundColor Green
exit 0
