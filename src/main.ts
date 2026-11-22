import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { resizeViewport } from './viewport.js';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');
app.innerHTML = `
  <header class="header"><span class="mark">LZ<span class="dot">.</span>OL</span><span class="version">PRE-ALPHA 0.1</span></header>
  <section class="panel"><div class="eyebrow">LIUZHOU ONLINE</div><h1>网上柳州</h1>
  <p>三维引擎已初始化。当前是工程校验场景，<strong>不是柳州真实地图</strong>。</p>
  <p class="hint">拖动旋转视角 · 滚轮缩放 · 鼠标右键平移</p>
  <button id="reset-view" type="button">重置视角</button></section>
  <div class="status" id="status">正在初始化…</div><div class="viewport" id="viewport"></div>`;
const mount = document.querySelector<HTMLDivElement>('#viewport')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
mount.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);
scene.fog = new THREE.Fog(0x101820, 45, 115);
const camera = new THREE.PerspectiveCamera(55, 1, .1, 250);
camera.position.set(18, 20, 23);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.update();
controls.saveState();
document.querySelector<HTMLButtonElement>('#reset-view')!.addEventListener('click', () => {
  // Consume the remaining drag inertia before restoring the saved pose.
  controls.enableDamping = false;
  controls.update();
  controls.reset();
  controls.enableDamping = true;
});
scene.add(new THREE.HemisphereLight(0xbcd2e0, 0x293744, 2.2));
const sun = new THREE.DirectionalLight(0xffe0b5, 2.1);
sun.position.set(-10, 25, 8); scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x17232c, roughness: .9 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const grid = new THREE.GridHelper(160, 80, 0x284454, 0x203340); grid.position.y = .012; scene.add(grid);
const material = new THREE.MeshStandardMaterial({ color: 0x3e8f91, roughness: .75 });
for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
  if ((i * 5 + j * 2) % 4 === 0) continue;
  const height = 1.4 + (((i + 9) * 7 + (j + 9) * 11) % 7) * .65;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.45, height, 1.45), material);
  box.position.set(i * 3.5, height / 2, j * 3.5);
  scene.add(box);
}
const status = document.querySelector<HTMLElement>('#status')!;
let frames = 0; let last = performance.now();
let needsResize = true;
let hasViewport = false;
new ResizeObserver(() => { needsResize = true; }).observe(mount);
function animate(now: number) {
  requestAnimationFrame(animate);
  if (needsResize) {
    hasViewport = resizeViewport(renderer, camera, mount.clientWidth, mount.clientHeight, window.devicePixelRatio);
    needsResize = false;
  }
  if (!hasViewport) return;
  controls.update();
  renderer.render(scene, camera);
  frames++;
  if (now - last >= 1000) {
    status.textContent = `WebGL 正常 · ${Math.round(frames * 1000 / (now - last))} FPS · 测试白模`;
    frames = 0; last = now;
  }
}
requestAnimationFrame(animate);
