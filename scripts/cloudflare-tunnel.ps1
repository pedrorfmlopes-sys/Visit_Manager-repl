$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot ".tools"
$cloudflared = Join-Path $toolsDir "cloudflared.exe"
$localUrl = "http://127.0.0.1:5050"

if (-not (Test-Path -LiteralPath $cloudflared)) {
  New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
  Write-Host "A descarregar o Cloudflare Tunnel..."
  Invoke-WebRequest `
    -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
    -OutFile $cloudflared
}

try {
  $response = Invoke-WebRequest -Uri "$localUrl/api/health" -UseBasicParsing -TimeoutSec 5
  if ($response.StatusCode -ne 200) {
    throw "A verificacao de saude devolveu HTTP $($response.StatusCode)."
  }
} catch {
  Write-Error "A app nao esta acessivel em $localUrl. Execute 'npm run dev' noutra janela e volte a tentar."
}

Write-Host "A abrir um endereco HTTPS temporario para $localUrl"
Write-Host "Mantenha esta janela aberta durante os testes. Prima Ctrl+C para fechar o tunel."
& $cloudflared tunnel --url $localUrl --no-autoupdate
