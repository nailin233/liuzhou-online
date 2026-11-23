import './style.css';
import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { setupLighting } from './lighting';
import { loadWuxingBuildings, disposeBuildings } from './WuxingBuildings';
import { loadRoadNetwork, disposeRoads } from './RoadNetwork';
import { loadWaterNetwork, disposeWater } from './WaterNetwork';
import { createMapGround } from './MapGround';
import { MapHUD } from './MapHUD';
import { AnimeCharacter, CHARACTER_PALETTES, type CharacterPaletteId } from './AnimeCharacter';
import { PhysicsWorld } from './PhysicsWorld';
import { PlayerController, type CameraMode } from './PlayerController';

// ── HTML 骨架 ──────────────────────────────────────────────────────────────────
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

const paletteButtonsHtml = (Object.values(CHARACTER_PALETTES))
  .map((p, idx) => `
    <button type="button" class="palette-btn${idx === 0 ? ' active' : ''}" data-palette="${p.id}" aria-pressed="${idx === 0}">
      <span class="palette-dot" style="background:${p.swatchHex}"></span>${p.label}
    </button>`)
  .join('');

app.innerHTML = `
  <header class="header">
    <span class="mark">LZ<span class="dot">.</span>OL</span>
    <span class="version">M02 · 五星街漫游</span>
  </header>
  <section class="panel">
    <div class="eyebrow">LIUZHOU ONLINE</div>
    <h1>网上柳州</h1>
    <p>五星街周边，建筑来自 Overture Maps（OSM + ML）及 OpenStreetMap，道路与水系来自 OpenStreetMap。<br>
       灰紫斜纹为缺失高度的建筑（3 m 占位）；柳江以中心线示意，未还原实际岸线。</p>
    <p class="hint"><kbd>WASD</kbd> 移动 · <kbd>Shift</kbd> 奔跑 · <kbd>Space</kbd> 跳跃 · <kbd>V</kbd> 切换鸟瞰 · <kbd>L</kbd> 图例 · <kbd>N</kbd> 朝北</p>
    <div class="panel-actions">
      <button id="toggle-mode" class="action-btn primary" type="button">切换鸟瞰 [V]</button>
      <button id="reset-view" class="action-btn" type="button">重置位置</button>
    </div>
    <div class="palette-bar" id="palette-switcher" role="group" aria-label="角色配色">
      <span class="palette-label">角色配色</span>
      ${paletteButtonsHtml}
    </div>
  </section>
  <div class="viewport" id="viewport"></div>
`;

// ── 场景与动漫角色初始化 ────────────────────────────────────────────────────────
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const scene = new SceneManager({ container: viewport });

setupLighting(scene.scene);
const ground = createMapGround();
scene.add(ground);

const character = new AnimeCharacter('teal');
scene.add(character.root);

let player: PlayerController | null = null;
let physics: PhysicsWorld | null = null;
let currentMode: CameraMode = 'walk';
let colliderCount = 0;

const toggleModeBtn = document.querySelector<HTMLButtonElement>('#toggle-mode')!;
const resetViewBtn  = document.querySelector<HTMLButtonElement>('#reset-view')!;

function updateModeButton(mode: CameraMode): void {
  currentMode = mode;
  toggleModeBtn.textContent = mode === 'walk' ? '切换鸟瞰 [V]' : '返回步行 [V]';
}

function orientNorth(): void {
  if (player) {
    player.orientNorth();
    return;
  }
  const dist = scene.camera.position.distanceTo(scene.controls.target);
  const offset = new THREE.Vector3().subVectors(scene.camera.position, scene.controls.target);
  const polar = THREE.MathUtils.clamp(
    Math.acos(THREE.MathUtils.clamp(offset.y / Math.max(dist, 1), -1, 1)),
    0.2,
    Math.PI / 2 - 0.05,
  );
  scene.controls.enableDamping = false;
  scene.camera.position.set(
    scene.controls.target.x,
    scene.controls.target.y + dist * Math.cos(polar),
    scene.controls.target.z + dist * Math.sin(polar),
  );
  scene.controls.update();
  scene.controls.enableDamping = true;
}

