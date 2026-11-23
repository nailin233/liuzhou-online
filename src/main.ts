import './style.css';
import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { SkyAtmosphere, ATMOSPHERE_PRESETS, type AtmospherePresetId } from './SkyAtmosphere';
import { loadWuxingBuildings, disposeBuildings, type BuildingStyleController } from './WuxingBuildings';
import { loadRoadNetwork, disposeRoads, type RoadStyleController } from './RoadNetwork';
import { loadWaterNetwork, disposeWater, type WaterStyleController } from './WaterNetwork';
import { createMapGround } from './MapGround';
import { StreetProps } from './StreetProps';
import { MapHUD } from './MapHUD';
import { AnimeCharacter, CHARACTER_PALETTES, type CharacterPaletteId } from './AnimeCharacter';
import { PhysicsWorld } from './PhysicsWorld';
import { PlayerController, type CameraMode } from './PlayerController';

// ── HTML 骨架 ──────────────────────────────────────────────────────────────────
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

const paletteButtonsHtml = Object.values(CHARACTER_PALETTES)
  .map((p, idx) => `
    <button type="button" class="pill-btn palette-btn${idx === 0 ? ' active' : ''}" data-palette="${p.id}" aria-pressed="${idx === 0}">
      <span class="palette-dot" style="background:${p.swatchHex}"></span>${p.label}
    </button>`)
  .join('');

const atmosphereButtonsHtml = Object.values(ATMOSPHERE_PRESETS)
  .map((p, idx) => `
    <button type="button" class="pill-btn atmo-btn${idx === 0 ? ' active' : ''}" data-atmo="${p.id}" aria-pressed="${idx === 0}">
      ${p.label}
    </button>`)
  .join('');

app.innerHTML = `
  <header class="header" id="main-header">
    <span class="mark">LZ<span class="dot">.</span>OL</span>
    <span class="version">M02+ · 五星街晴日漫游</span>
  </header>
  <section class="panel" id="main-panel">
    <div class="eyebrow">LIUZHOU ONLINE</div>
    <h1>网上柳州</h1>
    <p>五星街真实地理轮廓（Overture + OpenStreetMap）；行道洋紫荆与窗格为街景氛围示意，切「数据检视」可查缺失高度。</p>
    <p class="hint"><kbd>WASD</kbd> 移动 · <kbd>Shift</kbd> 奔跑 · <kbd>Space</kbd> 跳跃 · <kbd>C</kbd> 三视角 · <kbd>V</kbd> 鸟瞰 · <kbd>H</kbd> 纯净录屏 · <kbd>R</kbd> 脱困</p>
    <div class="panel-actions">
      <button id="toggle-mode" class="action-btn primary" type="button">切换鸟瞰 [V]</button>
      <button id="cycle-cam" class="action-btn" type="button">视角 [C]</button>
      <button id="clean-mode" class="action-btn" type="button">录屏纯净 [H]</button>
      <button id="reset-view" class="action-btn" type="button">复位 [R]</button>
    </div>
    <div class="pill-bar" id="atmosphere-switcher" role="group" aria-label="昼夜氛围">
      <span class="pill-label">时段</span>
      ${atmosphereButtonsHtml}
    </div>
    <div class="pill-bar" id="palette-switcher" role="group" aria-label="角色配色">
      <span class="pill-label">配色</span>
      ${paletteButtonsHtml}
    </div>
  </section>
  <button id="clean-restore" class="clean-restore-btn" type="button">恢复界面 [H]</button>
  <div class="viewport" id="viewport"></div>
`;

// ── 场景、24H 天空与动漫角色初始化 ──────────────────────────────────────────────
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const scene = new SceneManager({ container: viewport });

const atmosphere = new SkyAtmosphere(scene.scene, scene.renderer, 'day');
const groundRes = createMapGround();
scene.add(groundRes.group);

const character = new AnimeCharacter('teal');
scene.add(character.root);

let player: PlayerController | null = null;
let physics: PhysicsWorld | null = null;
let streetProps: StreetProps | null = null;
let buildingStyle: BuildingStyleController | null = null;
let roadStyle: RoadStyleController | null = null;
let waterStyle: WaterStyleController | null = null;
let currentMode: CameraMode = 'walk';
let currentAtmo: AtmospherePresetId = 'day';
let cleanMode = false;
let colliderCount = 0;

const headerEl       = document.querySelector<HTMLElement>('#main-header')!;
const panelEl        = document.querySelector<HTMLElement>('#main-panel')!;
const cleanRestoreEl = document.querySelector<HTMLButtonElement>('#clean-restore')!;
const toggleModeBtn  = document.querySelector<HTMLButtonElement>('#toggle-mode')!;
const cycleCamBtn    = document.querySelector<HTMLButtonElement>('#cycle-cam')!;
const cleanModeBtn   = document.querySelector<HTMLButtonElement>('#clean-mode')!;
const resetViewBtn   = document.querySelector<HTMLButtonElement>('#reset-view')!;

