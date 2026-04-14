param(
  [switch]$Desktop,
  [switch]$CliOnly,
  [string]$InstallScope = $(if ($env:KIWI_CONTROL_INSTALL_SCOPE) { $env:KIWI_CONTROL_INSTALL_SCOPE } else { "user" }),
  [string]$BaseUrl = $(if ($env:KIWI_CONTROL_DOWNLOAD_BASE_URL) { $env:KIWI_CONTROL_DOWNLOAD_BASE_URL } else { "https://kiwi-control.kiwi-ai.in" })
)

$ErrorActionPreference = "Stop"

if ($CliOnly) {
  $Desktop = $false
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Kiwi Control install error: missing required command '$Name'."
  }
}

Require-Command "node"

$base = $BaseUrl.TrimEnd("/")
$metadataUrl = "$base/data/latest-release.json"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("kiwi-control-bootstrap-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "kiwi-control-cli.zip"
$bundleDir = Join-Path $tempRoot "bundle"

New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null

try {
  Write-Host "Fetching Kiwi Control release metadata"
  $metadata = Invoke-RestMethod -Uri $metadataUrl
  $cliUrl = $metadata.artifacts.cliWindows.latestUrl
  if ([string]::IsNullOrWhiteSpace($cliUrl)) {
    throw "Windows CLI bundle is not published yet. Windows desktop availability remains separate."
  }

  Write-Host "Downloading Kiwi Control CLI bundle for Windows"
  Invoke-WebRequest -Uri $cliUrl -OutFile $zipPath
  Expand-Archive -Path $zipPath -DestinationPath $bundleDir -Force

  $bundleInstaller = Get-ChildItem -Path $bundleDir -Filter "install.ps1" -Recurse | Select-Object -First 1
  if (-not $bundleInstaller) {
    throw "Downloaded CLI bundle did not contain install.ps1."
  }

  & $bundleInstaller.FullName -InstallScope $InstallScope

  $verificationScript = @"
`$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
`$user = [Environment]::GetEnvironmentVariable('Path', 'User')
`$env:Path = @(`$machine, `$user, `$env:Path) -join ';'
`$command = Get-Command kc -ErrorAction Stop
`$commandPath = `$command.Source
& `$commandPath --help | Out-Null
Write-Output `$commandPath
"@

  $resolvedCommand = powershell.exe -NoProfile -Command $verificationScript
  if ($LASTEXITCODE -ne 0) {
    throw "Kiwi Control install error: kc --help verification failed."
  }
  Write-Host "Verified: kc --help via $($resolvedCommand | Select-Object -Last 1)"

  if ($Desktop) {
    $desktopUrl = $metadata.artifacts.windowsNsis.latestUrl
    if ([string]::IsNullOrWhiteSpace($desktopUrl)) {
      Write-Host "Windows desktop installer is not published yet. CLI install remains complete."
    } else {
      $setupPath = Join-Path $tempRoot "kiwi-control-setup.exe"
      Write-Host "Downloading Kiwi Control Desktop setup EXE"
      Invoke-WebRequest -Uri $desktopUrl -OutFile $setupPath
      Write-Host "Launching Kiwi Control Desktop setup"
      Start-Process -FilePath $setupPath -Wait
    }
  }

  Write-Host "Kiwi Control CLI bootstrap complete."
} finally {
  Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue
}