const hud = new MapHUD(document.body, {
  onCompassClick: orientNorth,
});

// 配色一键切换
const paletteBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#palette-switcher .palette-btn'));
for (const btn of paletteBtns) {
  btn.addEventListener('click', () => {
    const id = btn.dataset.palette as CharacterPaletteId;
    character.setPalette(id);
    for (const b of paletteBtns) {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    }
  });
}

toggleModeBtn.addEventListener('click', () => {
  player?.toggleMode();
});

resetViewBtn.addEventListener('click', () => {
  if (player) {
    player.reset();
    return;
  }
  scene.controls.enableDamping = false;
  scene.controls.reset();
  scene.controls.update();
  scene.controls.enableDamping = true;
});

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'n' || e.key === 'N') orientNorth();
};
document.addEventListener('keydown', onKeyDown);

// ── 异步初始化 Rapier 物理 + 地图数据 ───────────────────────────────────────────
let disposed = false;
let buildingGroup: THREE.Group | null = null;
let roadGroup:     THREE.Group | null = null;
let waterGroup:    THREE.Group | null = null;
let buildingsTotal = 0, buildingsMissing = 0, roadsTotal = 0, _dataSource = '';

(async () => {
  try {
    // 先启动 Rapier 地面碰撞与默认第三人称步行控制器，让角色立即可玩
    const pw = await PhysicsWorld.create({ x: 0, y: 0, z: 0 });
    if (disposed) {
      pw.dispose();
      return;
    }
    physics = pw;
    player = new PlayerController({
      character,
      physics: pw,
      camera: scene.camera,
      controls: scene.controls,
      spawn: { x: 0, y: 0, z: 0 },
      initialMode: 'walk',
      onModeChange: updateModeButton,
    });
    updateModeButton(player.getMode());

    // 并行加载建筑、道路、水系
    const [buildResult, rGroup, wGroup] = await Promise.all([
      loadWuxingBuildings(),
      loadRoadNetwork(),
      loadWaterNetwork(),
    ]);
    if (disposed) {
      disposeBuildings(buildResult.group);
      disposeRoads(rGroup);
      disposeWater(wGroup);
      return;
    }

    buildingGroup = buildResult.group;
    roadGroup     = rGroup;
    waterGroup    = wGroup;

    buildingGroup.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    scene.add(buildingGroup, roadGroup, waterGroup);

    // 注册 2891 栋建筑精确多边形碰撞体到 Rapier
    colliderCount = pw.setBuildingColliders(buildResult.footprints);

    buildingsTotal   = buildResult.stats.total;
    buildingsMissing = buildResult.stats.missing;
    roadsTotal       = (rGroup.userData.roadCount as number) ?? rGroup.children.length;
    _dataSource      = buildResult.stats.source;
    hud.setAttributionForSource(_dataSource);
  } catch (err) {
    console.error('地图或物理系统加载失败', err);
    hud.showError(err instanceof Error ? err.message : String(err));
  }
})();

// ── 渲染循环 ────────────────────────────────────────────────────────────────────
let frames = 0, lastFps = performance.now();

scene.startRendering((delta) => {
  player?.update(delta);
  hud.updateCompass(scene.camera, scene.controls);

  frames++;
  const now = performance.now();
  if (now - lastFps >= 1000) {
    const fps = Math.round(frames * 1000 / (now - lastFps));
    frames = 0; lastFps = now;
    const info = scene.renderer.info;
    hud.update({
      fps,
      drawCalls:        info.render.calls,
      triangles:        info.render.triangles,
      buildingsTotal,
      buildingsMissing,
      roadsTotal,
      dataSource:       _dataSource,
      mode:             currentMode,
      colliders:        colliderCount,
    });
  }
});

// ── HMR 清理 ────────────────────────────────────────────────────────────────────
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    document.removeEventListener('keydown', onKeyDown);
    scene.stopRendering();
    player?.dispose();
    physics?.dispose();
    character.dispose();
    if (buildingGroup) disposeBuildings(buildingGroup);
    if (roadGroup)     disposeRoads(roadGroup);
    if (waterGroup)    disposeWater(waterGroup);
    hud.dispose();
    scene.dispose();
  });
}