function updateModeButton(mode: CameraMode): void {
  currentMode = mode;
  toggleModeBtn.textContent = mode === 'walk' ? '切换鸟瞰 [V]' : '返回步行 [V]';
}

function applyAtmosphere(id: AtmospherePresetId): void {
  currentAtmo = id;
  const preset = atmosphere.setPreset(id);
  const isAudit = id === 'audit';
  groundRes.styleController.setPreset(id);
  buildingStyle?.setVisualMode(isAudit, preset.nightGlow);
  roadStyle?.setVisualMode(isAudit);
  waterStyle?.setPreset(id);
  streetProps?.setAtmosphere(preset.nightGlow, !isAudit);

  for (const b of atmoBtns) {
    const active = b.dataset.atmo === id;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  }
}

function setCleanMode(hidden: boolean): void {
  cleanMode = hidden;
  headerEl.style.display = hidden ? 'none' : '';
  panelEl.style.display  = hidden ? 'none' : '';
  cleanRestoreEl.style.display = hidden ? 'block' : 'none';
  hud.setCleanMode(hidden);
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

// ── 按钮事件（点击后主动 blur，防止焦点拦截 WASD/Space 等快捷键）────────────────
const atmoBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#atmosphere-switcher .atmo-btn'));
for (const btn of atmoBtns) {
  btn.addEventListener('click', () => {
    applyAtmosphere(btn.dataset.atmo as AtmospherePresetId);
    btn.blur();
  });
}

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
    btn.blur();
  });
}

toggleModeBtn.addEventListener('click', () => { player?.toggleMode(); toggleModeBtn.blur(); });
cycleCamBtn.addEventListener('click',   () => { player?.cycleWalkCameraPreset(); cycleCamBtn.blur(); });
cleanModeBtn.addEventListener('click',  () => { setCleanMode(true); cleanModeBtn.blur(); });
cleanRestoreEl.addEventListener('click',() => { setCleanMode(false); cleanRestoreEl.blur(); });
resetViewBtn.addEventListener('click',  () => {
  if (player) player.reset();
  else {
    scene.controls.enableDamping = false;
    scene.controls.reset();
    scene.controls.update();
    scene.controls.enableDamping = true;
  }
  resetViewBtn.blur();
});

const onKeyDown = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'n' || e.key === 'N') orientNorth();
  if ((e.key === 'h' || e.key === 'H') && !e.repeat) setCleanMode(!cleanMode);
};
document.addEventListener('keydown', onKeyDown);

// ── 异步初始化 Rapier 物理 + 地图数据 + 柳州洋紫荆街景 ──────────────────────────
let disposed = false;
let buildingGroup: THREE.Group | null = null;
let roadGroup:     THREE.Group | null = null;
let waterGroup:    THREE.Group | null = null;
let buildingsTotal = 0, buildingsMissing = 0, roadsTotal = 0, _dataSource = '';

(async () => {
  try {
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

    const [buildResult, roadResult, waterResult] = await Promise.all([
      loadWuxingBuildings(),
      loadRoadNetwork(),
      loadWaterNetwork(),
    ]);
    if (disposed) {
      disposeBuildings(buildResult.group);
      disposeRoads(roadResult.group);
      disposeWater(waterResult.group);
      return;
    }

    buildingGroup = buildResult.group;
    roadGroup     = roadResult.group;
    waterGroup    = waterResult.group;
    buildingStyle = buildResult.styleController;
    roadStyle     = roadResult.styleController;
    waterStyle    = waterResult.styleController;

    buildingGroup.traverse(o => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    scene.add(buildingGroup, roadGroup, waterGroup);

    // 沿真实 OSM 道路边缘铺设柳州洋紫荆行道树与路灯（InstancedMesh 仅 5 Draw Calls）
    streetProps = new StreetProps(roadResult.roads, buildResult.footprints);
    scene.add(streetProps.group);

    // 注册 2891 栋建筑碰撞体到 Rapier
    colliderCount = pw.setBuildingColliders(buildResult.footprints);

    // 同步当前昼夜氛围到刚加载的图层
    applyAtmosphere(currentAtmo);

    buildingsTotal   = buildResult.stats.total;
    buildingsMissing = buildResult.stats.missing;
    roadsTotal       = (roadGroup.userData.roadCount as number) ?? roadResult.roads.length;
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
  const focus = player ? player.getPosition() : { x: scene.controls.target.x, z: scene.controls.target.z };
  atmosphere.update(delta, focus);
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
      timeLabel:        atmosphere.getPreset().timeLabel,
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
    streetProps?.dispose();
    atmosphere.dispose();
    if (buildingGroup) disposeBuildings(buildingGroup);
    if (roadGroup)     disposeRoads(roadGroup);
    if (waterGroup)    disposeWater(waterGroup);
    hud.dispose();
    scene.dispose();
  });
}
