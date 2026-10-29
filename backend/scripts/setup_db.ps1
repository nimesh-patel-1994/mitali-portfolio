<#
.SYNOPSIS
    One-time database setup for mitali-portfolio (TS-018, SD-005, SEC-004). Run by the user, never by an agent.

.DESCRIPTION
    Creates (or updates) the least-privilege app role and the databases mitali_portfolio and
    mitali_portfolio_test on the local PostgreSQL 17 server (port 5442) by running setup_db.sql with psql.

    * psql prompts for the PostgreSQL superuser password itself; this script never sees or stores it.
    * The new app-role password is read with Read-Host -AsSecureString (twice) and handed to psql only through the
      process-scoped environment variable MP_APP_PASSWORD, which is removed in "finally". It is never put on a
      command line and only written to disk if you agree to create backend\.env.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File backend\scripts\setup_db.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File backend\scripts\setup_db.ps1 -SuperUser postgres -AppRole mitali_app -Port 5442
#>
[CmdletBinding()]
param(
    [string]$SuperUser = "postgres",
    [string]$AppRole = "mitali_app",
    [ValidateRange(1, 65535)]
    [int]$Port = 5442,
    [string]$PsqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$DbHost = "localhost"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$SqlFile = Join-Path $ScriptDir "setup_db.sql"
$EnvExample = Join-Path $BackendDir ".env.example"
$EnvFile = Join-Path $BackendDir ".env"
$MinRecommendedLength = 16

function Read-Confirmation([string]$Prompt, [bool]$DefaultYes) {
    $answer = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($answer)) { return $DefaultYes }
    return $answer.Trim().ToLowerInvariant().StartsWith("y")
}

function ConvertTo-PlainText([System.Security.SecureString]$Secure) {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function New-RandomSecret {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Read-AppPassword {
    while ($true) {
        $first = Read-Host "New password for the app role '$AppRole'" -AsSecureString
        $second = Read-Host "Repeat the password" -AsSecureString
        $plainFirst = ConvertTo-PlainText $first
        $plainSecond = ConvertTo-PlainText $second
        try {
            if ($plainFirst -ne $plainSecond) {
                Write-Host "The passwords do not match. Try again." -ForegroundColor Yellow
                continue
            }
            if ($plainFirst.Length -eq 0) {
                Write-Host "The password must not be empty." -ForegroundColor Yellow
                continue
            }
            if ($plainFirst.Length -lt $MinRecommendedLength) {
                Write-Host "At least $MinRecommendedLength characters are recommended." -ForegroundColor Yellow
                if (-not (Read-Confirmation "Use this shorter password anyway? [y/N]" $false)) { continue }
            }
            return $plainFirst
        }
        finally {
            $plainSecond = $null
        }
    }
}

function Write-EnvFile([string]$Password) {
    if (-not (Test-Path -LiteralPath $EnvExample)) {
        throw "Template not found: $EnvExample"
    }
    if (Test-Path -LiteralPath $EnvFile) {
        if (-not (Read-Confirmation "backend\.env already exists. Overwrite it? [y/N]" $false)) {
            Write-Host "Kept the existing backend\.env (not changed)."
            return
        }
    }
    $encodedUser = [Uri]::EscapeDataString($AppRole)
    $encodedPassword = [Uri]::EscapeDataString($Password)
    $base = "postgresql+asyncpg://${encodedUser}:${encodedPassword}@${DbHost}:$Port"
    $lines = foreach ($line in Get-Content -LiteralPath $EnvExample -Encoding UTF8) {
        if ($line -match '^DATABASE_URL=') { "DATABASE_URL=$base/mitali_portfolio" }
        elseif ($line -match '^TEST_DATABASE_URL=') { "TEST_DATABASE_URL=$base/mitali_portfolio_test" }
        elseif ($line -match '^HASH_KEY_SECRET=') { "HASH_KEY_SECRET=$(New-RandomSecret)" }
        else { $line }
    }
    $content = ($lines -join "`r`n") + "`r`n"
    [System.IO.File]::WriteAllText($EnvFile, $content, (New-Object System.Text.UTF8Encoding $false))
    $content = $null
    Write-Host "Wrote backend\.env (git-ignored). Keep it private."
}

# ------------------------------------------------------------------------------------------------ checks
if ($AppRole -notmatch '^[a-z_][a-z0-9_]{0,62}$') {
    throw "AppRole must be a lower-case PostgreSQL identifier (letters, digits, underscore)."
}
if ($SuperUser -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') {
    throw "SuperUser must be a plain PostgreSQL role name."
}
if (-not (Test-Path -LiteralPath $PsqlPath -PathType Leaf)) {
    throw "psql not found at '$PsqlPath'. Install PostgreSQL 17 or pass -PsqlPath with the full path to psql.exe."
}
if (-not (Test-Path -LiteralPath $SqlFile -PathType Leaf)) {
    throw "SQL file not found: $SqlFile"
}

Write-Host "Using $(& $PsqlPath --version)"
Write-Host "Server: ${DbHost}:$Port  superuser: $SuperUser  app role: $AppRole"
Write-Host ""

# ------------------------------------------------------------------------------------------------ run
$appPassword = Read-AppPassword
try {
    $env:MP_APP_PASSWORD = $appPassword
    Write-Host ""
    Write-Host "psql will now ask for the password of the PostgreSQL superuser '$SuperUser'."
    & $PsqlPath -h $DbHost -p $Port -U $SuperUser -d postgres -v ON_ERROR_STOP=1 -v "app_role=$AppRole" -X -q -f $SqlFile
    if ($LASTEXITCODE -ne 0) {
        throw "psql exited with code $LASTEXITCODE; see the message above. Nothing else was changed by this script."
    }
}
finally {
    Remove-Item Env:\MP_APP_PASSWORD -ErrorAction SilentlyContinue
}

try {
    Write-Host ""
    if (Read-Confirmation "Write backend\.env now? [Y/n]" $true) {
        Write-EnvFile $appPassword
    }
    else {
        Write-Host "Skipped. Copy backend\.env.example to backend\.env and fill in DATABASE_URL, TEST_DATABASE_URL and HASH_KEY_SECRET."
    }
}
finally {
    $appPassword = $null
}

Write-Host ""
Write-Host "Next steps (from the backend folder):"
Write-Host "  python -m uv sync"
Write-Host "  python -m uv run alembic upgrade head"
Write-Host "  python -m uv run python -m app.cli create-admin --email <your email>"
Write-Host "  python -m uv run python -m app.cli seed"
