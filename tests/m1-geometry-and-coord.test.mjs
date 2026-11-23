import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CoordinateSystem, WUXING_STREET_ORIGIN } from '../src/coordinate.ts';
import { extrudeBuildingGeometry, mergeBuildingGeometries } from '../src/WuxingBuildings.ts';
import { buildRoadRibbon, buildCategoryRoadGeometry } from '../src/RoadNetwork.ts';
import { buildRiverStripGeometry, buildWaterPolygonGeometry, WATER_ELEVATION } from '../src/WaterNetwork.ts';

test('CoordinateSystem converts WGS84 <-> local meters (+X east, +Y up, +Z south)', () => {
  const cs = new CoordinateSystem();
  const origin = cs.geoToLocal(WUXING_STREET_ORIGIN);
  assert.equal(origin.x, 0);
  assert.equal(origin.y, 0);
  assert.equal(origin.z, 0);

  // 向东增加经度 -> +X；向北增加纬度 -> -Z；向南减少纬度 -> +Z
  const northeast = cs.geoToLocal({
    lat: WUXING_STREET_ORIGIN.lat + 0.001,
    lon: WUXING_STREET_ORIGIN.lon + 0.001,
    alt: 12.5,
  });
  assert.ok(northeast.x > 90 && northeast.x < 110, `expected ~101m east, got ${northeast.x}`);
  assert.equal(northeast.y, 12.5);
  assert.ok(northeast.z < -100 && northeast.z > -120, `expected ~-111m north (-Z), got ${northeast.z}`);

  // 往返精度 < 1e-7 度
  const back = cs.localToGeo(northeast);
  assert.ok(Math.abs(back.lat - (WUXING_STREET_ORIGIN.lat + 0.001)) < 1e-7);
  assert.ok(Math.abs(back.lon - (WUXING_STREET_ORIGIN.lon + 0.001)) < 1e-7);
  assert.equal(back.alt, 12.5);
});

test('WuxingBuildings extrudeBuildingGeometry preserves Z orientation (no N-S mirror) and merges non-indexed ExtrudeGeometry', () => {
  const outline = [[10, 20], [30, 20], [30, 50], [10, 50]];
  const geo = extrudeBuildingGeometry(outline, 12);
  assert.ok(geo, 'extruded geometry should not be null');
  assert.equal(geo.index, null, 'ExtrudeGeometry is non-indexed');

  const pos = geo.getAttribute('position');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minX = Math.min(minX, pos.getX(i)); maxX = Math.max(maxX, pos.getX(i));
    minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i));
    minZ = Math.min(minZ, pos.getZ(i)); maxZ = Math.max(maxZ, pos.getZ(i));
  }
  assert.ok(Math.abs(minX - 10) < 1e-4 && Math.abs(maxX - 30) < 1e-4, `X bounds [${minX}, ${maxX}]`);
  assert.ok(Math.abs(minY - 0) < 1e-4 && Math.abs(maxY - 12) < 1e-4, `Y bounds [${minY}, ${maxY}]`);
  assert.ok(Math.abs(minZ - 20) < 1e-4 && Math.abs(maxZ - 50) < 1e-4, `Z must stay in [20, 50] (no mirror), got [${minZ}, ${maxZ}]`);

  // 合并真实 manifest-overture.json 前 200 栋非索引建筑，必须成功并保留 2 个材质组 (0=top, 1=side)
  const manifest = JSON.parse(
    readFileSync(new URL('../public/models/wuxing-street/manifest-overture.json', import.meta.url), 'utf8'),
  );
  const geos = [geo];
  for (const b of manifest.buildings.slice(0, 200)) {
    const g = extrudeBuildingGeometry(b.outline_local, b.modelHeight);
    if (g) geos.push(g);
  }
  const merged = mergeBuildingGeometries(geos);
  assert.ok(merged, 'merged geometry must not be null');
  assert.equal(merged.groups.length, 2, 'merged geometry must preserve top(0) and side(1) groups');
  assert.deepEqual(merged.groups.map(g => g.materialIndex), [0, 1]);
  assert.ok(merged.getAttribute('position').count > 1000);
  merged.dispose();
});

test('RoadNetwork builds path-aligned upward-facing ribbons, merges by category, and includes restored primary roads', () => {
  // 沿正东方向 (+X) 的道路应跨越 x∈[0,100], z∈[-4,4]，不可旋转 90°
  const { positions, indices } = buildRoadRibbon([[0, 0], [100, 0]], 8, 0.042);
  assert.equal(positions.length, 12);
  assert.equal(indices.length, 6);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  assert.ok(Math.abs(minX - 0) < 1e-4 && Math.abs(maxX - 100) < 1e-4, `X span [${minX}, ${maxX}]`);
  assert.ok(Math.abs(minZ + 4) < 1e-4 && Math.abs(maxZ - 4) < 1e-4, `Z span [${minZ}, ${maxZ}]`);

  const roadsManifest = JSON.parse(
    readFileSync(new URL('../public/models/wuxing-street/roads.json', import.meta.url), 'utf8'),
  );
  assert.ok(roadsManifest.roads.length >= 400, `expected >=400 roads after restoring primary, got ${roadsManifest.roads.length}`);
  const names = new Set(roadsManifest.roads.map(r => r.name).filter(Boolean));
  assert.ok(names.has('屏山大道') || names.has('广场路'), 'restored primary roads (屏山大道/广场路) must be present');

  const majorRoads = roadsManifest.roads.filter(r => r.category === 'major');
  const mergedMajor = buildCategoryRoadGeometry(majorRoads, 'major');
  assert.ok(mergedMajor, 'merged major road geometry must exist');
  const nor = mergedMajor.getAttribute('normal');
  for (let i = 0; i < nor.count; i++) {
    assert.ok(nor.getY(i) > 0.99, `road normal must face +Y, got ${nor.getY(i)}`);
  }
  mergedMajor.dispose();
});

test('WaterNetwork river strips and closed polygons face +Y, preserve Z orientation, and sit above ground', () => {
  assert.ok(WATER_ELEVATION > 0.005, 'water elevation must sit above inner ground y=0.005');

  const river = buildRiverStripGeometry([[0, 500], [200, 500]], 50);
  assert.ok(river);
  const rNor = river.getAttribute('normal');
  for (let i = 0; i < rNor.count; i++) {
    assert.ok(rNor.getY(i) > 0.99, `river strip normal must face +Y (not backface-culled), got ${rNor.getY(i)}`);
  }
  river.dispose();

  const lake = buildWaterPolygonGeometry([[10, -700], [50, -700], [50, -600], [10, -600]]);
  assert.ok(lake);
  const lPos = lake.getAttribute('position');
  const lNor = lake.getAttribute('normal');
  for (let i = 0; i < lPos.count; i++) {
    const z = lPos.getZ(i);
    assert.ok(z <= -599 && z >= -701, `closed water polygon Z must stay in [-700, -600] (no mirror), got ${z}`);
    assert.ok(lNor.getY(i) > 0.99, `water polygon normal must face +Y, got ${lNor.getY(i)}`);
  }
  lake.dispose();
});
