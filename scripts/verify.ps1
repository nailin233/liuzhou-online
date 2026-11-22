#Requires -Version 7.0
param([Parameter(Mandatory)][string]$Worktree)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location -LiteralPath $Worktree
if ((Test-Path 'package-lock.json') -and !(Test-Path 'node_modules')) { & npm.cmd ci --ignore-scripts --no-audit --no-fund }
else { & npm.cmd install --ignore-scripts --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'npm test failed' }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
Write-Host 'Local tests and build passed.'
