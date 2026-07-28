<#  health.ps1 — poll every service /health and the gateway aggregate. #>
$root = $PSScriptRoot
Get-Content (Join-Path $root "services.txt") | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $p = $line -split "\t"
    if ($p.Count -ge 3) {
      $name = $p[0]; $port = $p[2]
      try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 2
        Write-Host ("  {0,-16} :{1}  {2}" -f $name, $port, $r.status) -ForegroundColor Green
      } catch {
        Write-Host ("  {0,-16} :{1}  DOWN" -f $name, $port) -ForegroundColor Red
      }
    }
  }
}
