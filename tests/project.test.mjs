import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('project has required quality scripts', () => {
  assert.ok(pkg.scripts.build);
  assert.ok(pkg.scripts.test);
});

test('real OSM map is loaded (not demo scene) in main.ts', () => {
  const source = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  // main.ts 必须加载真实 OSM 建筑，而不是随机演示白模
  assert.match(source, /loadWuxingBuildings/, 'must load real OSM buildings');
  assert.match(source, /loadRoadNetwork/,     'must load real OSM roads');
  // OSM 署名必须存在
  assert.match(source, /OpenStreetMap/, 'must reference OpenStreetMap attribution');
  // 禁止仍然引用 DemoScene 作为主要内容
  assert.doesNotMatch(source, /new DemoScene\(\)/, 'must not use demo scene as primary content');
});

test('manifest has OSM attribution and license', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../public/models/wuxing-street/manifest.json', import.meta.url), 'utf8')
  );
  assert.ok(manifest.attribution?.includes('OpenStreetMap'), 'attribution must mention OpenStreetMap');
  assert.ok(manifest.license?.includes('ODbL'), 'license must be ODbL');
  assert.ok(manifest.source?.includes('openstreetmap.org'), 'source must be openstreetmap.org');
  assert.ok(Array.isArray(manifest.buildings) && manifest.buildings.length === 34,
    `expected 34 OSM buildings, got ${manifest.buildings?.length}`);
});

test('roads.json exists and has OSM attribution', () => {
  const roadsPath = new URL('../public/models/wuxing-street/roads.json', import.meta.url);
  assert.ok(existsSync(roadsPath), 'roads.json must exist');
  const roads = JSON.parse(readFileSync(roadsPath, 'utf8'));
  assert.ok(roads.attribution?.includes('OpenStreetMap'), 'roads.json must have OSM attribution');
  assert.ok(roads.license?.includes('ODbL'), 'roads.json must have ODbL license');
  assert.ok(Array.isArray(roads.roads) && roads.roads.length > 0, 'must have road entries');
});

test('collaboration governance exists', () => {
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'docs/requirements.md', 'scripts/dispatcher.mjs']) {
    assert.ok(existsSync(new URL(`../${name}`, import.meta.url)), name);
  }
});
