#Requires -Version 5.1
<#
.SYNOPSIS
  Triển khai ACT-HKT 2026 trên Windows 10/11 hoặc Windows Server (WSL2 + Docker).

.DESCRIPTION
  Hệ thống dùng 100% Linux container (PostgreSQL+pgvector, Redis, Spring Boot,
  Python AI Face, Nginx). Trên Windows (máy cá nhân hay server đều được), script tự:
    1. Bật WSL2 + VirtualMachinePlatform (nhắc reboot nếu cần)
    2. Cài WSL (MSI từ GitHub) nếu máy chưa có
    3. Cài/Import Ubuntu 22.04 và bật systemd để Docker chạy như service
    4. Gọi deploy-server.sh bên trong WSL: cài Docker Engine, sinh .env,
       build & chạy toàn bộ stack (dùng chung logic với bản Linux)
    5. Mở Windows Firewall + portproxy để truy cập từ máy khác
    6. Tạo Scheduled Task tự làm mới portproxy sau mỗi lần reboot
       (IP của WSL2 thay đổi mỗi lần khởi động)

.PARAMETER Action
  up (mặc định) | update | restart | stop | logs | status | down | destroy

.PARAMETER Domain
  Bật HTTPS tự động (Caddy + Let's Encrypt). DNS phải trỏ về server trước.

.PARAMETER Email
  Email đăng ký Let's Encrypt (đi kèm -Domain).

.PARAMETER Port
  Cổng HTTP khi KHÔNG dùng domain (mặc định 80).

.PARAMETER WslDistro
  Tên distro WSL dành riêng cho ứng dụng (mặc định ACT-HKT-Ubuntu).
  Đặt tên riêng để không đụng vào Ubuntu sẵn có trên máy cá nhân.

.PARAMETER AppDir
  Thư mục mã nguồn bên trong WSL (mặc định /opt/act-hkt).

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
  [ValidateSet('up','install','update','restart','stop','logs','status','down','destroy')]
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

  [switch]$SkipPortProxy,
  [switch]$SkipFirewall,
  [switch]$ForceReboot,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$script:WslExe = $null
$script:NeedReboot = $false
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
    Fail "Phải chạy PowerShell bằng quyền Administrator (chuột phải > Run as administrator)."
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

# ------------------------------ Tải file --------------------------------------
function Download-File([string]$Url, [string]$OutFile) {
  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & curl.exe -fL --retry 3 --connect-timeout 20 -o $OutFile $Url
    if ($LASTEXITCODE -ne 0) { Fail "Tải thất bại: $Url" }
  } else {
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
  }
}

# ------------------------------ Bước 1: bật feature ---------------------------
function Enable-WslFeatures {
  Write-Step "Bật Windows Subsystem for Linux + VirtualMachinePlatform"
  $features = @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')
  foreach ($f in $features) {
    $out = & dism.exe /online /enable-feature /featurename:$f /all /norestart 2>&1 | Out-String
    $code = $LASTEXITCODE
    if ($code -eq 3010) {
      $script:NeedReboot = $true
      Write-Ok "$f (cần khởi động lại)"
    } elseif ($code -ne 0) {
      Fail "Không bật được $f (dism=$code).`n$out"
    } else {
      Write-Ok $f
    }
  }
}

function Confirm-Reboot {
  if (-not $script:NeedReboot) { return }
  Write-Warn2 "Windows cần khởi động lại để hoàn tất bật WSL2."
  if ($ForceReboot) {
    Write-Step "Khởi động lại máy..."
    Restart-Computer -Force
    exit 0
  }
  Write-Host "Hãy reboot rồi chạy lại:  .\deploy-server.ps1 $Action" -ForegroundColor Yellow
  Write-Host "Hoặc thêm -ForceReboot để script tự khởi động lại." -ForegroundColor Yellow
  exit 3010
}

