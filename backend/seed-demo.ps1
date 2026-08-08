<#
  Seed (or clean) 30 demo students with data across every feature.

    cd backend
    .\seed-demo.ps1            # create all demo data
    .\seed-demo.ps1 clean      # remove all demo data (the 30 students + their rows)

  Login for all seeded students:  student01@lare.dev .. student30@lare.dev  /  Lare@1234
#>
param([string]$Mode = "seed")
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$py = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "Shared venv not found at $py" }
$clean = ($Mode -eq "clean")

function Invoke-Seed($svc, $schema, $script, [switch]$AllowClean) {
  $dir = Join-Path $root "services\$svc"
  if (-not (Test-Path (Join-Path $dir $script))) { Write-Host "  skip $svc/$script (missing)"; return }
  # in clean mode only run the per-student seed_demo.py scripts
  if ($clean -and -not $AllowClean) { return }
  $lbl = if ($clean) { "clean" } else { "seed" }
  Write-Host "== $svc / $script ($lbl, schema: $schema) =="
  Push-Location $dir
  $env:DB_SCHEMA = $schema
  $env:PYTHONPATH = "."
  if ($clean) { & $py $script clean } else { & $py $script }
  Pop-Location
}

if ($clean) {
  # Reverse order; only the per-student seeders (which have a `clean` branch).
  Invoke-Seed "analytics"    "analytics"    "seed_demo.py" -AllowClean
  Invoke-Seed "ai_tutor"     "ai_tutor"     "seed_demo.py" -AllowClean
  Invoke-Seed "certification" "certification" "seed_demo.py" -AllowClean
  Invoke-Seed "gamification" "gamification" "seed_demo.py" -AllowClean
  Invoke-Seed "assessment"   "assessment"   "seed_demo.py" -AllowClean
  Invoke-Seed "coding"       "coding"       "seed_demo.py" -AllowClean
  Invoke-Seed "learner"      "learner"      "seed_demo.py" -AllowClean
  Invoke-Seed "auth"         "lare_auth"    "seed_demo.py" -AllowClean
  Write-Host ""
  Write-Host "Demo data removed. (The roster file backend/.run/demo_students.json is kept.)"
  return
}

# ---- seed mode ----
# 0. Make sure the new columns exist (idempotent) before seeding.
Invoke-Seed "assessment" "assessment" "migrate_cols.py"
Invoke-Seed "coding"     "coding"     "migrate_cols.py"

# 1. Students + shared roster (writes backend/.run/demo_students.json)
Invoke-Seed "auth"    "lare_auth" "seed_demo.py" -AllowClean
Invoke-Seed "learner" "learner"   "seed_demo.py" -AllowClean

# 2. Content banks the per-student seeds rely on
Invoke-Seed "coding"     "coding"     "seed_practice.py"   # practice problem bank
Invoke-Seed "assessment" "assessment" "seed_worlds.py"     # practice worlds

# 3. Per-student data across all features
Invoke-Seed "coding"       "coding"       "seed_demo.py" -AllowClean   # coding practice + vivas
Invoke-Seed "assessment"   "assessment"   "seed_demo.py" -AllowClean   # attempts, wallet, lessons, drill, worlds, reviews, mesh
Invoke-Seed "gamification" "gamification" "seed_demo.py" -AllowClean   # XP, levels, badges
Invoke-Seed "certification" "certification" "seed_demo.py" -AllowClean # certificates
Invoke-Seed "ai_tutor"     "ai_tutor"     "seed_demo.py" -AllowClean   # tutor sessions
Invoke-Seed "analytics"    "analytics"    "seed_demo.py" -AllowClean   # dashboard tiles, college rankings, scorecards

Write-Host ""
Write-Host "Demo data seeded. Log in as any student:  student01@lare.dev .. student30@lare.dev  /  Lare@1234"
Write-Host "Data only - no restart needed. Refresh the browser."
