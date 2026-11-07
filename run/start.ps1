<#
.SYNOPSIS
  Starts every app of this project for the current phase and opens the web apps in a browser.

.DESCRIPTION
  Kit file owned by the dev-pipeline toolkit (written and updated by /run-kit; do not edit, edit run\run.json instead).
  Reads run\run.json: services (databases and similar, checked, optionally started), then apps in dependency order, each in its own
  window so the logs stay readable. Waits for each health URL before the next step and before opening a browser.
  Never reads .env files and never starts anything in the cloud.

  Usage:  start.cmd [-DryRun] [-NoBrowser] [-Only api,web] [-Reinstall]
    -DryRun     print what would happen; start, install and copy nothing
    -NoBrowser  do not open browser tabs
    -Only       start only these app ids (and services they need are still checked)
    -Reinstall  run the install and prepare commands again even if they ran before
#>
param(
    [switch]$DryRun,
    [switch]$NoBrowser,
    [string[]]$Only,
    [switch]$Reinstall
)
$ErrorActionPreference = 'Stop'
$kit = $PSScriptRoot
$root = Split-Path -Parent $kit
$onWindows = ($env:OS -eq 'Windows_NT')

function Fail([string]$Message) { Write-Host "ERROR: $Message" -ForegroundColor Red; exit 1 }
function Say([string]$Message) { if ($DryRun) { Write-Host "[dry-run] $Message" } else { Write-Host $Message } }

$manifestPath = Join-Path $kit 'run.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { Fail 'run\run.json was not found. Ask Claude to run /run-kit.' }
try { $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json }
catch { Fail "run\run.json is not valid JSON: $($_.Exception.Message)" }

