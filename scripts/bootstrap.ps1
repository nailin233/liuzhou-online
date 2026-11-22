#Requires -Version 7.0
param(
  [switch]$CreateRepo,
  [switch]$SeedIssues,
  [string]$RepoName = 'liuzhou-online'
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location -LiteralPath (Resolve-Path (Join-Path $PSScriptRoot '..'))
function Exec([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $Command $($Arguments -join ' ') (exit $LASTEXITCODE)" }
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install GitHub CLI (gh) first.' }
Exec -Command 'gh' -Arguments @('auth','status')
if (-not (Test-Path '.git')) {
  Exec -Command 'git' -Arguments @('init','-b','setup/bootstrap')
}
$head = & git rev-parse --verify HEAD 2>$null
if ($LASTEXITCODE -ne 0) {
  if ((& git branch --show-current) -ne 'setup/bootstrap') { throw 'Initialize on setup/bootstrap before seeding.' }
  Exec -Command 'git' -Arguments @('add','-A')
  Exec -Command 'git' -Arguments @('commit','-m','chore: bootstrap Liuzhou Online starter')
}
$remotes = & git remote
if ($LASTEXITCODE -ne 0) { throw 'git remote failed' }
if ($remotes -notcontains 'origin') {
  if (-not $CreateRepo) { throw 'No origin remote. Run bootstrap.ps1 -CreateRepo -SeedIssues to create a PRIVATE GitHub repository.' }
  Write-Host "Creating PRIVATE GitHub repository: $RepoName" -ForegroundColor Cyan
  if ((& git branch --show-current) -ne 'setup/bootstrap') { throw 'Expected setup/bootstrap for repository creation.' }
  Exec -Command 'gh' -Arguments @('repo','create',$RepoName,'--private','--source','.','--remote','origin')
  Exec -Command 'git' -Arguments @('push','-u','origin','refs/heads/setup/bootstrap:refs/heads/setup/bootstrap')
  $target = & gh repo view --json nameWithOwner --jq '.nameWithOwner'
  if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve new repository' }
  $initialCommit = & git rev-parse HEAD
  Exec -Command 'gh' -Arguments @('api',"repos/$target/git/refs",'-f','ref=refs/heads/main','-f',"sha=$initialCommit",'--silent')
  Exec -Command 'gh' -Arguments @('repo','edit',$target,'--default-branch','main')
}
$repo = & gh repo view --json nameWithOwner --jq '.nameWithOwner'
if ($LASTEXITCODE -ne 0) { throw 'Failed to resolve GitHub repo from current folder' }
Write-Host "Repository: $repo" -ForegroundColor Green
$labels = @(
  @('agent:claude','266B91','Architecture and design agent'),
  @('agent:codex','347C74','Implementation agent'),
  @('agent:grok','98548F','Research agent'),
  @('state:ready','468847','Awaiting agent dispatch'),
  @('state:running','E2A13A','Agent is running'),
  @('state:review','486CA2','Draft PR awaits human review'),
  @('state:blocked','B44343','Task failed; human repair required')
)
foreach ($l in $labels) { Exec -Command 'gh' -Arguments @('label','create',$l[0],'--repo',"$repo",'--color',$l[1],'--description',$l[2],'--force') }
Write-Host 'Labels configured.' -ForegroundColor Green
if ($SeedIssues) {
  New-Item -ItemType Directory -Force '.agent-runtime' | Out-Null
  $marker = '.agent-runtime/seeded-issues.txt'
  if (Test-Path $marker) { throw "Seed tasks already created ($marker). Do not create duplicates." }
  $body1 = @'
## Objective
Audit OpenStreetMap / Geofabrik coverage around Wuxing Street in Liuzhou, Guangxi, China. Compare actual roads, buildings, river coverage, licenses, and data gaps. DO NOT claim coverage without inspecting data.

## Expected output
Write sourced research with URLs and access dates. Identify a defensible initial 500m × 500m location, geographic bounds, count methods and missing geometry.

## Acceptance
- Real data source and license details
- Grounded building/road coverage findings (or explicit not verified)
- Next recommended data pipeline step
'@
  $one = & gh issue create --repo "$repo" --title '[Research] 柳州五星街 OSM 覆盖率与数据许可核查' --body "$body1" --label 'agent:grok' --label 'state:ready'
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create Issue 1' }
  if ($one -match '/issues/(\d+)$') { $i1 = [int]$Matches[1] } else { throw 'Cannot parse Issue 1 URL' }
  $body2 = @'
## Objective
Design a genuine Liuzhou city tile data pipeline: sources, coordinate transform, buildings, roads, unknown heights, GLB asset interface, performance and data license management. First target Wuxing Street.

## Expected output
Write docs/architecture-city-pipeline.md and docs/art-direction.md. Only docs/ can be edited. No fabricated geographical claims.

## Acceptance
- Accurate coordinate strategy and tests proposed
- Data-source uncertainty and fallback specified
- Interfaces for Codex implementation
'@
  $two = & gh issue create --repo "$repo" --title '[Architecture] 真实城市地图管线与美术方向' --body "$body2" --label 'agent:claude' --label 'state:ready'
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create Issue 2' }
  if ($two -match '/issues/(\d+)$') { $i2 = [int]$Matches[1] } else { throw 'Cannot parse Issue 2 URL' }
  $body3 = @"
Depends-On: #$i1, #$i2

## Objective
Implement the first documented, testable geodata import path in Three.js. Use verified real-world data from prior merged research; do not fabricate Liuzhou streets or buildings.

## Expected output
Real-data-based viewer module and automated tests. Keep the existing explicit prototype disclaimer until real mapping is verified.

## Acceptance
- npm test and npm run build pass
- Real data bounds and provenance traceable
- Unknown building heights marked approximations
"@
  $three = & gh issue create --repo "$repo" --title '[Implementation] 导入可核验的柳州真实街区白模' --body "$body3" --label 'agent:codex' --label 'state:ready'
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create Issue 3' }
  @("Repository: $repo", "Research: #$i1", "Architecture: #$i2", "Implementation: $three") | Set-Content -Path $marker -Encoding UTF8
  Write-Host "Created Issues #$i1, #$i2, and implementation task." -ForegroundColor Green
}
Write-Host 'Bootstrap complete. Try: node scripts/dispatcher.mjs --once' -ForegroundColor Cyan
