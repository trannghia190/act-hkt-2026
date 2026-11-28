#Requires -Version 5.1
<#
.SYNOPSIS
  Trien khai ACT-HKT 2026 tren Windows 10/11 hoac Windows Server (WSL2 + Docker).

.DESCRIPTION
  He thong dung 100% Linux container (PostgreSQL+pgvector, Redis, Spring Boot,
  Python AI Face, Nginx). Tren Windows (may ca nhan hay server deu duoc), script tu:
    1. Bat WSL2 + VirtualMachinePlatform (nhac reboot neu can)
    2. Cai WSL (MSI tu GitHub) neu may chua co
    3. Cai/Import Ubuntu 22.04 va bat systemd de Docker chay nhu service
    4. Goi deploy-server.sh ben trong WSL: cai Docker Engine, sinh .env,
       build & chay toan bo stack (dung chung logic voi ban Linux)
    5. Mo Windows Firewall + portproxy de truy cap tu may khac
    6. Tao Scheduled Task tu lam moi portproxy sau moi lan reboot
       (IP cua WSL2 thay doi moi lan khoi dong)

.PARAMETER Action
  up (mac dinh) | update | restart | stop | logs | status | down | destroy | tunnel-url | tunnel-off

.PARAMETER Domain
  Bat HTTPS tu dong (Caddy + Let's Encrypt). DNS phai tro ve server truoc.

.PARAMETER Email
  Email dang ky Let's Encrypt (di kem -Domain).

.PARAMETER Port
  Cong HTTP khi KHONG dung domain (mac dinh 80).

.PARAMETER Tunnel
  Bat Cloudflare Quick Tunnel: URL public https://<random>.trycloudflare.com,
  khong can domain/tai khoan. URL doi moi lan cloudflared restart.

.PARAMETER NoTunnel
  Tat Cloudflare tunnel da bat truoc do.

.PARAMETER WslDistro
  Ten distro WSL danh rieng cho ung dung (mac dinh ACT-HKT-Ubuntu).
  Dat ten rieng de khong dung vao Ubuntu san co tren may ca nhan.

.PARAMETER AppDir
  Thu muc ma nguon ben trong WSL (mac dinh /opt/act-hkt).

.EXAMPLE
  .\deploy-server.ps1

.EXAMPLE
  .\deploy-server.ps1 -Domain hr.example.com -Email admin@example.com

.EXAMPLE
  .\deploy-server.ps1 update

.EXAMPLE
  .\deploy-server.ps1 status
#>
[CmdletBinding()]
param(
  [ValidateSet('up','install','update','restart','stop','logs','status','down','destroy','tunnel-url','tunnel-off')]
  [string]$Action = 'up',

  [string]$Domain = '',
  [string]$Email = '',
  [int]$Port = 80,

  [string]$WslDistro = 'ACT-HKT-Ubuntu',
  [string]$WslRoot = "$env:SystemDrive\WSL",
  [string]$AppDir = '/opt/act-hkt',
  [string]$RepoUrl = 'https://github.com/trannghia190/act-hkt-2026.git',
  [string]$Branch = 'main',
  [string]$WslMsiUrl = '',

  [switch]$Tunnel,
  [switch]$NoTunnel,

  [switch]$SkipPortProxy,
  [switch]$SkipFirewall,
  [switch]$ForceReboot,
  [switch]$Yes
)

# PS 5.1 coi stderr cua lenh native la loi terminating. Script kiem tra
# $LASTEXITCODE tuong minh, nen de Continue va tu Fail khi that su loi.
$ErrorActionPreference = 'Continue'
$script:WslExe = $null
$script:NeedReboot = $false
# Chỉ truyền --port khi người dùng chỉ định rõ; nếu không .env là nguồn sự thật
# (tránh mỗi lần chạy lại tự đổi cổng đã chọn trước đó về 80).
$script:PortExplicit = $PSBoundParameters.ContainsKey('Port')
$script:RootfsUrl = 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz'
$script:TaskName = 'ACT-HKT WSL Port Proxy'
$script:RefreshDir = Join-Path $env:ProgramData 'ACT-HKT'
$script:RefreshScript = Join-Path $script:RefreshDir 'refresh-wsl-proxy.ps1'

# ------------------------------ Log helpers -----------------------------------
function Write-Step([string]$m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn2([string]$m){ Write-Host "  [!] $m" -ForegroundColor Yellow }
function Fail([string]$m)       { Write-Host "[X] $m" -ForegroundColor Red; exit 1 }

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Fail "Phai chay PowerShell bang quyen Administrator (chuot phai > Run as administrator)."
  }
}

