if (-not (Test-Path node_modules)) {
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host ""
Write-Host "SitePulse starting at http://localhost:8080"
Write-Host "Press Ctrl+C to stop."
Write-Host ""
npm start