# ------------------------------ Bước 2: WSL -----------------------------------
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
    Write-Step "Tìm bản WSL mới nhất từ GitHub..."
    $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/microsoft/WSL/releases/latest' `
      -Headers @{ 'User-Agent' = 'act-hkt-deploy' }
    $asset = $rel.assets | Where-Object { $_.name -like 'wsl.*.x64.msi' } | Select-Object -First 1
    if (-not $asset) { Fail "Không tìm thấy WSL MSI x64. Truyền -WslMsiUrl thủ công." }
    $url = $asset.browser_download_url
  }
  $msi = Join-Path $env:TEMP 'act-hkt-wsl.msi'
  Write-Step "Tải WSL: $url"
  Download-File $url $msi
  $p = Start-Process -FilePath msiexec.exe -ArgumentList @('/i', "`"$msi`"", '/qn', '/norestart') -Wait -PassThru
  if ($p.ExitCode -eq 3010) { $script:NeedReboot = $true }
  elseif ($p.ExitCode -ne 0) { Fail "Cài WSL MSI lỗi (msiexec=$($p.ExitCode))." }
  Refresh-Path
}

function Ensure-Wsl {
  $exe = Resolve-WslExe
  if (-not $exe) {
    Install-WslPackage
    $exe = Resolve-WslExe
    if (-not $exe) { Fail "Đã cài WSL nhưng không tìm thấy wsl.exe." }
  }
  $script:WslExe = $exe
  Write-Ok "wsl.exe: $exe"

  Write-Step "Cập nhật WSL kernel"
  & $script:WslExe --update 2>&1 | Out-Null
  & $script:WslExe --set-default-version 2 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warn2 "Không đặt WSL2 làm mặc định. Kiểm tra ảo hoá (VT-x/AMD-V) đã bật trong BIOS/VM chưa."
  } else {
    Write-Ok "WSL2 là phiên bản mặc định"
  }
}

function Get-WslDistros {
  $out = & $script:WslExe -l -q 2>$null
  $text = ($out | Out-String) -replace "`0", ''
  return @($text -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Invoke-Wsl([string]$Command) {
  $wslArgs = @('-d', $WslDistro, '-u', 'root', '--', 'bash', '-lc', $Command)
  & $script:WslExe @wslArgs
  if ($LASTEXITCODE -ne 0) { Fail "Lệnh trong WSL thất bại (exit $LASTEXITCODE): $Command" }
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
    Write-Ok "Distro đã có: $WslDistro"
    return
  }

  # Import rootfs trực tiếp: ổn định trên Windows Server (không phụ thuộc Store /
  # wsl --install, vốn có thể treo hoặc không tồn tại trên Server).
  Write-Step "Import distro $WslDistro từ rootfs Ubuntu 22.04"
  New-Item -ItemType Directory -Force -Path $WslRoot | Out-Null
  $root = Join-Path $WslRoot $WslDistro
  if (Test-Path $root) {
    $count = @(Get-ChildItem $root -Force -ErrorAction SilentlyContinue).Count
    if ($count -gt 0) { Fail "Thư mục $root đã có dữ liệu. Di chuyển/xoá rồi chạy lại." }
  }
  $tar = Join-Path $WslRoot 'ubuntu-22.04.rootfs.tar.gz'
  if (-not (Test-Path $tar)) {
    Write-Step "Tải Ubuntu 22.04 rootfs (~300MB)..."
    Download-File $script:RootfsUrl $tar
  }
  & $script:WslExe --import $WslDistro $root $tar --version 2 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Fail "Import distro thất bại. Kiểm tra ảo hoá VT-x/AMD-V đã bật (và nested virtualization nếu là VM) rồi chạy lại."
  }
  Write-Ok "Đã import $WslDistro"
}

function Initialize-Distro {
  # Idempotent: chỉ cấu hình + khởi động lại khi chưa bật systemd, để lệnh
  # update không kill toàn bộ container đang chạy.
  $confOk = Invoke-WslCapture "grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null && echo ok"
  if ($confOk -eq 'ok') {
    Write-Ok "systemd đã bật trong $WslDistro"
    return
  }
  Write-Step "Bật systemd trong $WslDistro (để Docker chạy như service)"
  Invoke-Wsl "printf '[boot]\nsystemd=true\n[user]\ndefault=root\n' > /etc/wsl.conf"
  & $script:WslExe --terminate $WslDistro 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  # Chờ systemd boot xong (running/degraded) trước khi cài Docker; timeout 90s.
  Invoke-Wsl "timeout 90 systemctl is-system-running --wait >/dev/null 2>&1 || true; true"
  $state = Invoke-WslCapture "systemctl is-system-running 2>/dev/null || true"
  if ($state) { Write-Ok "systemd: $state" } else { Write-Warn2 "Chưa xác nhận được systemd." }
}

