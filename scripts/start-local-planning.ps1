# Starts only the dedicated product endpoint; does not change the user's server.
$ErrorActionPreference = 'Stop'
$existing = Get-NetTCPConnection -LocalPort 11435 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.LocalAddress -ne '127.0.0.1') { throw 'Port 11435 is not bound exclusively to loopback.' }
  Write-Output 'Port 11435 already listening; verify /api/version before inference.'
  exit 0
}
$ollamaCommand = Get-Command ollama -ErrorAction Stop
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173'
Start-Process -FilePath $ollamaCommand.Source -ArgumentList 'serve' -WindowStyle Hidden
Write-Output 'Started hidden Ollama on loopback port 11435. Model: lfm3:1.7b. No public origin configured.'
