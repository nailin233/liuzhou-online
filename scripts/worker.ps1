#Requires -Version 7.0
param(
  [Parameter(Mandatory)][ValidateSet('claude','codex','grok')][string]$Agent,
  [Parameter(Mandatory)][string]$Worktree,
  [Parameter(Mandatory)][string]$PromptFile,
  [Parameter(Mandatory)][string]$LogFile,
  [Parameter(Mandatory)][string]$ReportFile,
  [Parameter(Mandatory)][int]$IssueNumber
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
Set-Location -LiteralPath $Worktree
$promptText = Get-Content -LiteralPath $PromptFile -Raw -Encoding UTF8
$env:CI = '1'

if ($Agent -eq 'codex') {
  & codex exec --sandbox workspace-write --output-last-message $ReportFile $promptText *> $LogFile
  $rc = $LASTEXITCODE
} elseif ($Agent -eq 'claude') {
  & claude -p $promptText --permission-mode dontAsk --permission-prompts none --tools 'Read,Edit,Write,Glob,Grep' --allowedTools 'Read,Glob,Grep,Edit(./docs/**),Write(./docs/**)' --strict-mcp-config --disable-slash-commands --max-turns 24 --output-format json > $LogFile 2> "$LogFile.stderr"
  $rc = $LASTEXITCODE
  if ($rc -eq 0) {
    try {
      $data = Get-Content -LiteralPath $LogFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      if ($data.is_error -or [string]::IsNullOrWhiteSpace($data.result)) { throw 'Claude did not return a final report' }
      $data.result | Set-Content -LiteralPath $ReportFile -Encoding UTF8
    } catch { throw "Claude result parsing failed: $_" }
  }
} else {
  # Restrict Grok to searching and reading. Its report is captured by this trusted wrapper.
  $rules = @('--allow','WebSearch')
  foreach ($domain in @('openstreetmap.org','overpass-api.de','geofabrik.de','opendatacommons.org','gxlib.org.cn')) {
    $rules += @('--allow', "WebFetch(domain:$domain)")
  }
  & grok --no-auto-update --no-subagents --no-memory --permission-mode dontAsk --max-turns 12 @rules --tools 'web_search,web_fetch' --output-format json -p $promptText > $LogFile 2> "$LogFile.stderr"
  $rc = $LASTEXITCODE
  if ($rc -eq 0) {
    try {
      $data = Get-Content -LiteralPath $LogFile -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      if ($data.stopReason -ne 'end_turn') { throw "Incomplete Grok response ($($data.stopReason))" }
      if ([string]::IsNullOrWhiteSpace([string]$data.text)) { throw 'Grok returned empty text' }
      $report = [string]$data.text
      $report | Set-Content -LiteralPath $ReportFile -Encoding UTF8
      $folder = Join-Path $Worktree 'docs/research'
      New-Item -ItemType Directory -Force -Path $folder | Out-Null
      @("# Issue #$IssueNumber · Grok 研究报告", '', $report) | Set-Content -Path (Join-Path $folder "issue-$IssueNumber.md") -Encoding UTF8
    } catch { throw "Grok result parsing failed: $_" }
  }
}
if ($rc -ne 0) { throw "$Agent CLI failed with exit code $rc. Read $LogFile" }
Write-Output "$Agent completed. Local output: $ReportFile"
