<#
.SYNOPSIS
  Looks for secrets before they are committed. Prints file, line and rule only; the secret itself is never printed.

.DESCRIPTION
  Kit file owned by the dev-pipeline toolkit. Uses gitleaks when it is installed, otherwise a built-in set of rules
  (private keys, cloud and token formats, passwords in connection strings or assignments, tracked .env files).
  Usage:  secret-scan.ps1 [-Staged] [-Path <folder>]      -Staged scans only what git is about to commit (used by the pre-commit hook).
  Exit code 1 means a possible secret was found. A false alarm can be silenced by adding "secret-scan:ignore" in a comment on that line.
#>
param([switch]$Staged, [string]$Path)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
if ($Path) { $root = $Path }
$gl = Get-Command gitleaks -ErrorAction SilentlyContinue
if ($gl) {
    Push-Location -LiteralPath $root
    try { if ($Staged) { & gitleaks protect --staged --redact --no-banner } else { & gitleaks detect --no-git --redact --no-banner --source . } ; exit $LASTEXITCODE } finally { Pop-Location }
}
$rules = @(
    @{ n = 'private key block'; r = '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY' },
    @{ n = 'AWS access key id'; r = '\bAKIA[0-9A-Z]{16}\b' },
    @{ n = 'GitHub token'; r = '\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}' },
    @{ n = 'Slack token'; r = '\bxox[abprs]-[A-Za-z0-9-]{10,}' },
    @{ n = 'Azure storage or service key'; r = '(AccountKey|SharedAccessKey|SharedAccessSignature)\s*=\s*[A-Za-z0-9+/=%]{20,}' },
    @{ n = 'password in connection string'; r = '(?i)(password|pwd)\s*=\s*[^;\s''"]{4,}' },
    @{ n = 'password or secret assignment'; r = '(?i)\b(password|passwd|secret|api[_-]?key|client[_-]?secret|token)\b["'']?\s*[:=]\s*["''][^"''\s]{8,}["'']' },
    @{ n = 'JWT'; r = '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' }
)
$skipExt = '\.(png|jpe?g|gif|ico|webp|pdf|zip|gz|tgz|exe|dll|so|apk|aab|jar|woff2?|ttf|otf|mp4|mov|lock|snap)$'
$skipDir = '[\\/](node_modules|\.git|bin|obj|dist|build|\.next|\.dart_tool|coverage|mobile-publish)[\\/]'
$files = @()
if ($Staged) {
    Push-Location -LiteralPath $root
    try { $files = @(& git diff --cached --name-only --diff-filter=ACM 2>$null | ForEach-Object { Join-Path $root $_ }) } finally { Pop-Location }
} else {
    $files = @(Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch $skipDir -and $_.Name -notmatch $skipExt -and $_.Length -lt 1MB } | ForEach-Object { $_.FullName })
}
$found = 0
foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f) -or $f -match $skipExt -or $f -match $skipDir) { continue }
    $rel = $f.Substring($root.Length).TrimStart('\', '/')
    $leaf = Split-Path -Leaf $f
    if ($leaf -match '^\.env(\..+)?$' -and $leaf -notmatch '\.(example|sample|template)$') { Write-Host "  ${rel}: environment file would be committed (add it to .gitignore)"; $found++; continue }
    $i = 0
    foreach ($line in (Get-Content -LiteralPath $f -ErrorAction SilentlyContinue)) {
        $i++
        if ($line -match 'secret-scan:ignore') { continue }
        foreach ($r in $rules) { if ($line -match $r.r) { Write-Host "  ${rel}:${i}: possible $($r.n)"; $found++; break } }
    }
}
if ($found -gt 0) { Write-Host "SECRET SCAN: $found possible secret(s). Remove them, rotate any that were real, and use environment variables." -ForegroundColor Red; exit 1 }
Write-Host 'Secret scan: nothing found.' -ForegroundColor Green
exit 0
