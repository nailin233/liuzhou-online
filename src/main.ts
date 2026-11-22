import './style.css';
import { disposeBuildings, loadWuxingBuildings } from './WuxingBuildings';
import type { Group } from 'three';
import { SceneManager } from './SceneManager';
import { setupLighting } from './lighting';
import { DemoScene } from './DemoScene';

const showBuildings = new URLSearchParams(location.search).get('view') === 'buildings';

// 初始化 HTML 结构
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <header class="header">
    <span class="mark">LZ<span class="dot">.</span>OL</span>
    <span class="version">PRE-ALPHA 0.1</span>
  </header>
  <section class="panel">
    <div class="eyebrow">LIUZHOU ONLINE</div>
    <h1>网上柳州</h1>
    ${showBuildings
      ? '<p>五星街建筑轮廓来自 OpenStreetMap。灰紫色斜纹表示高度缺失，模型统一高 3 米。</p>'
      : '<p>三维引擎已初始化。当前是工程校验场景，<strong>不是柳州真实地图</strong>。</p>'}
    <p class="hint">拖动旋转视角 · 滚轮缩放 · 鼠标右键平移</p>
    <button id="reset-view" type="button">重置视角</button>
  </section>
  <div class="status" id="status">正在初始化…</div>
  ${showBuildings ? '<a class="attribution" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL 1.0</a>' : ''}
  <div class="viewport" id="viewport"></div>
`;

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const statusElement = document.querySelector<HTMLElement>('#status')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-view')!;

// 初始化场景管理器
const sceneManager = new SceneManager({
  container: viewport,
  backgroundColor: 0x101820,
  enableFog: !showBuildings,
  fogColor: 0x101820,
  fogNear: 45,
  fogFar: 115,
});

if (showBuildings) {
  sceneManager.camera.far = 3000;
  const aspect = Math.min(1, sceneManager.camera.aspect);
  sceneManager.camera.position.set(0, 460 / aspect, 540 / aspect);
  sceneManager.camera.updateProjectionMatrix();
  sceneManager.controls.update();
}

// 保存初始相机状态（用于重置）
sceneManager.controls.saveState();

// 重置视角按钮
resetButton.addEventListener('click', () => {
  // 消耗剩余的拖动惯性，然后恢复保存的姿态
  sceneManager.controls.enableDamping = false;
  sceneManager.controls.update();
  sceneManager.controls.reset();
  sceneManager.controls.enableDamping = true;
});

// 设置光照
setupLighting(sceneManager.scene);

let buildings: Group | undefined;
let demoScene: DemoScene | undefined;
let disposed = false;
let status = '测试白模';
if (showBuildings) {
  status = '正在加载五星街建筑…';
  loadWuxingBuildings().then(group => {
    if (disposed) {
      disposeBuildings(group);
      return;
    }
    buildings = group;
    sceneManager.add(group);
    status = `高度缺失 ${group.children.length} / ${group.children.length} 栋 · 3 m 占位`;
    statusElement.textContent = status;
  }).catch(error => {
    status = `建筑加载失败 · ${error.message}`;
    if (!disposed) statusElement.textContent = status;
  });
} else {
  demoScene = new DemoScene();
  sceneManager.add(...demoScene.create());
}

// FPS 计数器
let frames = 0;
let lastFpsUpdate = performance.now();

// 开始渲染循环
sceneManager.startRendering((_delta, _elapsed) => {
  frames++;
  
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    const fps = Math.round(frames * 1000 / (now - lastFpsUpdate));
    statusElement.textContent = `WebGL 正常 · ${fps} FPS · ${status}`;
    frames = 0;
    lastFpsUpdate = now;
  }
});

// 开发环境下的清理 (热重载)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneManager.stopRendering();
    disposed = true;
    demoScene?.dispose();
    if (buildings) disposeBuildings(buildings);
    sceneManager.dispose();
  });
}
