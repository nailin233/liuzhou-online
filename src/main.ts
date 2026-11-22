import './style.css';
import { SceneManager } from './SceneManager';
import { setupLighting } from './lighting';
import { DemoScene } from './DemoScene';

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
    <p>三维引擎已初始化。当前是工程校验场景，<strong>不是柳州真实地图</strong>。</p>
    <p class="hint">拖动旋转视角 · 滚轮缩放 · 鼠标右键平移</p>
    <button id="reset-view" type="button">重置视角</button>
  </section>
  <div class="status" id="status">正在初始化…</div>
  <div class="viewport" id="viewport"></div>
`;

const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const statusElement = document.querySelector<HTMLElement>('#status')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset-view')!;

// 初始化场景管理器
const sceneManager = new SceneManager({
  container: viewport,
  backgroundColor: 0x101820,
  enableFog: true,
  fogColor: 0x101820,
  fogNear: 45,
  fogFar: 115,
});

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

// 创建演示场景
const demoScene = new DemoScene({
  buildingColor: 0x3e8f91,
  buildingRoughness: 0.75,
  floorColor: 0x17232c,
  floorRoughness: 0.9,
});

const demoObjects = demoScene.create();
sceneManager.add(...demoObjects);

// FPS 计数器
let frames = 0;
let lastFpsUpdate = performance.now();

// 开始渲染循环
sceneManager.startRendering((_delta, _elapsed) => {
  frames++;
  
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    const fps = Math.round(frames * 1000 / (now - lastFpsUpdate));
    statusElement.textContent = `WebGL 正常 · ${fps} FPS · 测试白模`;
    frames = 0;
    lastFpsUpdate = now;
  }
});

// 开发环境下的清理 (热重载)
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sceneManager.stopRendering();
    demoScene.dispose();
    sceneManager.dispose();
  });
}