# ------------------------------ Bước 3: app -----------------------------------
function Ensure-App {
  Write-Step "Cài công cụ Linux trong WSL (curl, git, openssl)"
  Invoke-Wsl "export DEBIAN_FRONTEND=noninteractive; apt-get update -y >/dev/null && apt-get install -y curl git ca-certificates openssl >/dev/null"
  Write-Ok "Đã cài công cụ"

  $dir = $AppDir.Replace("'", "'\''")
  $cmd = "set -e; if [ ! -d '$dir/.git' ]; then mkdir -p `"`$(dirname '$dir')`" && git clone --branch '$Branch' --depth 1 '$RepoUrl' '$dir'; else cd '$dir' && git fetch --depth 1 origin '$Branch' && git checkout -q '$Branch' && git reset -q --hard origin/$Branch; fi"
  Write-Step "Đồng bộ mã nguồn ($Branch) → $AppDir"
  Invoke-Wsl $cmd
  Write-Ok "Mã nguồn sẵn sàng"
}

function Invoke-Deploy([string[]]$DeployArgs) {
  $quoted = ''
  if ($DeployArgs -and $DeployArgs.Count -gt 0) {
    $quoted = ($DeployArgs | ForEach-Object { "'" + ($_ -replace "'", "'\''") + "'" }) -join ' '
  }
  $dir = $AppDir.Replace("'", "'\''")
  # SKIP_SWAP=1: WSL2 tự quản lý swap; không swapon bên trong WSL.
  $cmd = "cd '$dir' && chmod +x deploy-server.sh && SKIP_SWAP=1 ./deploy-server.sh $quoted"
  Invoke-Wsl $cmd
}

function Read-DeployEnv {
  $envFile = "$AppDir/hkt/deploy/docker/.env"
  $domain = Invoke-WslCapture "grep '^SITE_DOMAIN=' '$envFile' 2>/dev/null | cut -d= -f2-"
  $http = Invoke-WslCapture "grep '^HTTP_PORT=' '$envFile' 2>/dev/null | cut -d= -f2-"
  $tls = Invoke-WslCapture "grep '^TLS_ENABLED=' '$envFile' 2>/dev/null | cut -d= -f2-"
  return [pscustomobject]@{ Domain = "$domain"; HttpPort = "$http"; Tls = "$tls" }
}

# ------------------------------ Bước 4: mạng Windows --------------------------
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
  if (-not $ip) { Fail "Không lấy được IP của WSL — container có đang chạy không?" }
  & netsh.exe interface ipv4 set global forwarding=enabled | Out-Null

  foreach ($p in $Ports) {
    # Xoá proxy cũ trước để không tự báo trùng cổng với chính nó ở lần chạy lại.
    & netsh.exe interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 2>$null | Out-Null
    Start-Sleep -Milliseconds 200
    if (Test-PortListening $p) {
      Fail "Cổng $p đang bị một dịch vụ Windows khác chiếm (vd IIS). Dừng nó hoặc đổi -Port."
    }
    & netsh.exe interface portproxy add v4tov4 listenport=$p listenaddress=0.0.0.0 connectport=$p connectaddress=$ip
    if ($LASTEXITCODE -ne 0) { Fail "Tạo portproxy cổng $p thất bại." }
  }
  Write-Ok "Portproxy: $($Ports -join ', ') → WSL $ip"
}

