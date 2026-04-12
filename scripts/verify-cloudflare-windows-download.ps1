param(
  [string]$DownloadsUrl = $env:DOWNLOADS_URL,
  [bool]$RequireCli = $true
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($DownloadsUrl)) {
  throw "Missing DownloadsUrl. Pass -DownloadsUrl or set DOWNLOADS_URL."
}

$base = $DownloadsUrl.TrimEnd("/")
$metadataUrl = "$base/latest/downloads.json"
$metadata = Invoke-RestMethod -Uri $metadataUrl -Headers @{ Accept = "application/json" }

$requiredUrls = @(
  $metadata.artifacts.windowsNsis.latestUrl,
  $metadata.artifacts.windowsNsis.versionedUrl,
  $metadata.artifacts.windowsMsi.latestUrl,
  $metadata.artifacts.windowsMsi.versionedUrl,
  $metadata.checksumsUrl,
  $metadata.manifestUrl
)

$artifactResults = foreach ($url in $requiredUrls) {
  try {
    $response = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing
    [pscustomobject]@{
      Url = $url
      Ok = $true
      StatusCode = [int]$response.StatusCode
      Method = "HEAD"
    }
  } catch {
    [pscustomobject]@{
      Url = $url
      Ok = $false
      StatusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { $null }
      Method = "HEAD"
      Error = $_.Exception.Message
    }
  }
}

$signatureResults = @()
foreach ($url in @($metadata.artifacts.windowsNsis.latestUrl, $metadata.artifacts.windowsMsi.latestUrl)) {
  $tempFile = Join-Path $env:TEMP ([IO.Path]::GetFileName([Uri]$url))
  Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing
  $signature = Get-AuthenticodeSignature -FilePath $tempFile
  $signatureResults += [pscustomobject]@{
    Url = $url
    File = $tempFile
    Status = [string]$signature.Status
    Signer = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
    Ok = [string]$signature.Status -eq "Valid"
  }
}

$cli = $null
if ($RequireCli) {
  $command = Get-Command kc -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "kc was not found on PATH. Run this script after the default desktop CLI setup flow completes."
  }
  $help = & kc --help 2>&1 | Out-String
  $cli = [pscustomobject]@{
    CommandPath = $command.Source
    GetCommandPassed = $true
    HelpPassed = $LASTEXITCODE -eq 0 -or [string]::IsNullOrWhiteSpace($LASTEXITCODE)
    HelpPreview = ($help.Trim() -split "`n" | Select-Object -First 3) -join "`n"
  }
}

$payload = [pscustomobject]@{
  Ok = ($artifactResults | Where-Object { -not $_.Ok }).Count -eq 0 -and ($signatureResults | Where-Object { -not $_.Ok }).Count -eq 0 -and (-not $RequireCli -or $cli.GetCommandPassed -and $cli.HelpPassed)
  MetadataUrl = $metadataUrl
  Trust = $metadata.trust.windows
  ArtifactResults = $artifactResults
  SignatureResults = $signatureResults
  Cli = $cli
}

$payload | ConvertTo-Json -Depth 6

if (-not $payload.Ok) {
  exit 1
}
