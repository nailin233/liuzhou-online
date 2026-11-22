import './style.css';
import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { setupLighting } from './lighting';
import { loadWuxingBuildings, disposeBuildings } from './WuxingBuildings';
import { loadRoadNetwork, disposeRoads } from './RoadNetwork';
import { loadWaterNetwork, disposeWater } from './WaterNetwork';
import { createMapGround } from './MapGround';
import { MapHUD } from './MapHUD';

// ── HTML 骨架 ──────────────────────────────────────────────────────────────────
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <header class="header">
    <span class="mark">LZ<span class="dot">.</span>OL</span>
    <span class="version">M01 · 五星街</span>
  </header>
  <section class="panel">
    <div class="eyebrow">LIUZHOU ONLINE</div>
    <h1>网上柳州</h1>
    <p>五星街周边，建筑与道路来自 OpenStreetMap。<br>
       灰紫斜纹为缺失高度的建筑（3 m 占位）。</p>
    <p class="hint">拖动旋转 · 滚轮缩放 · 右键平移 · <kbd>L</kbd> 图例 · <kbd>N</kbd> 朝北</p>
    <button id="reset-view" type="button">重置视角</button>
  </section>
  <div class="viewport" id="viewport"></div>
`;

// ── 场景初始化 ─────────────────────────────────────────────────────────────────
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const scene = new SceneManager({ container: viewport });

setupLighting(scene.scene);
const ground = createMapGround();
scene.add(ground);

const hud = new MapHUD(document.body);

document.querySelector<HTMLButtonElement>('#reset-view')!.addEventListener('click', () => {
  scene.controls.enableDamping = false;
  scene.controls.update();
  scene.controls.reset();
  scene.controls.enableDamping = true;
});

document.addEventListener('keydown', e => {
  if (e.key === 'n' || e.key === 'N') {
    const dist = scene.camera.position.distanceTo(scene.controls.target);
    scene.camera.position.set(
      scene.controls.target.x,
      scene.controls.target.y + dist * Math.sin(Math.PI / 4),
      scene.controls.target.z + dist * Math.cos(Math.PI / 4),
    );
    scene.controls.update();
  }
});

// ── 异步加载地图数据 ────────────────────────────────────────────────────────────
let disposed = false;
let buildingGroup: THREE.Group | null = null;
let roadGroup:     THREE.Group | null = null;
let waterGroup:    THREE.Group | null = null;
let buildingsTotal = 0, buildingsMissing = 0, roadsTotal = 0, _dataSource = '';

(async () => {
  try {
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

    buildingsTotal   = buildResult.stats.total;
    buildingsMissing = buildResult.stats.missing;
    roadsTotal       = rGroup.children.length;
    // 记录数据源（供 HUD 显示）
    _dataSource = buildResult.stats.source;
  } catch (err) {
    console.error('地图加载失败', err);
  }
})();

// ── 渲染循环 ────────────────────────────────────────────────────────────────────
let frames = 0, lastFps = performance.now();

scene.startRendering(() => {
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
    });
    hud.updateCompass(scene.camera, scene.controls);
  }
});

// ── HMR 清理 ────────────────────────────────────────────────────────────────────
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    scene.stopRendering();
    if (buildingGroup) disposeBuildings(buildingGroup);
    if (roadGroup)     disposeRoads(roadGroup);
    if (waterGroup)    disposeWater(waterGroup);
    hud.dispose();
    scene.dispose();
  });
}
