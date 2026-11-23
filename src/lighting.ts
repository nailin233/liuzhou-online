/**
 * lighting — 按 art-direction.md §3.2「午后」默认光照
 */
import * as THREE from 'three';

export function setupLighting(scene: THREE.Scene): void {
  // 半球光：天空 #BCD2E0，地面 #293744，强度 1.6
  const hemi = new THREE.HemisphereLight(0xBCD2E0, 0x293744, 1.6);
  scene.add(hemi);

  // 平行光（太阳）：方位角 225°（西南），高度角 50°
  const sun = new THREE.DirectionalLight(0xFFE0B5, 2.4);
  sun.position.set(-455, 765, 455);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 2048;
  sun.shadow.mapSize.height = 2048;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -900;
  sc.right = sc.top = 900;
  sc.near = 50;
  sc.far  = 2500;
  sun.shadow.bias       = -0.0005;
  sun.shadow.normalBias = 0.5;
  scene.add(sun);
}
