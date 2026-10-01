param(
  [switch]$NoBrowser,
  [int]$AutoStopSeconds = 0
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot ".tools"
$cloudflared = Join-Path $toolsDir "cloudflared.exe"
$localUrl = "http://127.0.0.1:5050"
$runId = [Guid]::NewGuid().ToString("N")
$appOut = Join-Path $projectRoot "tmp-launch-app-$runId.out"
$appErr = Join-Path $projectRoot "tmp-launch-app-$runId.err"
$tunnelOut = Join-Path $projectRoot "tmp-launch-tunnel-$runId.out"
$tunnelErr = Join-Path $projectRoot "tmp-launch-tunnel-$runId.err"
$serverProcess = $null
$tunnelProcess = $null
$startedServer = $false

function Test-AppRunning {
  try {
    $response = Invoke-WebRequest -Uri "$localUrl/api/health" -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -Uri "$localUrl/api/ready" -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-ForApp {
  param([int]$TimeoutSeconds = 60)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-AppReady) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Wait-ForTunnelUrl {
  param([int]$TimeoutSeconds = 45)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $log = ""
    if (Test-Path -LiteralPath $tunnelOut) {
      $log += Get-Content -LiteralPath $tunnelOut -Raw -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $tunnelErr) {
      $log += Get-Content -LiteralPath $tunnelErr -Raw -ErrorAction SilentlyContinue
    }

    $match = [regex]::Match($log, "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($match.Success) {
      return $match.Value
    }

    if ($tunnelProcess -and $tunnelProcess.HasExited) {
      break
    }
    Start-Sleep -Milliseconds 500
  }
  return $null
}

function Wait-ForPublicApp {
  param(
    [string]$PublicUrl,
    [int]$TimeoutSeconds = 120
  )

  $hostName = ([Uri]$PublicUrl).DnsSafeHost
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $cloudflareRecords = @(
        Resolve-DnsName -Name $hostName -Server "1.1.1.1" -Type A -DnsOnly -ErrorAction Stop |
          Where-Object { $_.IPAddress }
      )
      $googleRecords = @(
        Resolve-DnsName -Name $hostName -Server "8.8.8.8" -Type A -DnsOnly -ErrorAction Stop |
          Where-Object { $_.IPAddress }
      )

      if ($cloudflareRecords.Count -eq 0 -or $googleRecords.Count -eq 0) {
        throw "O endereco ainda nao esta publicado nos DNS publicos."
      }

      $edgeIp = $cloudflareRecords[0].IPAddress
      $healthResponse = & curl.exe `
        --silent `
        --show-error `
        --fail `
        --max-time 10 `
        --resolve "${hostName}:443:$edgeIp" `
        "$PublicUrl/api/health" 2>$null

      if ($LASTEXITCODE -eq 0 -and $healthResponse -match '"status"\s*:\s*"ok"') {
        return $true
      }
    } catch {
      # Quick Tunnel DNS can take some time to reach every public resolver.
    }
    Start-Sleep -Seconds 1
  }
  return $false
}

try {
  Set-Location $projectRoot

  if (-not (Test-Path -LiteralPath $cloudflared)) {
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    Write-Host "A descarregar o Cloudflare Tunnel..."
    Invoke-WebRequest `
      -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
      -OutFile $cloudflared
  }

  if (-not (Test-AppRunning)) {
    Write-Host "A iniciar o Visit Manager..."
    $serverProcess = Start-Process `
      -FilePath "npm.cmd" `
      -ArgumentList @("run", "dev") `
      -WorkingDirectory $projectRoot `
      -RedirectStandardOutput $appOut `
      -RedirectStandardError $appErr `
      -WindowStyle Hidden `
      -PassThru
    $startedServer = $true

    if (-not (Wait-ForApp)) {
      $details = if (Test-Path -LiteralPath $appErr) {
        Get-Content -LiteralPath $appErr -Tail 20 | Out-String
      } else {
        "Sem detalhes adicionais."
      }
      throw "A app nao ficou pronta dentro do tempo esperado.`n$details"
    }
  } else {
    Write-Host "O Visit Manager ja esta ligado."
  }

  $publicUrl = $null
  $maxTunnelAttempts = 3
  for ($attempt = 1; $attempt -le $maxTunnelAttempts; $attempt++) {
    Write-Host "A criar o endereco HTTPS (tentativa $attempt de $maxTunnelAttempts)..."
    $tunnelProcess = Start-Process `
      -FilePath $cloudflared `
      -ArgumentList @("tunnel", "--url", $localUrl, "--no-autoupdate") `
      -WorkingDirectory $projectRoot `
      -RedirectStandardOutput $tunnelOut `
      -RedirectStandardError $tunnelErr `
      -WindowStyle Hidden `
      -PassThru

    $candidateUrl = Wait-ForTunnelUrl
    if ($candidateUrl) {
      Write-Host "Endereco criado: $candidateUrl"
      Write-Host "A aguardar que o endereco fique acessivel..."
      if (Wait-ForPublicApp -PublicUrl $candidateUrl) {
        $publicUrl = $candidateUrl
        break
      }
    }

    if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
      Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    $tunnelProcess = $null

    if ($attempt -lt $maxTunnelAttempts) {
      Write-Host "Este endereco demorou demasiado. A tentar criar outro automaticamente..." -ForegroundColor Yellow
      Start-Sleep -Seconds 2
    }
  }

  if (-not $publicUrl) {
    throw "A Cloudflare nao conseguiu disponibilizar um endereco apos $maxTunnelAttempts tentativas. Verifique a ligacao a Internet e tente novamente."
  }

  Write-Host ""
  Write-Host "Visit Manager disponivel em:" -ForegroundColor Green
  Write-Host $publicUrl -ForegroundColor Cyan
  Write-Host ""

  if (-not $NoBrowser) {
    Start-Process $publicUrl
  }

  if ($AutoStopSeconds -gt 0) {
    Start-Sleep -Seconds $AutoStopSeconds
  } else {
    Read-Host "Prima Enter para desligar o tunel e fechar a app iniciada por este ficheiro"
  }
} catch {
  Write-Host ""
  Write-Host "Nao foi possivel iniciar o Visit Manager:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
} finally {
  if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
  }

  if ($startedServer -and $serverProcess -and -not $serverProcess.HasExited) {
    & taskkill.exe /PID $serverProcess.Id /T /F 2>$null | Out-Null
  }

  Remove-Item -LiteralPath $appOut, $appErr, $tunnelOut, $tunnelErr -Force -ErrorAction SilentlyContinue
}