function Test-Port([string]$HostName, [int]$Port, [int]$TimeoutMs = 400) {
    $c = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $c.BeginConnect($HostName, $Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false) -and $c.Connected) { return $true }
        return $false
    } catch { return $false } finally { $c.Close() }
}
function Test-Url([string]$Url) {
    try { $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3; return $true }
    catch {
        $resp = $_.Exception.Response
        if ($resp) { try { return ([int]$resp.StatusCode) -lt 500 } catch { return $false } }
        return $false
    }
}
function Test-Up($Item) {
    if ($Item.health) { return (Test-Url $Item.health) }
    if ($Item.port) { return (Test-Port 'localhost' ([int]$Item.port)) }
    return $false
}
function Get-Browsers {
    $found = @{}
    if (-not $onWindows) { return $found }
    $pf = $env:ProgramFiles; $pf86 = ${env:ProgramFiles(x86)}; $la = $env:LOCALAPPDATA
    $map = [ordered]@{
        chrome  = @("$pf\Google\Chrome\Application\chrome.exe", "$pf86\Google\Chrome\Application\chrome.exe", "$la\Google\Chrome\Application\chrome.exe")
        edge    = @("$pf86\Microsoft\Edge\Application\msedge.exe", "$pf\Microsoft\Edge\Application\msedge.exe")
        firefox = @("$pf\Mozilla Firefox\firefox.exe", "$pf86\Mozilla Firefox\firefox.exe")
    }
    foreach ($k in $map.Keys) { foreach ($p in $map[$k]) { if ($p -and (Test-Path -LiteralPath $p)) { $found[$k] = $p; break } } }
    $reg = @{ chrome = 'chrome.exe'; edge = 'msedge.exe'; firefox = 'firefox.exe' }
    foreach ($k in $reg.Keys) {
        if (-not $found.ContainsKey($k)) {
            foreach ($hive in 'HKLM', 'HKCU') {
                $key = "${hive}:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$($reg[$k])"
                if (Test-Path -LiteralPath $key) { $p = (Get-ItemProperty -LiteralPath $key).'(default)'; if ($p -and (Test-Path -LiteralPath $p)) { $found[$k] = $p; break } }
            }
        }
    }
    return $found
}
function Get-LanAddress {
    try {
        foreach ($nic in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
            if ($nic.OperationalStatus -ne 'Up' -or $nic.NetworkInterfaceType -eq 'Loopback') { continue }
            $props = $nic.GetIPProperties()
            if (-not ($props.GatewayAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and $_.Address.ToString() -ne '0.0.0.0' })) { continue }
            foreach ($ua in $props.UnicastAddresses) { if ($ua.Address.AddressFamily -eq 'InterNetwork') { return $ua.Address.ToString() } }
        }
    } catch { }
    return $null
}
function Invoke-Step([string]$Dir, [string]$Command, [string]$Label) {
    Say "  $Label : $Command"
    if ($DryRun) { return }
    if (-not $onWindows) { Fail 'start.cmd runs on Windows. Use -DryRun elsewhere.' }
    Push-Location -LiteralPath $Dir
    try { & cmd.exe /c $Command; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { Fail "'$Command' failed with exit code $rc in $Dir. Fix that, then run start.cmd again." }
}

$services = @($m.services | Where-Object { $_ })
$apps = @($m.apps | Where-Object { $_ })
if ($Only) { $apps = @($apps | Where-Object { $Only -contains $_.id }) }
if ($apps.Count -eq 0 -and $services.Count -eq 0) { Fail 'Nothing to start: run\run.json lists no apps or services yet.' }
$svcIds = @($services | ForEach-Object { $_.id })

# dependency order
$ordered = @(); $done = @{}; $left = @($apps); $guard = 0
while ($left.Count -gt 0 -and $guard -lt 50) {
    $guard++; $next = @()
    foreach ($a in $left) {
        $ready = $true
        foreach ($d in @($a.depends_on | Where-Object { $_ })) {
            if (-not $done.ContainsKey($d) -and ($svcIds -notcontains $d)) {
                if (@($apps | Where-Object { $_.id -eq $d }).Count -gt 0) { $ready = $false }
            }
        }
        if ($ready) { $done[$a.id] = $true; $ordered += $a } else { $next += $a }
    }
    if ($next.Count -eq $left.Count) { Fail ('depends_on cycle among: ' + (($next | ForEach-Object { $_.id }) -join ', ')) }
    $left = $next
}

Write-Host ''
Write-Host "$($m.project) - phase $($m.phase)" -ForegroundColor Cyan
Write-Host ('=' * 60)

# 1. services (databases and similar)
foreach ($s in $services) {
    $port = [int]$s.port
    if (Test-Port 'localhost' $port) { Write-Host "OK      $($s.name) is listening on port $port"; continue }
    if ($s.start) {
        Say "$($s.name) is not running on port $port; starting it: $($s.start)"
        if (-not $DryRun) {
            Push-Location -LiteralPath $root
            try { & cmd.exe /c $s.start } finally { Pop-Location }
            $ok = $false
            for ($i = 0; $i -lt 40; $i++) { if (Test-Port 'localhost' $port 800) { $ok = $true; break }; Start-Sleep -Seconds 2 }
            if (-not $ok) { Fail "$($s.name) did not open port $port. $($s.hint)" }
            Write-Host "OK      $($s.name) started on port $port"
        }
    } else {
        if ($DryRun) { Say "$($s.name) is not running on port $port. $($s.hint)" } else { Fail "$($s.name) is not running on port $port. $($s.hint)" }
    }
}

# 2. apps
$marker = Join-Path $kit '.first-run-done'
$prepared = @(); if (Test-Path -LiteralPath $marker) { $prepared = @(Get-Content -LiteralPath $marker | Where-Object { $_ }) }
$pidFile = Join-Path $kit 'pids.json'
$started = New-Object System.Collections.Generic.List[object]
$summary = New-Object System.Collections.Generic.List[object]
$urls = New-Object System.Collections.Generic.List[string]

foreach ($a in $ordered) {
    $dir = Join-Path $root $a.dir
    if (-not (Test-Path -LiteralPath $dir)) { Fail "Folder '$($a.dir)' for '$($a.name)' does not exist. Ask Claude to run /run-kit again." }
    Write-Host ''
    Write-Host "$($a.name)  ($($a.kind), folder $($a.dir))" -ForegroundColor Yellow

    if (Test-Up $a) {
        Write-Host "  already running; leaving it as it is"
        $summary.Add([pscustomobject]@{ Name = $a.name; Url = $(if ($a.open_url) { $a.open_url } elseif ($a.port) { "http://localhost:$($a.port)/" } else { '' }); State = 'already running' })
        if ($a.open_browser -and $a.open_url) { $urls.Add($a.open_url) }
        continue
    }

    $envExample = Join-Path $dir '.env.example'; $envFile = Join-Path $dir '.env'
    if ((Test-Path -LiteralPath $envExample) -and -not (Test-Path -LiteralPath $envFile)) {
        Say "  creating $($a.dir)\.env from .env.example (local values only; the file is not read or printed)"
        if (-not $DryRun) { Copy-Item -LiteralPath $envExample -Destination $envFile }
    }

    if ($Reinstall -or ($prepared -notcontains $a.id)) {
        foreach ($c in @($a.install | Where-Object { $_ })) { Invoke-Step $dir $c 'install' }
        foreach ($c in @($a.prepare | Where-Object { $_ })) { Invoke-Step $dir $c 'prepare' }
        if (-not $DryRun -and ($prepared -notcontains $a.id)) { Add-Content -LiteralPath $marker -Value $a.id; $prepared += $a.id }
    }

    $envPrefix = ''
    if ($a.env) { foreach ($p in $a.env.PSObject.Properties) { $envPrefix += "set `"$($p.Name)=$($p.Value)`" && " } }
    $title = "$($m.project) - $($a.name)"
    $line = "title $title && cd /d `"$dir`" && $envPrefix$($a.start)"
    Say "  starting in its own window: $($a.start)"
    if (-not $DryRun) {
        if (-not $onWindows) { Fail 'start.cmd runs on Windows. Use -DryRun elsewhere.' }
        $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $line -PassThru
        $started.Add([pscustomobject]@{ id = $a.id; name = $a.name; pid = $proc.Id; port = $a.port })
        # keep the pid list current even if a later app fails
        ConvertTo-Json -InputObject @($started) | Set-Content -LiteralPath $pidFile -Encoding UTF8
    }

    $state = 'started'
    if (($a.health -or $a.port) -and -not $DryRun) {
        $timeout = 120; if ($a.health_timeout_sec) { $timeout = [int]$a.health_timeout_sec }
        Write-Host "  waiting for it to answer (up to $timeout s)..." -NoNewline
        $up = $false; $t0 = Get-Date
        while (((Get-Date) - $t0).TotalSeconds -lt $timeout) { if (Test-Up $a) { $up = $true; break }; Start-Sleep -Seconds 2; Write-Host '.' -NoNewline }
        Write-Host ''
        if ($up) { Write-Host '  OK' -ForegroundColor Green }
        else { Write-Host "  not answering yet. Look at the window titled '$title' for the error. Continuing." -ForegroundColor Red; $state = 'NOT ANSWERING' }
    }
    $u = ''; if ($a.open_url) { $u = $a.open_url } elseif ($a.port) { $u = "http://localhost:$($a.port)/" }
    $summary.Add([pscustomobject]@{ Name = $a.name; Url = $u; State = $state })
    if ($a.open_browser -and $u -and $state -ne 'NOT ANSWERING') { $urls.Add($u) }
}

# 3. browser
if ($urls.Count -gt 0 -and -not $NoBrowser) {
    $order = @('chrome', 'edge', 'firefox', 'default'); if ($m.browser_order) { $order = @($m.browser_order) }
    $browsers = Get-Browsers
    $choice = 'default'
    foreach ($b in $order) { if ($b -eq 'default' -or $browsers.ContainsKey($b)) { $choice = $b; break } }
    Write-Host ''
    Say "opening $($urls.Count) address(es) in: $choice"
    if (-not $DryRun) {
        if ($choice -eq 'default') { foreach ($u in $urls) { Start-Process -FilePath $u } }
        else { Start-Process -FilePath $browsers[$choice] -ArgumentList @($urls) }
    }
}

# 4. summary
Write-Host ''
Write-Host ('=' * 60)
foreach ($r in $summary) { Write-Host ('{0,-24} {1,-34} {2}' -f $r.Name, $r.Url, $r.State) }
$lan = Get-LanAddress
if ($m.mobile -and $lan) {
    $apiApp = @($apps | Where-Object { $_.id -eq $m.mobile.api_app }) | Select-Object -First 1
    if ($apiApp -and $apiApp.port) { Write-Host ''; Write-Host "For a phone on the same Wi-Fi the API is at http://${lan}:$($apiApp.port) (allow it in the Windows firewall if the phone cannot connect). Build the Android app with build-apk.cmd." }
}
Write-Host ''
Write-Host 'Stop everything this started with stop.cmd.'
exit 0
