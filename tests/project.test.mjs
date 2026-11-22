import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
test('project has required quality scripts', () => {
  assert.ok(pkg.scripts.build);
  assert.ok(pkg.scripts.test);
});
test('no pretend real Liuzhou map is included in starter', () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(source, /不是柳州真实地图/);
});
test('collaboration governance exists', () => {
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'docs/requirements.md', 'scripts/dispatcher.mjs']) {
    assert.ok(existsSync(new URL(`../${name}`, import.meta.url)), name);
  }
});