function Initialize-Tls {
  try {
    [Net.ServicePointManager]::SecurityProtocol = `
      [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  } catch { }
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

# ------------------------------ Tai file --------------------------------------
function Download-File([string]$Url, [string]$OutFile) {
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & curl.exe -sS -fL --retry 3 --connect-timeout 20 -o $OutFile $Url
    if ($LASTEXITCODE -ne 0) { Fail "Tai that bai: $Url" }
  } else {
    try {
      Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -ErrorAction Stop
    } catch {
      Fail "Tai that bai: $Url ($($_.Exception.Message))"
    }
  }
}

# ------------------------------ Buoc 1: bat feature ---------------------------
function Enable-WslFeatures {
  Write-Step "Bat Windows Subsystem for Linux + VirtualMachinePlatform"
  $features = @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')
  foreach ($f in $features) {
    $out = & dism.exe /online /enable-feature /featurename:$f /all /norestart 2>&1 | Out-String
    $code = $LASTEXITCODE
    if ($code -eq 3010) {
      $script:NeedReboot = $true
      Write-Ok "$f (can khoi dong lai)"
    } elseif ($code -ne 0) {
      Fail "Khong bat duoc $f (dism=$code).`n$out"
    } else {
      Write-Ok $f
    }
  }
}

function Confirm-Reboot {
  if (-not $script:NeedReboot) { return }
  Write-Warn2 "Windows can khoi dong lai de hoan tat bat WSL2."
  if ($ForceReboot) {
    Write-Step "Khoi dong lai may..."
    Restart-Computer -Force
    exit 0
  }
  Write-Host "Hay reboot roi chay lai:  .\deploy-server.ps1 $Action" -ForegroundColor Yellow
  Write-Host "Hoac them -ForceReboot de script tu khoi dong lai." -ForegroundColor Yellow
  exit 3010
}

