import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('DSH is integrated into worker.ps1', () => {
  const worker = readFileSync(join(root, 'scripts', 'worker.ps1'), 'utf8');
  ok(worker.includes("ValidateSet('claude','codex','grok','dsh')"), 'worker.ps1 should accept dsh agent');
  ok(worker.includes("elseif ($Agent -eq 'dsh')"), 'worker.ps1 should have dsh branch');
  ok(worker.includes('dsh --profile headless'), 'worker.ps1 should call dsh CLI');
});

test('DSH is recognized in dispatcher.mjs', () => {
  const dispatcher = readFileSync(join(root, 'scripts', 'dispatcher.mjs'), 'utf8');
  ok(dispatcher.includes("['claude', 'codex', 'grok', 'dsh']"), 'dispatcher should include dsh in agent list');
  ok(dispatcher.includes("agent === 'codex' || agent === 'dsh'"), 'dispatcher should verify dsh tasks');
  ok(dispatcher.includes("dsh:"), 'dispatcher should have dsh prompt scope');
});

test('settings.json has DSH configuration', () => {
  const settings = JSON.parse(readFileSync(join(root, 'scripts', 'settings.json'), 'utf8'));
  strictEqual(typeof settings.maxTasksPerAgent, 'object', 'settings should have maxTasksPerAgent');
  ok(settings.maxTasksPerAgent.dsh >= 2, 'DSH should allow at least 2 tasks per session');
  strictEqual(settings.enableCodex, false, 'Codex should be disabled by default');
  ok(settings.claudeMaxBudgetUsd === null || settings.claudeMaxBudgetUsd > 0, 'Claude budget should be null (unlimited) or positive');
});

test('AGENTS.md documents DSH routing', () => {
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  ok(agents.includes('Capacity-aware routing'), 'AGENTS.md should have routing section');
  ok(agents.includes('DeepSeek Harness (dsh)'), 'AGENTS.md should mention DSH');
  ok(agents.includes('Codex is specialist-only'), 'AGENTS.md should explain Codex status');
});

test('CLAUDE.md references DSH delegation', () => {
  const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
  ok(claude.includes('Delegate routine coding to DSH'), 'CLAUDE.md should delegate to DSH');
});
