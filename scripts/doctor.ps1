#Requires -Version 7.0
$ErrorActionPreference = 'Continue'
Write-Host '=== Liuzhou Online: Windows agent readiness check ===' -ForegroundColor Cyan
$tools = @('git','gh','node','npm','pwsh','claude','codex','grok')
$allOkay = $true
foreach ($t in $tools) {
  $cmd = Get-Command $t -ErrorAction SilentlyContinue
  if ($cmd) { Write-Host "[OK] $t => $($cmd.Source)" -ForegroundColor Green }
  else { Write-Host "[MISSING] $t" -ForegroundColor Yellow; $allOkay = $false }
}
Write-Host '\n=== Authentication ==='
try { & gh auth status; if ($LASTEXITCODE -ne 0) { $allOkay = $false } }
catch { Write-Warning "GitHub auth: $_"; $allOkay = $false }
Write-Host '\n=== Agent authentication: manual first-run validation ==='
Write-Host 'Run claude, codex, grok interactively once and sign in.'
Write-Host 'Then use single-turn read-only commands shown in README-START-HERE.md.'
Write-Host '\n=== Repository ==='
Push-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
try {
  if (Test-Path '.git') { & git status --short; & gh repo view --json nameWithOwner --jq '.nameWithOwner' }
  else { Write-Warning 'This folder is not yet a Git repo. Run bootstrap.ps1.' }
} finally { Pop-Location }
if ($allOkay) { Write-Host '\nAll required executables were detected.' -ForegroundColor Green }
else { Write-Warning 'Some components are missing. Install and rerun.' }
