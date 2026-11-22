import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = new URL('../public/models/wuxing-street/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
const raw = gunzipSync(readFileSync(new URL('../data/wuxing-street/map.osm.gz', import.meta.url)));
const xml = raw.toString('utf8');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Read only coordinates and node references from the pinned OSM API serialization.
const nodes = new Map();
for (const [, id, lat, lon] of xml.matchAll(/<node id="(\d+)"[^>]* lat="([\d.]+)" lon="([\d.]+)"/g)) {
  const scale = 6378137 * Math.PI / 180;
  nodes.set(id, [(Number(lon) - 109.4086882) * scale * Math.cos(24.3157756 * Math.PI / 180),
    (24.3157756 - Number(lat)) * scale]);
}
const footprints = new Map();
for (const [, id, body] of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  if (!/<tag k="building" v="(?!no")[^"]+"/.test(body)) continue;
  assert.doesNotMatch(body, /<tag k="(?:height|building:levels)"/);
  const refs = Array.from(body.matchAll(/<nd ref="(\d+)"/g), match => match[1]);
  assert.equal(refs[0], refs.at(-1));
  footprints.set('way/' + id, refs.slice(1).map(ref => nodes.get(ref)));
}

test('batch covers every audited footprint and its offline snapshot', () => {
  assert.equal(sha(raw), manifest.snapshotSha256);
  assert.equal(manifest.buildings.length, 34);
  assert.deepEqual(manifest.buildings.map(entry => entry.id).sort(), [...footprints.keys()].sort());
  assert.deepEqual(readdirSync(new URL('buildings/', root)).sort(),
    manifest.buildings.map(entry => entry.file.split('/').pop()).sort());
});

const colors = { 'missing-facade': '5c4a57', 'missing-roof': '6e5868', 'missing-outline': 'd9549b' };
for (const entry of manifest.buildings) {
  test(`${entry.id} GLB matches OSM position, footprint, roof, materials and triangle budget`, async () => {
    assert.equal(entry.heightSource, 'missing');
    assert.equal(entry.height, null);
    assert.equal(entry.modelHeight, 3);
    const bytes = readFileSync(new URL(entry.file, root));
    assert.equal(sha(bytes), entry.sha256);
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    assert.equal(scene.children[0].userData.osmId, entry.id);
    scene.updateMatrixWorld(true);
    const ring = footprints.get(entry.id);
    const bottom = new Set();
    const seenMaterials = new Set();
    let triangles = 0, roofArea = 0, momentX = 0, momentZ = 0;
    scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      const { material, geometry } = mesh;
      seenMaterials.add(material.name);
      assert.ok(material.isMeshStandardMaterial);
      assert.equal(material.color.getHexString(), colors[material.name]);
      assert.equal(material.metalness, 0);
      assert.ok(Math.abs(material.roughness - 0.85) < 1e-6);
      const positions = geometry.attributes.position;
      const points = Array.from({ length: positions.count }, (_, index) =>
        new Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
      for (const { x, y, z } of points) {
        assert.ok(y === 0 || y === 3);
        if (y !== 0) continue;
        const i = ring.findIndex(([east, south]) =>
          Math.hypot(x + entry.position[0] - east, z + entry.position[2] - south) < 0.001);
        assert.ok(i >= 0, 'base vertex must match an OSM node within 1 mm');
        bottom.add(i);
      }
      const indices = geometry.index.array;
      triangles += indices.length / 3;
      if (material.name === 'missing-facade') return;
      for (let i = 0; i < indices.length; i += 3) {
        const [a, b, c] = [points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]];
        assert.ok(a.y === 3 && b.y === 3 && c.y === 3);
        const area = ((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)) / 2;
        assert.ok(area > 0, 'roof and border triangles face up');
        roofArea += area;
        momentX += area * (a.x + b.x + c.x) / 3;
        momentZ += area * (a.z + b.z + c.z) / 3;
      }
    });
    assert.deepEqual([...seenMaterials].sort(), Object.keys(colors).sort());
    assert.equal(bottom.size, ring.length);
    const twiceArea = ring.reduce((sum, [x, z], i) => {
      const [nextX, nextZ] = ring[(i + 1) % ring.length];
      return sum + x * nextZ - z * nextX;
    }, 0);
    assert.ok(Math.abs(roofArea - Math.abs(twiceArea / 2)) < 0.01, 'roof covers OSM footprint');
    assert.ok(Math.hypot(momentX, momentZ) / roofArea < 0.001, 'area centroid at the local origin');
    assert.equal(entry.position[1], 0);
    assert.equal(triangles, entry.triangles);
    assert.ok(triangles <= 500);
  });
}
