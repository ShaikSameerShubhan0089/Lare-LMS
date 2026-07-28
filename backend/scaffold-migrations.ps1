<#
  scaffold-migrations.ps1 — drop the shared Alembic template into every service
  so each owns a `migrations/` dir (env.py + script.py.mako + versions/) and an
  alembic.ini. Idempotent; never overwrites existing migration versions.

    ./scaffold-migrations.ps1

  Then, per service (from its directory, with DATABASE_URL/DB_SCHEMA set):
    alembic revision --autogenerate -m "init"
    alembic upgrade head
#>
$root = $PSScriptRoot
$tpl = Join-Path $root "alembic-template"
foreach ($raw in (Get-Content (Join-Path $root "services.txt"))) {
  $line = $raw.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $parts = $line -split "\s+"
    $dir = Join-Path $root "services\$($parts[1])"
    if (-not (Test-Path (Join-Path $dir "manage.py"))) { continue }
    $mig = Join-Path $dir "migrations"
    New-Item -ItemType Directory -Force -Path (Join-Path $mig "versions") | Out-Null
    Copy-Item (Join-Path $tpl "env.py") (Join-Path $mig "env.py") -Force
    Copy-Item (Join-Path $tpl "script.py.mako") (Join-Path $mig "script.py.mako") -Force
    if (-not (Test-Path (Join-Path $dir "alembic.ini"))) {
      Copy-Item (Join-Path $tpl "alembic.ini") (Join-Path $dir "alembic.ini")
    }
    Write-Host "  scaffolded migrations -> $($parts[0])" -ForegroundColor Green
  }
}
Write-Host "Done. Run 'alembic revision --autogenerate -m init' in each service."
