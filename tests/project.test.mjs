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

test('manifest-overture has 2891 buildings with Overture attribution', () => {
  const p = new URL('../public/models/wuxing-street/manifest-overture.json', import.meta.url);
  assert.ok(existsSync(p), 'manifest-overture.json must exist');
  const m = JSON.parse(readFileSync(p, 'utf8'));
  assert.ok(m.attribution?.includes('OpenStreetMap'), 'must attribute OpenStreetMap');
  assert.ok(m.attribution?.includes('Overture'), 'must attribute Overture Maps');
  assert.ok(m.license?.includes('ODbL'), 'must be ODbL');
  assert.equal(m.buildings?.length, 2891, `expected 2891 buildings, got ${m.buildings?.length}`);
  // ML + OSM 两种来源都应存在
  const mlCount  = m.buildings.filter(b => b.sourceType === 'ml').length;
  const osmCount = m.buildings.filter(b => b.sourceType === 'osm').length;
  assert.ok(mlCount  > 2000, `expected >2000 ML buildings, got ${mlCount}`);
  assert.ok(osmCount >= 240,  `expected >=240 OSM buildings, got ${osmCount}`);
});

test('manifest-wide has 240 buildings with OSM attribution', () => {
  const widePath = new URL('../public/models/wuxing-street/manifest-wide.json', import.meta.url);
  assert.ok(existsSync(widePath), 'manifest-wide.json must exist');
  const wide = JSON.parse(readFileSync(widePath, 'utf8'));
  assert.ok(wide.attribution?.includes('OpenStreetMap'), 'wide manifest must have OSM attribution');
  assert.ok(wide.license?.includes('ODbL'), 'wide manifest must have ODbL license');
  assert.ok(Array.isArray(wide.buildings) && wide.buildings.length === 240,
    `expected 240 buildings in wide manifest, got ${wide.buildings?.length}`);
  // 验证高度数据存在
  const withHeight = wide.buildings.filter(b => b.heightSource === 'osm.height');
  const withLevels = wide.buildings.filter(b => b.heightSource === 'osm.levels');
  assert.ok(withHeight.length >= 2, `expected >=2 buildings with osm.height, got ${withHeight.length}`);
  assert.ok(withLevels.length >= 1, `expected >=1 buildings with osm.levels, got ${withLevels.length}`);
});

test('waterways.json has Liujiang river data', () => {
  const waterPath = new URL('../public/models/wuxing-street/waterways.json', import.meta.url);
  assert.ok(existsSync(waterPath), 'waterways.json must exist');
  const water = JSON.parse(readFileSync(waterPath, 'utf8'));
  assert.ok(water.attribution?.includes('OpenStreetMap'), 'waterways.json must have OSM attribution');
  assert.ok(Array.isArray(water.waterways) && water.waterways.length > 0, 'must have waterway entries');
  const liujiang = water.waterways.filter(w => w.name?.includes('柳江'));
  assert.ok(liujiang.length > 0, 'must include Liujiang river data');
});

test('wide roads.json has more than 100 roads', () => {
  const roads = JSON.parse(
    readFileSync(new URL('../public/models/wuxing-street/roads.json', import.meta.url), 'utf8')
  );
  assert.ok(roads.roads.length > 100,
    `wide roads should have >100 entries, got ${roads.roads.length}`);
});

test('collaboration governance exists', () => {
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'docs/requirements.md', 'scripts/dispatcher.mjs']) {
    assert.ok(existsSync(new URL(`../${name}`, import.meta.url)), name);
  }
});