# ------------------------------ Buoc 2: WSL -----------------------------------
function Resolve-WslExe {
  Refresh-Path
  $cmd = Get-Command wsl.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\WSL\wsl.exe", "$env:SystemRoot\System32\wsl.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Install-WslPackage {
  $url = $WslMsiUrl
  if (-not $url) {
    Write-Step "Tim ban WSL moi nhat tu GitHub..."
    try {
      $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/microsoft/WSL/releases/latest' `
        -Headers @{ 'User-Agent' = 'act-hkt-deploy' } -ErrorAction Stop
    } catch {
      Fail "Khong goi duoc GitHub API de tim WSL MSI: $($_.Exception.Message). Truyen -WslMsiUrl thu cong."
    }
    $asset = $rel.assets | Where-Object { $_.name -like 'wsl.*.x64.msi' } | Select-Object -First 1
    if (-not $asset) { Fail "Khong tim thay WSL MSI x64. Truyen -WslMsiUrl thu cong." }
    $url = $asset.browser_download_url
  }
  $msi = Join-Path $env:TEMP 'act-hkt-wsl.msi'
  Write-Step "Tai WSL: $url"
  Download-File $url $msi
  try {
    $p = Start-Process -FilePath msiexec.exe -ArgumentList @('/i', "`"$msi`"", '/qn', '/norestart') -Wait -PassThru -ErrorAction Stop
  } catch {
    Fail "Khong chay duoc msiexec: $($_.Exception.Message)"
  }
  if ($p.ExitCode -eq 3010) { $script:NeedReboot = $true }
  elseif ($p.ExitCode -ne 0) { Fail "Cai WSL MSI loi (msiexec=$($p.ExitCode))." }
  Refresh-Path
}

function Invoke-WslRaw([string[]]$WslArgs) {
  # Chay wsl.exe va gom ca stderr, khong de NativeCommandError lam dung script.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = & $script:WslExe @WslArgs 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Output = (($lines | Out-String).Trim()) }
  } finally {
    $ErrorActionPreference = $prev
  }
}

function Wait-WslReady([int]$TimeoutSec = 90) {
  # Sau khi cai/nang WSL, no co the in "WSL is finishing an upgrade..." va
  # chua nhan lenh. Cho den khi --status chay duoc va het thong bao do.
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    $r = Invoke-WslRaw @('--status')
    if ($r.Code -eq 0 -and $r.Output -notmatch 'finishing an upgrade') { return $true }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Ensure-Wsl {
  $exe = Resolve-WslExe
  if (-not $exe) {
    Install-WslPackage
    $exe = Resolve-WslExe
    if (-not $exe) { Fail "Da cai WSL nhung khong tim thay wsl.exe." }
  }
  $script:WslExe = $exe
  Write-Ok "wsl.exe: $exe"

  Write-Step "Cap nhat WSL kernel"
  $r = Invoke-WslRaw @('--update')
  if ($r.Code -ne 0) {
    Write-Warn2 "wsl --update tra ve ma $($r.Code). Tiep tuc voi ban WSL hien co."
  }

  if (-not (Wait-WslReady 90)) {
    Write-Warn2 "WSL chua san sang sau 90s (co the dang hoan tat nang cap hoac can reboot)."
  }

  $r = Invoke-WslRaw @('--set-default-version', '2')
  if ($r.Code -ne 0) {
    Write-Warn2 "Khong dat WSL2 lam mac dinh. Kiem tra ao hoa (VT-x/AMD-V) da bat trong BIOS/VM chua."
    if ($r.Output) { Write-Warn2 $r.Output }
  } else {
    Write-Ok "WSL2 la phien ban mac dinh"
  }
}

function Get-WslDistros {
  $r = Invoke-WslRaw @('-l', '-q')
  $text = $r.Output -replace "`0", ''
  return @($text -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Invoke-Wsl([string]$Command) {
  $wslArgs = @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc', $Command)
  & $script:WslExe @wslArgs
  if ($LASTEXITCODE -ne 0) { Fail "Lenh trong WSL that bai (exit $LASTEXITCODE): $Command" }
}

function Invoke-WslCapture([string]$Command) {
  $wslArgs = @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc', $Command)
  $out = & $script:WslExe @wslArgs 2>$null
  $code = $LASTEXITCODE
  $text = (($out | Out-String) -replace "`0", '').Trim()
  if ($code -ne 0) { return $null }
  return $text
}

function Ensure-Distro {
  $distros = Get-WslDistros
  if ($distros -contains $WslDistro) {
    Write-Ok "Distro da co: $WslDistro"
    return
  }

  # Import rootfs truc tiep: on dinh tren Windows Server (khong phu thuoc Store /
  # wsl --install, von co the treo hoac khong ton tai tren Server).
  Write-Step "Import distro $WslDistro tu rootfs Ubuntu 22.04"
  New-Item -ItemType Directory -Force -Path $WslRoot | Out-Null
  $root = Join-Path $WslRoot $WslDistro
  if (Test-Path $root) {
    $count = @(Get-ChildItem $root -Force -ErrorAction SilentlyContinue).Count
    if ($count -gt 0) { Fail "Thu muc $root da co du lieu. Di chuyen/xoa roi chay lai." }
  }
  $tar = Join-Path $WslRoot 'ubuntu-22.04.rootfs.tar.gz'
  if (-not (Test-Path $tar)) {
    Write-Step "Tai Ubuntu 22.04 rootfs (~300MB)..."
    Download-File $script:RootfsUrl $tar
  }
  $r = Invoke-WslRaw @('--import', $WslDistro, $root, $tar, '--version', '2')
  if ($r.Code -ne 0 -and $r.Output -match 'finishing an upgrade') {
    Wait-WslReady 90 | Out-Null
    $r = Invoke-WslRaw @('--import', $WslDistro, $root, $tar, '--version', '2')
  }
  if ($r.Code -ne 0) {
    Fail "Import distro that bai (exit $($r.Code)).`n$($r.Output)`nKiem tra ao hoa VT-x/AMD-V da bat (va nested virtualization neu la VM) roi chay lai."
  }
  Write-Ok "Da import $WslDistro"
}

function Initialize-Distro {
  # Idempotent: chi cau hinh + khoi dong lai khi chua bat systemd, de lenh
  # update khong kill toan bo container dang chay.
  $confOk = Invoke-WslCapture "grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null && echo ok"
  if ($confOk -eq 'ok') {
    Write-Ok "systemd da bat trong $WslDistro"
    return
  }
  Write-Step "Bat systemd trong $WslDistro (de Docker chay nhu service)"
  Invoke-Wsl "printf '[boot]\nsystemd=true\n[user]\ndefault=root\n' > /etc/wsl.conf"
  $null = Invoke-WslRaw @('--terminate', $WslDistro)
  Start-Sleep -Seconds 2
  # Cho systemd boot xong (running/degraded) truoc khi cai Docker; timeout 90s.
  Invoke-Wsl "timeout 90 systemctl is-system-running --wait >/dev/null 2>&1 || true; true"
  $state = Invoke-WslCapture "systemctl is-system-running 2>/dev/null || true"
  if ($state) { Write-Ok "systemd: $state" } else { Write-Warn2 "Chua xac nhan duoc systemd." }
}

# ------------------------------ Buoc 3: app -----------------------------------
function Ensure-App {
  Write-Step "Cai cong cu Linux trong WSL (curl, git, openssl)"
  Invoke-Wsl "export DEBIAN_FRONTEND=noninteractive; apt-get update -y >/dev/null && apt-get install -y curl git ca-certificates openssl >/dev/null"
  Write-Ok "Da cai cong cu"

  $dir = $AppDir.Replace("'", "'\''")
  $cmd = "set -e; if [ ! -d '$dir/.git' ]; then mkdir -p `"`$(dirname '$dir')`" && git clone --branch '$Branch' --depth 1 '$RepoUrl' '$dir'; else cd '$dir' && git fetch --depth 1 origin '$Branch' && git checkout -q '$Branch' && git reset -q --hard origin/$Branch; fi"
  Write-Step "Dong bo ma nguon ($Branch) -> $AppDir"
  Invoke-Wsl $cmd
  Write-Ok "Ma nguon san sang"
}

function Invoke-Deploy([string[]]$DeployArgs) {
  $quoted = ''
  if ($DeployArgs -and $DeployArgs.Count -gt 0) {
    $quoted = ($DeployArgs | ForEach-Object { "'" + ($_ -replace "'", "'\''") + "'" }) -join ' '
  }
  $dir = $AppDir.Replace("'", "'\''")
  # SKIP_SWAP=1: WSL2 tu quan ly swap; khong swapon ben trong WSL.
  $cmd = "cd '$dir' && chmod +x deploy-server.sh && SKIP_SWAP=1 ./deploy-server.sh $quoted"
  Invoke-Wsl $cmd
}

function Read-DeployEnv {
  $envFile = "$AppDir/hkt/deploy/docker/.env"
  $domain = Invoke-WslCapture "grep '^SITE_DOMAIN=' '$envFile' 2>/dev/null | cut -d= -f2-"
  $http = Invoke-WslCapture "grep '^HTTP_PORT=' '$envFile' 2>/dev/null | cut -d= -f2-"
  $tls = Invoke-WslCapture "grep '^TLS_ENABLED=' '$envFile' 2>/dev/null | cut -d= -f2-"
  $tunnel = Invoke-WslCapture "grep '^ENABLE_TUNNEL=' '$envFile' 2>/dev/null | cut -d= -f2-"
  return [pscustomobject]@{ Domain = "$domain"; HttpPort = "$http"; Tls = "$tls"; Tunnel = "$tunnel" }
}

# ------------------------------ Buoc 4: mang Windows --------------------------
function Get-WslIp {
  $text = Invoke-WslCapture "hostname -I"
  if (-not $text) { return $null }
  return ($text -split '\s+')[0]
}

function Test-PortListening([int]$P) {
  $busy = Get-NetTCPConnection -State Listen -LocalPort $P -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '::' }
  return [bool]$busy
}

function Set-PortProxy([int[]]$Ports) {
  $svc = Get-Service iphlpsvc -ErrorAction SilentlyContinue
  if ($svc -and $svc.Status -ne 'Running') { Start-Service iphlpsvc -ErrorAction SilentlyContinue }
  $ip = Get-WslIp
  if (-not $ip) { Fail "Khong lay duoc IP cua WSL - container co dang chay khong?" }
  & netsh.exe interface ipv4 set global forwarding=enabled | Out-Null

  foreach ($p in $Ports) {
    # Xoa proxy cu truoc de khong tu bao trung cong voi chinh no o lan chay lai.
    & netsh.exe interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 2>$null | Out-Null
    Start-Sleep -Milliseconds 200
    if (Test-PortListening $p) {
      Fail "Cong $p dang bi mot dich vu Windows khac chiem (vd IIS). Dung no hoac doi -Port."
    }
    & netsh.exe interface portproxy add v4tov4 listenport=$p listenaddress=0.0.0.0 connectport=$p connectaddress=$ip
    if ($LASTEXITCODE -ne 0) { Fail "Tao portproxy cong $p that bai." }
  }
  Write-Ok "Portproxy: $($Ports -join ', ') -> WSL $ip"
}

function Set-Firewall([int[]]$Ports) {
  foreach ($p in $Ports) {
    $name = "ACT-HKT TCP $p"
    Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue |
      Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $p -Profile Any | Out-Null
  }
  Write-Ok "Firewall Windows: mo TCP $($Ports -join ', ')"
}

function Register-ProxyTask {
  $portsLiteral = ($script:PortList -join ',')
  $template = @'
$ErrorActionPreference = 'SilentlyContinue'
Start-Sleep -Seconds 15
$distro = '__DISTRO__'
$ports = @(__PORTS__)
# Khoi dong WSL/distro (keo theo systemd + docker)
& wsl.exe -d $distro -u root -- bash -lc 'true' | Out-Null
$ip = $null
for ($i = 0; $i -lt 60; $i++) {
  $out = & wsl.exe -d $distro -u root -- bash -lc 'hostname -I' 2>$null
  $text = (($out   | Out-String) -replace "`0", '').Trim()
  if ($text) {
    $candidate = ($text -split '\s+')[0]
    if ($candidate) { $ip = $candidate; break }
  }
  Start-Sleep -Seconds 5
}
if (-not $ip) { exit 1 }
Start-Service iphlpsvc
& netsh.exe interface ipv4 set global forwarding=enabled | Out-Null
foreach ($p in $ports) {
  & netsh.exe interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 | Out-Null
  & netsh.exe interface portproxy add v4tov4 listenport=$p listenaddress=0.0.0.0 connectport=$p connectaddress=$ip | Out-Null
}
'@
  $content = $template.Replace('__DISTRO__', $WslDistro).Replace('__PORTS__', $portsLiteral)

  if (-not (Test-Path $script:RefreshDir)) { New-Item -ItemType Directory -Force -Path $script:RefreshDir -ErrorAction Stop | Out-Null }
  try {
    Set-Content -Path $script:RefreshScript -Value $content -Encoding UTF8 -ErrorAction Stop
  } catch {
    Write-Warn2 "Khong ghi duoc refresh script: $($_.Exception.Message)"
  }

  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script:RefreshScript`""
  # WSL dang ky distro theo tung user (HKCU), nen task phai chay duoi user da cai
  # (S4U = khong can luu mat khau), khong dung SYSTEM.
  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $triggerBoot = New-ScheduledTaskTrigger -AtStartup
  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType S4U -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  try {
    Register-ScheduledTask -TaskName $script:TaskName -Action $action -Trigger @($triggerBoot, $triggerLogon) `
      -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
    Write-Ok "Scheduled Task '$($script:TaskName)' se tu lam moi portproxy sau reboot (user $currentUser)."
  } catch {
    Write-Warn2 "Khong tao duoc Scheduled Task: $($_.Exception.Message)"
    Write-Warn2 "Sau reboot hay chay lai: .\deploy-server.ps1 restart"
  }
}

function Remove-ProxyArtifacts {
  Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue |
    Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue
  $ports = @(@(80, 443) + $script:PortList | Select-Object -Unique)
  foreach ($p in $ports) {
    & netsh.exe interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 2>$null | Out-Null
  }
  Write-Ok "Da xoa portproxy & scheduled task."
}

# ------------------------------ Dieu phoi -------------------------------------
function Get-LanIp {
  return (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notlike '*WSL*' -and $_.InterfaceAlias -notlike '*vEthernet*' -and
      $_.InterfaceAlias -notlike '*Loopback*'
    } | Select-Object -First 1 -ExpandProperty IPAddress)
}

function Get-PublicIp {
  try { return (Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 5).ToString().Trim() } catch { return $null }
}

function Format-AppUrl([string]$Ip, [string]$P) {
  if ("$P" -eq '80') { return "http://$Ip" }
  return "http://$Ip`:$P"
}

function Get-PublishedUrl {
  $envInfo = Read-DeployEnv
  if ($envInfo.Domain) { return "https://$($envInfo.Domain)" }
  $p = $envInfo.HttpPort
  if (-not $p) { $p = "$Port" }
  $ip = Get-LanIp
  if (-not $ip) { $ip = Get-PublicIp }
  if (-not $ip) { $ip = '<server-ip>' }
  return (Format-AppUrl $ip $p)
}

function Show-Summary {
  $url = Get-PublishedUrl
  Write-Host ""
  Write-Host "========================================================================================" -ForegroundColor Green
  Write-Host "  ACT-HKT 2026 da chay tren Windows (WSL2)" -ForegroundColor Green
  Write-Host "========================================================================================"
  Write-Host "  Giao dien:      " -NoNewline; Write-Host $url -ForegroundColor Cyan
  $envInfo = Read-DeployEnv
  if (-not $envInfo.Domain) {
    $lan = Get-LanIp; $pub = Get-PublicIp
    $p = $envInfo.HttpPort; if (-not $p) { $p = "$Port" }
    if ($pub -and $lan -and $pub -ne $lan) {
      Write-Host ("  Tu Internet:    " + (Format-AppUrl $pub $p) + "  (can mo port $p tren router/cloud firewall)") -ForegroundColor Yellow
    }
    Write-Host "  May khac trong LAN dung dia chi tren; may nay dung http://localhost." -ForegroundColor DarkGray
  }
  if ($envInfo.Tunnel -eq '1') {
    $tun = Invoke-WslCapture "cd '$AppDir' && ./deploy-server.sh tunnel-url 2>/dev/null || true"
    if ($tun) {
      Write-Host "  Public (Cloudflare): $tun" -ForegroundColor Cyan
      Write-Host "     URL doi moi lan cloudflared restart. Tat: .\deploy-server.ps1 tunnel-off" -ForegroundColor Yellow
    } else {
      Write-Host "  Public (Cloudflare): dang bat nhung chua co URL - xem .\deploy-server.ps1 logs" -ForegroundColor Yellow
    }
  }
  Write-Host "  Ma nguon:       $AppDir (trong WSL: $WslDistro)"
  Write-Host "  Cau hinh:       $AppDir/hkt/deploy/docker/.env  (SAO LUU file nay!)"
  Write-Host "---------------------------------------------------------------------------------------"
  Write-Host "  TAI KHOAN DEMO: Admin/Admin - 01HR/123456 - 05ACT/123456 - 136ACT/123456 - 2026NEW/123456" -ForegroundColor Yellow
  Write-Host "---------------------------------------------------------------------------------------"
  Write-Host "  Quan tri:  .\deploy-server.ps1 status | logs | update | restart | stop | destroy"
  Write-Host "             .\deploy-server.ps1 tunnel-url | tunnel-off"
  Write-Host "========================================================================================"
  $envInfo = Read-DeployEnv
  if ($envInfo.Domain) {
    Write-Host "  HTTPS do Caddy trong WSL tu cap. Neu Caddy khong cap duoc chung chi, kiem tra DNS" -ForegroundColor Yellow
    Write-Host "  ben trong WSL:  wsl -d $WslDistro -u root -- getent hosts $($envInfo.Domain)" -ForegroundColor Yellow
    Write-Host "  (neu khong phan giai duoc, chinh /etc/resolv.conf trong WSL hoac DNS cua Windows.)" -ForegroundColor Yellow
  }
  Write-Host ""
}

function Invoke-FullDeploy([bool]$IsUpdate) {
  Enable-WslFeatures
  Confirm-Reboot
  Ensure-Wsl
  # Cai WSL MSI co the yeu cau reboot; kiem tra lai truoc khi dung.
  Confirm-Reboot
  Ensure-Distro
  Initialize-Distro
  Ensure-App

  $common = @()
  if ($Domain) { $common += @('--domain', $Domain) }
  if ($Email)  { $common += @('--email', $Email) }
  if ($Tunnel) { $common += '--tunnel' }
  elseif ($NoTunnel) { $common += '--no-tunnel' }
  if (-not $Domain -and $script:PortExplicit) { $common += @('--port', [string]$Port) }

  if ($IsUpdate) {
    Write-Step "Cap nhat & build lai"
    Invoke-Deploy (@('update') + $common)
  } else {
    Write-Step "Cai dat & khoi chay (lan dau co the mat vai phut)..."
    Invoke-Deploy $common
  }

  # Sau khi deploy xong, .env la nguon su that cho domain/cong.
  $envInfo = Read-DeployEnv
  if ($envInfo.Domain) { $script:PortList = @(80, 443) }
  else {
    $p = $envInfo.HttpPort
    if (-not $p) { $p = "$Port" }
    $script:PortList = @([int]$p)
  }

  if (-not $SkipFirewall) { Set-Firewall $script:PortList }
  if (-not $SkipPortProxy) {
    Set-PortProxy $script:PortList
    Register-ProxyTask
  }

  Show-Summary
}

function Assert-Installed {
  $exe = Resolve-WslExe
  if (-not $exe) { Fail "Chua cai dat WSL. Chay .\deploy-server.ps1 truoc." }
  $script:WslExe = $exe
  if (-not ((Get-WslDistros) -contains $WslDistro)) {
    Fail "Chua co distro $WslDistro. Chay .\deploy-server.ps1 truoc."
  }
  $check = Invoke-WslCapture "test -f '$AppDir/deploy-server.sh' && echo yes"
  if ($check -ne 'yes') { Fail "Chua co ma nguon tai $AppDir. Chay .\deploy-server.ps1 truoc." }
}

function Invoke-Manage([string]$Cmd) {
  Assert-Installed

  if ($Cmd -eq 'tunnel-url' -or $Cmd -eq 'tunnel-off') {
    Invoke-Deploy @($Cmd)
    return
  }

  $deployArgs = @($Cmd)

  if ($Cmd -eq 'destroy') {
    if (-not $Yes) {
      $ans = Read-Host "Xoa TOAN BO container va DU LIEU database? [y/N]"
      if ($ans -ne 'y' -and $ans -ne 'Y') { Write-Host "Da huy."; return }
    }
    # Da xac nhan o PowerShell: truyen --yes de khong hoi lai trong WSL.
    $deployArgs = @('destroy', '--yes')
  }

  $envInfo = Read-DeployEnv
  if ($envInfo.Domain) { $script:PortList = @(80, 443) }
  else {
    $p = $envInfo.HttpPort
    if (-not $p) { $p = "$Port" }
    $script:PortList = @([int]$p)
  }

  Invoke-Deploy $deployArgs

  if ($Cmd -eq 'destroy') {
    Remove-ProxyArtifacts
  } elseif ($Cmd -eq 'update') {
    if (-not $SkipFirewall) { Set-Firewall $script:PortList }
    if (-not $SkipPortProxy) { Set-PortProxy $script:PortList; Register-ProxyTask }
  } elseif ($Cmd -eq 'restart') {
    if (-not $SkipPortProxy) { Set-PortProxy $script:PortList }
  }
}

# ------------------------------ Main ------------------------------------------
if ($env:OS -ne 'Windows_NT') {
  Fail "Script nay danh cho Windows. Tren Linux/macOS hay dung ./deploy-server.sh"
}

Test-Admin
Initialize-Tls

$osInfo = Get-CimInstance Win32_OperatingSystem
$build = [int]$osInfo.BuildNumber
$isServer = $osInfo.Caption -match 'Server'
Write-Step "Moi truong: $($osInfo.Caption) (build $build)"
if ($isServer) {
  if ($build -lt 17763) { Fail "Windows Server qua cu cho WSL2 (can Server 2019 tro len)." }
  elseif ($build -lt 20348) { Write-Warn2 "Khuyen nghi Windows Server 2022+; ban nay can bat ao hoa long nhau neu la VM." }
} else {
  # Windows 10/11 Home/Pro deu chay duoc WSL2 + Docker Linux.
  if ($build -lt 19041) {
    Fail "Windows 10 qua cu cho WSL2 (can ban 2004/build 19041 tro len, hoac Windows 11)."
  }
  Write-Ok "Windows client: dung WSL2 + Docker Engine (khong can Docker Desktop)."
}

$script:PortList = @($Port)

switch ($Action) {
  'up'      { Invoke-FullDeploy $false }
  'install' { Invoke-FullDeploy $false }
  'update'  { Invoke-FullDeploy $true }
  default   { Invoke-Manage $Action }
}
