import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { AnimeCharacter, CHARACTER_PALETTES } from '../src/AnimeCharacter.ts';
import { PhysicsWorld, buildBuildingTrimeshBuffers } from '../src/PhysicsWorld.ts';
import { PlayerController } from '../src/PlayerController.ts';

function createMockControls() {
  return {
    target: new THREE.Vector3(),
    enableDamping: true,
    enablePan: true,
    minDistance: 2,
    maxDistance: 2000,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI / 2,
    update() {},
    saveState() {},
    reset() {},
  };
}

test('AnimeCharacter supports 3 color palettes and articulates smoothly across idle/walk/jump', () => {
  const ch = new AnimeCharacter('teal');
  assert.equal(ch.getPaletteId(), 'teal');

  const box = new THREE.Box3().setFromObject(ch.root);
  const height = box.max.y - box.min.y;
  assert.ok(height >= 1.5 && height <= 2.0, `anime character height should be ~1.68m, got ${height}`);

  for (const id of Object.keys(CHARACTER_PALETTES)) {
    ch.setPalette(id);
    assert.equal(ch.getPaletteId(), id);
  }

  // 验证待机、奔跑、跳跃动画无 NaN
  ch.updateAnimation(0.016, { speed: 0, maxSpeed: 9.5, verticalVel: 0, grounded: true, sprinting: false });
  ch.updateAnimation(0.016, { speed: 8.5, maxSpeed: 9.5, verticalVel: 0, grounded: true, sprinting: true });
  ch.updateAnimation(0.016, { speed: 3.0, maxSpeed: 9.5, verticalVel: 5.0, grounded: false, sprinting: false });
  ch.updateAnimation(0.016, { speed: 0, maxSpeed: 9.5, verticalVel: 0, grounded: true, sprinting: false });
  assert.ok(Number.isFinite(ch.root.position.y));
  ch.dispose();
});

test('PhysicsWorld enforces ground support, blocks walking through building walls, and loads all 2891 Overture colliders', async () => {
  const pw = await PhysicsWorld.create({ x: 0, y: 0, z: 0 });
  try {
    // 1. 重力测试：向下推动时停在地面 y = 0，不会跌落地下
    const groundStep = pw.moveCharacter(0, -1.5, 0);
    assert.ok(groundStep.y >= 0 && groundStep.y < 0.05, `expected foot on ground, got y=${groundStep.y}`);
    assert.equal(groundStep.grounded, true);

    // 2. 建筑墙体碰撞测试：在 z ∈ [-8, -2] 放置建筑，向北 (-Z) 走 5 米必须被墙挡住
    pw.setBuildingColliders([
      {
        id: 'test-wall-building',
        outline_local: [[-5, -8], [5, -8], [5, -2], [-5, -2]],
        modelHeight: 6,
      },
    ]);
    let hitWall = false;
    for (let i = 0; i < 40; i++) {
      const r = pw.moveCharacter(0, -0.02, -0.15);
      if (r.collidedHorizontal) hitWall = true;
    }
    const pos = pw.getFootPosition();
    assert.ok(hitWall, 'character must detect horizontal collision against building wall');
    assert.ok(pos.z > -2.05, `character must not pass through building wall at z=-2, got z=${pos.z}`);

    // 3. 全量 Overture 2891 栋建筑 Trimesh 碰撞体加载测试
    const manifest = JSON.parse(
      readFileSync(new URL('../public/models/wuxing-street/manifest-overture.json', import.meta.url), 'utf8'),
    );
    const { vertices, indices } = buildBuildingTrimeshBuffers(manifest.buildings);
    assert.ok(vertices.length > 50000, `expected >50k vertex floats, got ${vertices.length}`);
    assert.ok(indices.length > 50000, `expected >50k index entries, got ${indices.length}`);

    pw.teleport(0, 0, 0);
    const registered = pw.setBuildingColliders(manifest.buildings);
    assert.equal(registered, 2891);
  } finally {
    pw.dispose();
  }
});

test('PlayerController defaults to walk mode, handles WASD/sprint/jump arc, and toggles overview mode', async () => {
  const pw = await PhysicsWorld.create({ x: 0, y: 0, z: 0 });
  const ch = new AnimeCharacter('teal');
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.25, 8000);
  const controls = createMockControls();
  const modeLog = [];

  const controller = new PlayerController({
    character: ch,
    physics: pw,
    camera,
    controls,
    spawn: { x: 0, y: 0, z: 0 },
    initialMode: 'walk',
    bindKeyboard: false,
    onModeChange: m => modeLog.push(m),
  });

  try {
    assert.equal(controller.getMode(), 'walk');
    assert.deepEqual(modeLog, ['walk']);

    // 前进 (W)：相机默认在 +Z 看 -Z，前进应使 z < 0
    controller.setInputState({ forward: true, sprint: false });
    for (let i = 0; i < 30; i++) controller.update(1 / 60);
    const afterWalk = controller.getPosition();
    assert.ok(afterWalk.z < -1.5, `walking forward should move north (-Z), got z=${afterWalk.z}`);

    // 跳跃 (Space)：跳起峰值应 > 1.0 m，随后受重力落回地面 y ≈ 0
    controller.setInputState({ forward: false, jump: true });
    let maxY = 0;
    for (let i = 0; i < 70; i++) {
      controller.update(1 / 60);
      maxY = Math.max(maxY, controller.getPosition().y);
      if (i === 5) controller.setInputState({ jump: false });
    }
    const afterLand = controller.getPosition();
    assert.ok(maxY > 1.0, `jump peak height should exceed 1.0m, got ${maxY}`);
    assert.ok(afterLand.y < 0.05, `character should land back on ground, got y=${afterLand.y}`);
    assert.equal(controller.getState().grounded, true);

    // 切换鸟瞰模式 (V)
    assert.equal(controller.toggleMode(), 'overview');
    assert.ok(camera.position.y > 500, 'overview camera should elevate to bird-eye height');
    assert.equal(controller.toggleMode(), 'walk');
    assert.ok(camera.position.y < 20, 'walk camera should return to third-person follow height');
  } finally {
    controller.dispose();
    ch.dispose();
    pw.dispose();
  }
});
