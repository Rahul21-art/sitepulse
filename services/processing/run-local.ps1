$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Resolve-Path (Join-Path $serviceRoot '..\..')
$venvPython = Join-Path $workspaceRoot '.venv\Scripts\python.exe'

if (-not (Test-Path $venvPython)) {
  throw 'Python virtual environment not found. Create it with: python -m venv .venv'
}

Push-Location $serviceRoot
try {
  & $venvPython -m uvicorn main:app --host 127.0.0.1 --port 8000
} finally {
  Pop-Location
}
