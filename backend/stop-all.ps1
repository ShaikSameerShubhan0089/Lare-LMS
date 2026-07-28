<#  stop-all.ps1 — stop every service started by run-all.ps1.
    Uses .run/pids.json, with a port-based fallback from services.txt. #>
$ErrorActionPreference = "SilentlyContinue"
$root = $PSScriptRoot
$runDir = Join-Path $root ".run"
$pidsFile = Join-Path $runDir "pids.json"

$stopped = 0
if (Test-Path $pidsFile) {
  $pids = Get-Content $pidsFile -Raw | ConvertFrom-Json
  foreach ($prop in $pids.PSObject.Properties) {
    $procId = [int]$prop.Value
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $procId -Force
      Write-Host ("  stopped " + $prop.Name + " (pid " + $procId + ")") -ForegroundColor Yellow
      $stopped++
    }
  }
  Remove-Item $pidsFile -Force
}

# Fallback: free any port still held by a service in the registry.
foreach ($raw in (Get-Content (Join-Path $root "services.txt"))) {
  $line = $raw.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $parts = $line -split "\s+"
    if ($parts.Count -ge 3) {
      $port = [int]$parts[2]
      $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
      foreach ($c in $conns) {
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host ("  freed port " + $port + " (pid " + $c.OwningProcess + ")") -ForegroundColor DarkYellow
        $stopped++
      }
    }
  }
}
Write-Host ("Done. Stopped " + $stopped + " process(es).")
