<#
.SYNOPSIS
  Builds the Android APK of this project and copies it to mobile-publish\android.

.DESCRIPTION
  Kit file owned by the dev-pipeline toolkit. Reads the "mobile" section of run\run.json.
  Default is a DEBUG build: signed with the standard Android debug key, good for installing on your own phone or an emulator,
  NOT for the Play Store. A RELEASE build (-Release) needs signing settings that only you create and keep: the script only checks that the
  environment variables named in run.json "release_requires" are set (their values are never printed) and never creates a key.
  iOS cannot be built on Windows. Nothing is uploaded or published.

  Usage:  build-apk.cmd [-Release] [-ApiUrl http://192.168.1.20:5000] [-DryRun]
  The phone cannot reach "localhost", so by default the API address is this PC's LAN address plus the API port.
#>
param(
    [switch]$Release,
    [string]$ApiUrl,
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$kit = $PSScriptRoot
$root = Split-Path -Parent $kit
$onWindows = ($env:OS -eq 'Windows_NT')

function Fail([string]$Message) { Write-Host "ERROR: $Message" -ForegroundColor Red; exit 1 }
function Say([string]$Message) { if ($DryRun) { Write-Host "[dry-run] $Message" } else { Write-Host $Message } }

$manifestPath = Join-Path $kit 'run.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { Fail 'run\run.json was not found. Ask Claude to run /run-kit.' }
try { $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json } catch { Fail "run\run.json is not valid JSON: $($_.Exception.Message)" }
$mob = $m.mobile
if (-not $mob) { Fail 'run\run.json has no "mobile" section: this project has no Android app yet.' }
if ($mob.platform -and $mob.platform -ne 'android') { Fail "Only android can be built on Windows (platform is '$($mob.platform)'). iOS needs a Mac." }

$type = 'debug'; if ($Release) { $type = 'release' }
$mobDir = Join-Path $root $mob.dir
if (-not (Test-Path -LiteralPath $mobDir)) { Fail "Mobile folder '$($mob.dir)' does not exist." }

# environment check (names and presence only)
$problems = New-Object System.Collections.Generic.List[string]
if (-not (Get-Command java -ErrorAction SilentlyContinue)) { $problems.Add('Java (JDK) is not on PATH. Install a JDK (for example: winget install Microsoft.OpenJDK.17).') }
$sdk = $env:ANDROID_HOME; if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }; if (-not $sdk -and $env:LOCALAPPDATA) { $sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not $sdk -or -not (Test-Path -LiteralPath $sdk)) { $problems.Add('Android SDK not found. Install Android Studio (or the command-line tools) and set ANDROID_HOME.') }
if ($Release) {
    $missing = @($mob.release_requires | Where-Object { $_ -and -not [Environment]::GetEnvironmentVariable($_) })
    if ($missing.Count -gt 0) { $problems.Add('Release signing needs these environment variables (set them yourself; this script never creates keys): ' + ($missing -join ', ')) }
    if (-not $mob.build_release) { $problems.Add('run.json mobile.build_release is empty.') }
} elseif (-not $mob.build_debug) { $problems.Add('run.json mobile.build_debug is empty.') }
if ($problems.Count -gt 0) {
    foreach ($p in $problems) { if ($DryRun) { Write-Host "[dry-run] would stop: $p" -ForegroundColor Yellow } else { Write-Host "MISSING: $p" -ForegroundColor Red } }
    if (-not $DryRun) { exit 1 }
}

# API address the phone will use
if (-not $ApiUrl) {
    $apiApp = @($m.apps | Where-Object { $_.id -eq $mob.api_app }) | Select-Object -First 1
    $port = $null; if ($apiApp) { $port = $apiApp.port }
    if (-not $port) { Fail "Cannot work out the API port: set mobile.api_app to an app with a port in run.json, or pass -ApiUrl." }
    $lan = $null
    try {
        foreach ($nic in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
            if ($nic.OperationalStatus -ne 'Up' -or $nic.NetworkInterfaceType -eq 'Loopback') { continue }
            $props = $nic.GetIPProperties()
            if (-not ($props.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.ToString() -ne '0.0.0.0' })) { continue }
            foreach ($ua in $props.UnicastAddresses) { if ($ua.Address.AddressFamily -eq 'InterNetwork') { $lan = $ua.Address.ToString(); break } }
            if ($lan) { break }
        }
    } catch { }
    if ($lan) { $ApiUrl = "http://${lan}:$port" }
    else { $ApiUrl = "http://10.0.2.2:$port"; Write-Host "No LAN address found: using $ApiUrl, which works only inside the Android emulator." -ForegroundColor Yellow }
}
Write-Host "Building the $type APK for '$($mob.name)' (phase $($m.phase)); the app will call the API at $ApiUrl"

