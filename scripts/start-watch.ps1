#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location -LiteralPath $root
$localEnvironment = Join-Path $root '.agent-runtime/environment.ps1'
if (Test-Path -LiteralPath $localEnvironment) { . $localEnvironment }
# Important: register only after successful manual --live --once acceptance.
& node (Join-Path $PSScriptRoot 'dispatcher.mjs') --live --watch
exit $LASTEXITCODE