function Set-Firewall([int[]]$Ports) {
  foreach ($p in $Ports) {
    $name = "ACT-HKT TCP $p"
    Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue |
      Remove-NetFirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow `
      -Protocol TCP -LocalPort $p -Profile Any | Out-Null
  }
  Write-Ok "Firewall Windows: mở TCP $($Ports -join ', ')"
}

function Register-ProxyTask {
  $portsLiteral = ($script:PortList -join ',')
  $template = @'
$ErrorActionPreference = 'SilentlyContinue'
Start-Sleep -Seconds 15
$distro = '__DISTRO__'
$ports = @(__PORTS__)
# Khởi động WSL/distro (kéo theo systemd + docker)
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

  if (-not (Test-Path $script:RefreshDir)) { New-Item -ItemType Directory -Force -Path $script:RefreshDir | Out-Null }
  Set-Content -Path $script:RefreshScript -Value $content -Encoding UTF8

  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script:RefreshScript`""
  # WSL đăng ký distro theo từng user (HKCU), nên task phải chạy dưới user đã cài
  # (S4U = không cần lưu mật khẩu), không dùng SYSTEM.
  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $triggerBoot = New-ScheduledTaskTrigger -AtStartup
  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType S4U -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $script:TaskName -Action $action -Trigger @($triggerBoot, $triggerLogon) `
    -Principal $principal -Settings $settings -Force | Out-Null
  Write-Ok "Scheduled Task '$($script:TaskName)' sẽ tự làm mới portproxy sau reboot (user $currentUser)."
}

function Remove-ProxyArtifacts {
  Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue |
    Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue
  $ports = @(@(80, 443) + $script:PortList | Select-Object -Unique)
  foreach ($p in $ports) {
    & netsh.exe interface portproxy delete v4tov4 listenport=$p listenaddress=0.0.0.0 2>$null | Out-Null
  }
  Write-Ok "Đã xoá portproxy & scheduled task."
}

# ------------------------------ Điều phối -------------------------------------
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
  Write-Host "  Ma nguon:       $AppDir (trong WSL: $WslDistro)"
  Write-Host "  Cau hinh:       $AppDir/hkt/deploy/docker/.env  (SAO LUU file nay!)"
  Write-Host "---------------------------------------------------------------------------------------"
  Write-Host "  TAI KHOAN DEMO: Admin/Admin - 01HR/123456 - 05ACT/123456 - 136ACT/123456 - 2026NEW/123456" -ForegroundColor Yellow
  Write-Host "---------------------------------------------------------------------------------------"
  Write-Host "  Quan tri:  .\deploy-server.ps1 status | logs | update | restart | stop | destroy"
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
  # Cài WSL MSI có thể yêu cầu reboot; kiểm tra lại trước khi dùng.
  Confirm-Reboot
  Ensure-Distro
  Initialize-Distro
  Ensure-App

  if ($IsUpdate) {
    Write-Step "Cập nhật & build lại"
    Invoke-Deploy @('update')
  } else {
    $deployParams = @()
    if ($Domain) { $deployParams += @('--domain', $Domain) }
    if ($Email)  { $deployParams += @('--email', $Email) }
    if (-not $Domain) { $deployParams += @('--port', [string]$Port) }
    Write-Step "Cài đặt & khởi chạy (lần đầu có thể mất vài phút)..."
    Invoke-Deploy $deployParams
  }

  # Sau khi deploy xong, .env là nguồn sự thật cho domain/cổng.
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
  if (-not $exe) { Fail "Chưa cài đặt WSL. Chạy .\deploy-server.ps1 trước." }
  $script:WslExe = $exe
  if (-not ((Get-WslDistros) -contains $WslDistro)) {
    Fail "Chưa có distro $WslDistro. Chạy .\deploy-server.ps1 trước."
  }
  $check = Invoke-WslCapture "test -f '$AppDir/deploy-server.sh' && echo yes"
  if ($check -ne 'yes') { Fail "Chưa có mã nguồn tại $AppDir. Chạy .\deploy-server.ps1 trước." }
}

function Invoke-Manage([string]$Cmd) {
  Assert-Installed
  $deployArgs = @($Cmd)

  if ($Cmd -eq 'destroy') {
    if (-not $Yes) {
      $ans = Read-Host "Xoa TOAN BO container va DU LIEU database? [y/N]"
      if ($ans -ne 'y' -and $ans -ne 'Y') { Write-Host "Da huy."; return }
    }
    # Đã xác nhận ở PowerShell: truyền --yes để không hỏi lại trong WSL.
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
  Fail "Script này dành cho Windows. Trên Linux/macOS hãy dùng ./deploy-server.sh"
}

Test-Admin
Initialize-Tls

$osInfo = Get-CimInstance Win32_OperatingSystem
$build = [int]$osInfo.BuildNumber
$isServer = $osInfo.Caption -match 'Server'
Write-Step "Môi trường: $($osInfo.Caption) (build $build)"
if ($isServer) {
  if ($build -lt 17763) { Fail "Windows Server quá cũ cho WSL2 (cần Server 2019 trở lên)." }
  elseif ($build -lt 20348) { Write-Warn2 "Khuyến nghị Windows Server 2022+; bản này cần bật ảo hoá lồng nhau nếu là VM." }
} else {
  # Windows 10/11 Home/Pro đều chạy được WSL2 + Docker Linux.
  if ($build -lt 19041) {
    Fail "Windows 10 quá cũ cho WSL2 (cần bản 2004/build 19041 trở lên, hoặc Windows 11)."
  }
  Write-Ok "Windows client: dùng WSL2 + Docker Engine (không cần Docker Desktop)."
}

$script:PortList = @($Port)

switch ($Action) {
  'up'      { Invoke-FullDeploy $false }
  'install' { Invoke-FullDeploy $false }
  'update'  { Invoke-FullDeploy $true }
  default   { Invoke-Manage $Action }
}