# environment values for the build
if ($mob.env) { foreach ($p in $mob.env.PSObject.Properties) { [Environment]::SetEnvironmentVariable($p.Name, ([string]$p.Value).Replace('{API_URL}', $ApiUrl), 'Process') } }

$cmds = if ($Release) { @($mob.build_release) } else { @($mob.build_debug) }
foreach ($c in $cmds) {
    $c = ([string]$c).Replace('{API_URL}', $ApiUrl)
    Say "  build : $c"
    if ($DryRun) { continue }
    if (-not $onWindows) { Fail 'build-apk.cmd runs on Windows. Use -DryRun elsewhere.' }
    Push-Location -LiteralPath $mobDir
    try { & cmd.exe /c $c; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { Fail "'$c' failed with exit code $rc. Fix that, then run build-apk.cmd again." }
}

$outPattern = if ($Release) { $mob.output_release } else { $mob.output_debug }
$destDir = Join-Path $root 'mobile-publish\android'
$name = $mob.name; if (-not $name) { $name = 'app' }
$destName = "$name-$($m.phase)-$type.apk"
$dest = Join-Path $destDir $destName
if ($DryRun) {
    Say "  then copy $outPattern (inside $($mob.dir)) to mobile-publish\android\$destName"
    exit 0
}
$src = Get-ChildItem -Path (Join-Path $mobDir $outPattern) -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $src) { Fail "The build finished but no APK was found at '$outPattern' inside $($mob.dir). Check mobile.output_$type in run.json." }
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -LiteralPath $src.FullName -Destination $dest -Force

$commit = $null; try { $commit = (& git -C $root rev-parse --short HEAD 2>$null) } catch { }
$info = [ordered]@{ file = $destName; type = $type; phase = $m.phase; built = (Get-Date).ToString('yyyy-MM-dd HH:mm'); api_url = $ApiUrl; commit = $commit; size_mb = [math]::Round($src.Length / 1MB, 1) }
ConvertTo-Json -InputObject $info | Set-Content -LiteralPath (Join-Path $destDir 'last-build.json') -Encoding UTF8
$readme = Join-Path (Split-Path -Parent $destDir) 'README.txt'
if (-not (Test-Path -LiteralPath $readme)) {
    @(
        'Android builds made by build-apk.cmd. Nothing here is uploaded anywhere and this folder is not committed to git.',
        '',
        'Install on a phone: copy the .apk to the phone and open it (allow installs from this source), or connect it with USB debugging and run:',
        '  adb install -r android\<file>.apk',
        'The phone and this PC must be on the same Wi-Fi, start.cmd must be running, and the Windows firewall must allow the API port.',
        'A debug build is for testing only. A Play Store release is built and uploaded by you with your own signing key.'
    ) | Set-Content -LiteralPath $readme -Encoding UTF8
}
Write-Host ''
Write-Host "Done: $dest ($($info.size_mb) MB)" -ForegroundColor Green
Write-Host ('Install: copy it to the phone, or:  adb install -r "' + $dest + '"')
exit 0
