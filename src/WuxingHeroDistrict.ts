/**
 * WuxingHeroDistrict — 柳州五星步行街核心广场精建区（对照 2018–2026 现代实景照片重建）
 *
 * 严格锚定真实 OSM 坐标（原点 node/6038500119）：
 *  - 「柳州五星」雕塑广场中心：(-55.83, 139.09)
 *  - 五星商业大厦（五星商贸大厦）：x=[-114.5,-46.4], z=[153.3,234.5]
 *  - 东都大厦 & 转角雨棚：x=[-56.3,-4.6], z=[63.0,122.2]
 *  - 柳州购书中心（新华书店）：x=[-40.3,-2.9], z=[138.8,175.1]
 *  - 工贸大厦：x=[-206.5,-116.7], z=[63.6,137.9]
 *  - 远景喀斯特峰林（马鞍山 / 鱼峰山 / 蟠龙山真实方位）
 *
 * 切换至「数据检视 (audit)」模式时整组自动隐藏，由 WuxingBuildings 显示纯 3m 工程白模。
 */
import * as THREE from 'three';

export const HERO_BUILDING_IDS = new Set<string>([
  '36b5d00d-8b11-4a4b-97b7-9eb6cef68bbf', // 五星商贸大厦 (五星商业大厦)
  '32b9196f-fa5b-4f6a-b69c-dbea0ce84df9', // 东都大厦
  '1dddc532-c923-45a5-8735-0cfad6a0b519', // 东都转角雨棚建筑
  'ade80676-78ea-422e-a0d0-05f8b30686bc', // 新华书店 (柳州购书中心)
  '4cf3ecb6-3686-4bb8-a436-a803f6197c8a', // 工贸大厦
]);

export const WUXING_PLAZA_CENTER = { x: -55.83, z: 139.09 };
export const WUXING_HERO_SPAWN   = { x: -56.0, y: 0, z: 126.5 };

/** 创建文字牌面贴图（仅浏览器环境，Node 单测安全降级） */
function makeSignCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 构造真实 5.88m「柳州五星」分裂式红岩+红金属雕塑 + 8m 圆形石材围坐广场基座 */
function buildRealFiveStarSculpture(nightLights: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'real-liuzhou-five-star-sculpture';
  g.position.set(WUXING_PLAZA_CENTER.x, 0, WUXING_PLAZA_CENTER.z);

  // 1. 直径 8m 暖黄毛面石材圆形围坐圈（现代改造后无水盆，带内部绿化灌木）
  const ochreStoneMat = new THREE.MeshStandardMaterial({ color: 0xC6A97E, roughness: 0.86, metalness: 0.02 });
  const innerBedMat   = new THREE.MeshStandardMaterial({ color: 0x4A5448, roughness: 0.95 });
  const darkGranite   = new THREE.MeshStandardMaterial({ color: 0x1E2328, roughness: 0.42, metalness: 0.18 });
  const shrubMat      = new THREE.MeshStandardMaterial({ color: 0x3F7C42, roughness: 0.85 });

  // 外圈圆环坐凳（外径 4.0m，内径 3.35m，高 0.46m）
  const ringShape = new THREE.Shape();
  ringShape.absarc(0, 0, 4.0, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 3.35, 0, Math.PI * 2, true);
  ringShape.holes.push(hole);
  const ringGeo = new THREE.ExtrudeGeometry(ringShape, { depth: 0.46, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, curveSegments: 36 });
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, ochreStoneMat);
  ringMesh.castShadow = true;
  ringMesh.receiveShadow = true;
  g.add(ringMesh);

  // 内部低台底面
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(3.38, 3.38, 0.24, 32), innerBedMat);
  bed.position.y = 0.12;
  bed.receiveShadow = true;
  g.add(bed);

  // 夜景底座蓝光灯带（实景照片 #5 底座沿边冷蓝光）
  const blueRimMat = new THREE.MeshStandardMaterial({
    color: 0x38B6FF,
    emissive: 0x269BFF,
    emissiveIntensity: 0.15,
    roughness: 0.2,
  });
  nightLights.push(blueRimMat);
  const blueRim = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.045, 8, 32), blueRimMat);
  blueRim.rotation.x = Math.PI / 2;
  blueRim.position.y = 0.30;
  g.add(blueRim);

  // 2. 黑金沙横槽八角花岗岩基座（总高 ~1.58m）
  for (let tier = 0; tier < 4; tier++) {
    const r = 2.05 - tier * 0.14;
    const h = 0.34;
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.05, h, 8), darkGranite);
    slab.position.y = 0.42 + tier * 0.34;
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);
  }

  // 底座北面/南面银色金属字「爱国 敬业 诚信 友善」
  const mottoTex = makeSignCanvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = '#1E2328';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#DCE4EB';
    ctx.font = 'bold 42px "Microsoft YaHei UI", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('爱国  敬业  诚信  友善', w / 2, h / 2);
  });
  const mottoMat = mottoTex
    ? new THREE.MeshStandardMaterial({ map: mottoTex, roughness: 0.35, metalness: 0.4 })
    : darkGranite;
  // 贴在八角底座正面外侧（r≈1.77，置 z=±1.88 彻底避免 Z-fighting 裁剪）
  for (const [mz, ry] of [[-1.88, Math.PI], [1.88, 0]] as [number, number][]) {
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.36), mottoMat);
    plaque.position.set(0, 1.08, mz);
    plaque.rotation.y = ry;
    g.add(plaque);
  }

  // 基座四周修剪整齐的球形灌木
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + 0.3;
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), shrubMat);
    bush.scale.set(1.1, 0.72, 1.1);
    bush.position.set(Math.cos(ang) * 2.65, 0.45, Math.sin(ang) * 2.65);
    bush.castShadow = true;
    g.add(bush);
  }

  // 3. 雕塑主体（4.3m 高，底座 1.58m + 主体 4.3m = 真实 5.88m！）
  // 左半边：半亚光红色氟碳漆折纸感金属半星；右半边：粗糙中国红斧劈花岗岩半星，中间镂空咬合
  const redSteelMat = new THREE.MeshStandardMaterial({
    color: 0xC82528,
    roughness: 0.30,
    metalness: 0.38,
  });
  const redGraniteMat = new THREE.MeshStandardMaterial({
    color: 0xA83C34,
    roughness: 0.90,
    metalness: 0.04,
    flatShading: true,
  });

  // 折纸金属左半星（尖角锐利、向外展翼、顶端与右半岩尖接触）
  const leftStarShape = new THREE.Shape();
  leftStarShape.moveTo(-0.08, 4.28);  // 顶尖
  leftStarShape.lineTo(-0.78, 2.55);
  leftStarShape.lineTo(-2.15, 2.48);  // 左翼尖
  leftStarShape.lineTo(-1.05, 1.48);
  leftStarShape.lineTo(-1.55, 0.0);   // 左底脚
  leftStarShape.lineTo(-0.32, 0.86);
  leftStarShape.lineTo(-0.55, 1.85);
  leftStarShape.lineTo(-0.14, 3.05);
  leftStarShape.closePath();

  const leftGeo = new THREE.ExtrudeGeometry(leftStarShape, {
    depth: 0.56,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  leftGeo.translate(0, 1.58, -0.28);
  const leftStar = new THREE.Mesh(leftGeo, redSteelMat);
  leftStar.castShadow = true;
  leftStar.receiveShadow = true;
  g.add(leftStar);

  // 粗糙中国红花岗岩右半星（粗粝厚重块面 + 棱角石刻感）
  const rightStarShape = new THREE.Shape();
  rightStarShape.moveTo(0.06, 4.25);  // 顶尖与左金属尖接触
  rightStarShape.lineTo(0.84, 2.52);
  rightStarShape.lineTo(2.12, 2.42);  // 右翼尖
  rightStarShape.lineTo(1.12, 1.42);
  rightStarShape.lineTo(1.58, 0.0);   // 右底脚
  rightStarShape.lineTo(0.36, 0.92);
  rightStarShape.lineTo(0.58, 1.92);
  rightStarShape.lineTo(0.18, 3.08);
  rightStarShape.closePath();

  const rightGeo = new THREE.ExtrudeGeometry(rightStarShape, {
    depth: 0.74,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.10,
    bevelSegments: 1,
  });
  // 给石雕顶点施加轻微确定性凿痕凹凸
  const rPos = rightGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < rPos.count; i++) {
    const x = rPos.getX(i), y = rPos.getY(i), z = rPos.getZ(i);
    const bump = Math.sin(x * 7.3 + y * 5.1) * 0.045;
    rPos.setXYZ(i, x + bump, y, z + bump * 0.8);
  }
  rightGeo.computeVertexNormals();
  rightGeo.translate(0, 1.58, -0.37);
  const rightStar = new THREE.Mesh(rightGeo, redGraniteMat);
  rightStar.castShadow = true;
  rightStar.receiveShadow = true;
  g.add(rightStar);

  return g;
}

/** 定制精建 #1：五星商业大厦（双青绿玻璃圆筒幕墙 + 双层拱门入口 + 金字招牌 + 弧形 LED 大屏） */
function buildWuxingCommercialMall(nightLights: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hero-wuxing-commercial-mall';
  // 真实范围 x=[-114.5, -46.4], z=[153.3, 234.5] -> 中心 (-80.4, 193.9), 宽 68m 深 80m
  const cx = -80.4, cz = 193.9;
  const w = 66, d = 78, h = 29;
  g.position.set(cx, 0, cz);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xDDD5C8, roughness: 0.78, metalness: 0.04 });
  const trimMat  = new THREE.MeshStandardMaterial({ color: 0xB8C2C8, roughness: 0.45, metalness: 0.35 });
  const tealGlassMat = new THREE.MeshStandardMaterial({
    color: 0x26758A,
    roughness: 0.16,
    metalness: 0.55,
  });
  const darkRecess = new THREE.MeshStandardMaterial({ color: 0x1A252E, roughness: 0.6 });

  // 主体 8 层退台裙楼
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 顶部女儿墙与金属檐口
  const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1.4, d + 1.2), trimMat);
  crown.position.y = h + 0.7;
  g.add(crown);

  // 面向北侧广场 (z = -d/2 = -39) 的标志性【双青绿反射玻璃圆筒幕墙】
  for (const tx of [-17, 17]) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.2, h - 1.5, 24), tealGlassMat);
    cyl.position.set(tx, (h - 1.5) / 2 + 1.2, -d / 2 + 1.5);
    cyl.castShadow = true;
    g.add(cyl);

    // 银色水平铝板腰线环（每层一圈）
    for (let y = 4.2; y < h; y += 3.5) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(7.38, 7.38, 0.38, 24), trimMat);
      band.position.set(tx, y, -d / 2 + 1.5);
      g.add(band);
    }
  }

  // 中央双层高大拱形主入口门廊（面向五星雕塑）
  const portico = new THREE.Mesh(new THREE.BoxGeometry(22, 13.5, 4.2), stoneMat);
  portico.position.set(0, 6.75, -d / 2 - 1.8);
  portico.castShadow = true;
  g.add(portico);

  const archOpening = new THREE.Mesh(new THREE.BoxGeometry(12, 8.2, 4.6), darkRecess);
  archOpening.position.set(0, 4.1, -d / 2 - 1.9);
  g.add(archOpening);

  // 入口大厅上方大号金字「五星商业大厦」
  const titleTex = makeSignCanvasTexture(640, 128, (ctx, cw, ch) => {
    ctx.fillStyle = '#CFC4B4';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#B88922';
    ctx.font = 'bold 72px "Microsoft YaHei UI", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('五星商业大厦', cw / 2 + 2, ch / 2 + 2);
    ctx.fillStyle = '#F2C94C';
    ctx.fillText('五星商业大厦', cw / 2, ch / 2);
  });
  if (titleTex) {
    const titleMat = new THREE.MeshStandardMaterial({
      map: titleTex,
      emissive: 0xE6B84C,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    nightLights.push(titleMat);
    const titlePlane = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.1), titleMat);
    titlePlane.position.set(0, 11.4, -d / 2 - 3.96);
    titlePlane.rotation.y = Math.PI;
    g.add(titlePlane);
  }

  // 右北转角弧形巨型发光 LED 大屏（面向五星雕塑广场，极高辨识度！）
  const ledTex = makeSignCanvasTexture(512, 256, (ctx, cw, ch) => {
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, '#0D4F8B');
    grad.addColorStop(0.5, '#1CA3A3');
    grad.addColorStop(1, '#F2994A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 58px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('山水柳州 · 五星商圈', cw / 2, 112);
    ctx.fillStyle = '#FFF3B0';
    ctx.font = 'bold 30px "Segoe UI", sans-serif';
    ctx.fillText('LIUZHOU WUXING PLAZA', cw / 2, 178);
  });
  const ledMat = new THREE.MeshStandardMaterial({
    map: ledTex ?? undefined,
    color: 0xFFFFFF,
    emissive: 0x3A9BD5,
    emissiveMap: ledTex ?? undefined,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  nightLights.push(ledMat);
  const ledScreen = new THREE.Mesh(new THREE.PlaneGeometry(16, 8.2), ledMat);
  ledScreen.position.set(24, 15.5, -d / 2 - 0.18);
  ledScreen.rotation.y = Math.PI;
  g.add(ledScreen);

  // 入口两侧玻璃采光窗带 + 东西两侧窗格（消除鸟瞰/侧面空白墙）
  const midGlass = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), tealGlassMat);
  midGlass.position.set(0, 21, -d / 2 - 0.15);
  midGlass.rotation.y = Math.PI;
  g.add(midGlass);

  for (const sx of [-w / 2 - 0.12, w / 2 + 0.12]) {
    const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(d - 12, h - 10), tealGlassMat);
    sideWin.position.set(sx, 7 + (h - 10) / 2, 0);
    sideWin.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(sideWin);
  }

  return g;
}

/** 定制精建 #2：东都大厦 / 东都百货（白砖绿窗立面 + 一二层转角明黄悬挑雨棚 + 金字「东都百货」） */
function buildDongduMall(nightLights: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hero-dongdu-mall';
  // 真实范围 x=[-56.3, -4.6], z=[63.0, 122.2] -> 中心 (-30.4, 92.6)
  const cx = -30.4, cz = 92.6;
  const w = 50, d = 56, h = 33;
  g.position.set(cx, 0, cz);

  const whiteTileMat = new THREE.MeshStandardMaterial({ color: 0xECF0F2, roughness: 0.72 });
  const greenGlassMat = new THREE.MeshStandardMaterial({ color: 0x4E8E85, roughness: 0.22, metalness: 0.35 });
  const yellowCanopyMat = new THREE.MeshStandardMaterial({
    color: 0xF5C23B,
    emissive: 0xD99A1E,
    emissiveIntensity: 0.18,
    roughness: 0.4,
  });
  nightLights.push(yellowCanopyMat);

  // 10 层白砖主体
  const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteTileMat);
  tower.position.y = h / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  g.add(tower);

  // 南立面（面向五星雕塑 z = +d/2 = +28）浅绿竖向窗格带
  for (let gx = -20; gx <= 20; gx += 5.0) {
    const winStrip = new THREE.Mesh(new THREE.PlaneGeometry(3.1, h - 9.5), greenGlassMat);
    winStrip.position.set(gx, 8.5 + (h - 9.5) / 2, d / 2 + 0.08);
    g.add(winStrip);
  }
  // 水平白砖层间腰线
  for (let y = 9; y < h; y += 3.2) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.32, d + 0.5), whiteTileMat);
    ledge.position.y = y;
    g.add(ledge);
  }

  // 一二层西南转角标志性【明黄悬挑雨棚】（紧邻五星雕塑东北角）
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(28, 1.35, 10), yellowCanopyMat);
  canopy.position.set(-12, 6.2, d / 2 + 2.2);
  canopy.castShadow = true;
  g.add(canopy);

  // 底层深色玻璃商铺门面
  const shopBase = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 5.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x26323B, roughness: 0.35 }),
  );
  shopBase.position.set(0, 2.75, d / 2 + 0.2);
  g.add(shopBase);

  // 醒目金字招牌「东都百货」
  const signTex = makeSignCanvasTexture(512, 112, (ctx, cw, ch) => {
    ctx.fillStyle = '#B8292F';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#FFD95A';
    ctx.font = 'bold 68px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('东 都 百 货', cw / 2, ch / 2);
  });
  if (signTex) {
    const smat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xD4403A,
      emissiveMap: signTex,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });
    nightLights.push(smat);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.2), smat);
    board.position.set(-8, 8.6, d / 2 + 0.22);
    g.add(board);
  }

  return g;
}

/** 定制精建 #3：柳州购书中心 / 新华书店（弧形转角米白石材横带 + 深色横窗 + 竖排红字招牌） */
function buildBookCenter(nightLights: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hero-liuzhou-book-center';
  // 真实范围 x=[-40.3, -2.9], z=[138.8, 175.1] -> 中心 (-21.6, 157.0)
  const cx = -21.6, cz = 157.0;
  const w = 36, d = 35, h = 23;
  g.position.set(cx, 0, cz);

  const creamStone = new THREE.MeshStandardMaterial({ color: 0xE6DED0, roughness: 0.78 });
  const darkBand   = new THREE.MeshStandardMaterial({ color: 0x20303C, roughness: 0.25, metalness: 0.35 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), creamStone);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 标志性西北弧形转角柱（面向五星雕塑）
  const cornerCyl = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, h, 20), creamStone);
  cornerCyl.position.set(-w / 2 + 4.5, h / 2, -d / 2 + 4.5);
  cornerCyl.castShadow = true;
  g.add(cornerCyl);

  // 水平交替的深色通长横条窗
  for (let y = 5.0; y < h - 1.5; y += 3.5) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 1.55, d + 0.3), darkBand);
    strip.position.y = y;
    g.add(strip);
    const cylStrip = new THREE.Mesh(new THREE.CylinderGeometry(6.62, 6.62, 1.55, 20), darkBand);
    cylStrip.position.set(-w / 2 + 4.5, y, -d / 2 + 4.5);
    g.add(cylStrip);
  }

  // 红色竖排发光招牌「柳州购书中心」
  const vSignTex = makeSignCanvasTexture(128, 512, (ctx, cw, ch) => {
    ctx.fillStyle = '#B81D24';
    ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = '#FFD77A';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, cw - 8, ch - 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 62px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = ['柳', '州', '购', '书', '中', '心'];
    chars.forEach((chStr, idx) => {
      ctx.fillText(chStr, cw / 2, 54 + idx * 78);
    });
  });
  if (vSignTex) {
    const vMat = new THREE.MeshStandardMaterial({
      map: vSignTex,
      emissive: 0xD92B2B,
      emissiveMap: vSignTex,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    nightLights.push(vMat);
    const vBoard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 12.5, 0.4), vMat);
    vBoard.position.set(-w / 2 - 1.0, 14.5, -d / 2 + 2.5);
    vBoard.rotation.y = Math.PI / 4;
    g.add(vBoard);
  }

  return g;
}

/** 定制精建 #4：柳州工贸大厦（青绿弧形玻璃幕墙 + 金字招牌） */
function buildGongmaoMall(nightLights: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hero-gongmao-mall';
  // 真实范围 x=[-206.5, -116.7], z=[63.6, 137.9] -> 中心 (-161.6, 100.7)
  const cx = -161.6, cz = 100.7;
  const w = 84, d = 68, h = 36;
  g.position.set(cx, 0, cz);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xD8D4CB, roughness: 0.78 });
  const tealGlass = new THREE.MeshStandardMaterial({ color: 0x227788, roughness: 0.18, metalness: 0.55 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xBFC8CE, roughness: 0.4, metalness: 0.35 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 面向东侧五星广场的弧形青绿玻璃主立面
  const arcGlass = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, h - 2, 24, 1, false, 0, Math.PI), tealGlass);
  arcGlass.position.set(w / 2 - 8, (h - 2) / 2 + 1, 0);
  arcGlass.castShadow = true;
  g.add(arcGlass);

  for (let y = 5; y < h; y += 3.8) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(20.2, 20.2, 0.35, 24, 1, false, 0, Math.PI), trimMat);
    ring.position.set(w / 2 - 8, y, 0);
    g.add(ring);
  }

  const signTex = makeSignCanvasTexture(512, 112, (ctx, cw, ch) => {
    ctx.fillStyle = '#194E5C';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#F7CF52';
    ctx.font = 'bold 64px "Microsoft YaHei UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('柳州工贸大厦', cw / 2, ch / 2);
  });
  if (signTex) {
    const smat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0xD9A938,
      emissiveMap: signTex,
      emissiveIntensity: 0.3,
      roughness: 0.35,
    });
    nightLights.push(smat);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.8), smat);
    board.position.set(w / 2 + 12.2, 28, 0);
    board.rotation.y = Math.PI / 2;
    g.add(board);
  }

  return g;
}

/** 构建五星雕塑广场花岗岩圆形拼花铺装 */
function buildPlazaMedallionPaving(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wuxing-plaza-paving';
  g.position.set(WUXING_PLAZA_CENTER.x, 0.044, WUXING_PLAZA_CENTER.z);

  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xD5C8B8,
    roughness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
  });
  const ringDarkMat = new THREE.MeshStandardMaterial({
    color: 0x9B9388,
    roughness: 0.90,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const ringPaleMat = new THREE.MeshStandardMaterial({
    color: 0xE6DDD0,
    roughness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  // 宽阔主广场花岗岩底面（覆盖五星雕塑与四大商厦之间）
  const mainDisc = new THREE.Mesh(new THREE.CircleGeometry(28, 48), outerMat);
  mainDisc.rotation.x = -Math.PI / 2;
  mainDisc.receiveShadow = true;
  g.add(mainDisc);

  // 同心石材拼花圆环（实景照片 #8 标志性圆形拼花）
  for (const [rIn, rOut, mat] of [
    [6.5, 7.6, ringDarkMat],
    [11.5, 13.0, ringPaleMat],
    [13.0, 13.7, ringDarkMat],
    [20.0, 21.2, ringPaleMat],
  ] as [number, number, THREE.Material][]) {
    const rGeo = new THREE.RingGeometry(rIn, rOut, 48);
    rGeo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(rGeo, mat);
    m.position.y = 0.004;
    m.receiveShadow = true;
    g.add(m);
  }

  return g;
}

/** 构造 9–11m 修长蒲葵/棕榈树阵 + 石材坐凳树池 + 多球簇状白色街灯（现代五星步行街中轴标志） */
function buildPlazaPalmsAndClusterLamps(nightLights: THREE.MeshStandardMaterial[]): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wuxing-palms-and-lamps';

  const planterMat = new THREE.MeshStandardMaterial({ color: 0x6A6E72, roughness: 0.85 });
  const trunkMat   = new THREE.MeshStandardMaterial({ color: 0x7A6552, roughness: 0.92 });
  const frondMat   = new THREE.MeshStandardMaterial({ color: 0x458E49, roughness: 0.78, side: THREE.DoubleSide });
  const poleMat    = new THREE.MeshStandardMaterial({ color: 0x3D4750, roughness: 0.5, metalness: 0.4 });
  const globeMat   = new THREE.MeshStandardMaterial({
    color: 0xFFF9E8,
    emissive: 0xFFE299,
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xD62828, roughness: 0.7, side: THREE.DoubleSide });
  nightLights.push(globeMat);

  // 棕榈树位（环绕五星雕塑广场外缘与主轴，避开出生点 (-56, 126.5) 与雕塑正前方视线）
  const palmPositions: [number, number, number][] = [
    [-68, 128, 9.5], [-43, 128, 10.2],
    [-69, 146, 9.8], [-42, 147, 9.4],
    [-64, 114, 10.5], [-48, 112, 9.6],
    [-67, 100, 10.0], [-45, 98, 9.8],
  ];

  const planterGeo = new THREE.BoxGeometry(2.2, 0.52, 2.2);
  const frondGeo = new THREE.ConeGeometry(0.55, 2.8, 4);
  frondGeo.scale(1.0, 1.0, 0.22);
  frondGeo.rotateX(Math.PI / 2);
  frondGeo.translate(0, 0, 1.35);

  for (const [px, pz, h] of palmPositions) {
    const pGroup = new THREE.Group();
    pGroup.position.set(px, 0, pz);

    const planter = new THREE.Mesh(planterGeo, planterMat);
    planter.position.y = 0.26;
    planter.castShadow = true;
    planter.receiveShadow = true;
    pGroup.add(planter);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, h, 7), trunkMat);
    trunk.position.y = h / 2 + 0.3;
    trunk.castShadow = true;
    pGroup.add(trunk);

    // 10 片放射状舒展棕榈叶冠
    for (let f = 0; f < 10; f++) {
      const ang = (f / 10) * Math.PI * 2;
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.y = h + 0.25;
      frond.rotation.y = ang;
      frond.rotation.x = 0.35 + (f % 2) * 0.28;
      frond.castShadow = true;
      pGroup.add(frond);
    }
    g.add(pGroup);
  }

  // 多球簇状白色街灯 + 双面红旗（五星雕塑四角，实景照片 #2/#3/#8 标志道具）
  const lampPositions: [number, number][] = [
    [-63, 134], [-48, 134], [-63, 145], [-48, 145],
    [-62, 121], [-49, 121],
  ];
  const globeGeo = new THREE.SphereGeometry(0.24, 10, 10);
  const flagGeo = new THREE.PlaneGeometry(0.68, 0.44);

  for (const [lx, lz] of lampPositions) {
    const lGroup = new THREE.Group();
    lGroup.position.set(lx, 0, lz);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 6.2, 8), poleMat);
    pole.position.y = 3.1;
    pole.castShadow = true;
    lGroup.add(pole);

    // 顶部 1 颗中心球灯 + 4 颗环绕球灯
    const topGlobe = new THREE.Mesh(globeGeo, globeMat);
    topGlobe.position.y = 6.35;
    lGroup.add(topGlobe);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const sub = new THREE.Mesh(globeGeo, globeMat);
      sub.scale.setScalar(0.85);
      sub.position.set(Math.cos(a) * 0.62, 5.9, Math.sin(a) * 0.62);
      lGroup.add(sub);
    }

    // 灯杆中上部双面小红旗
    for (const side of [-1, 1]) {
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(side * 0.42, 4.35, 0);
      flag.rotation.z = side * -0.18;
      lGroup.add(flag);
    }
    g.add(lGroup);
  }

  return g;
}

/** 远景柳州喀斯特石灰岩峰林轮廓（马鞍山/鱼峰山/蟠龙山真实方位，增强柳州山水城辨识度） */
function buildLiuzhouKarstBackdrop(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'liuzhou-karst-peaks';

  const peakMat = new THREE.MeshStandardMaterial({
    color: 0x4E7767,
    roughness: 0.94,
    metalness: 0,
    flatShading: true,
  });

  // 真实方位（南偏西马鞍山/鱼峰山，东偏南蟠龙山，东北远山）
  const peaks: [number, number, number, number, number][] = [
    [-220, 1220, 260, 195, 220],  // 马鞍山方向主峰
    [-460, 1180, 210, 155, 190],  // 鱼峰山方向副峰
    [120,  1280, 240, 165, 210],  // 驾鹤/南岸峰丛
    [980,  760,  230, 170, 210],  // 蟠龙山方向
    [1180, 320,  220, 145, 200],  // 东岸峰丛
    [-980, 920,  240, 160, 210],  // 西南远峰
  ];

  for (const [px, pz, rx, h, rz] of peaks) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, h, 9, 2), peakMat);
    cone.scale.set(rx, 1, rz);
    cone.position.set(px, h / 2 - 2, pz);
    g.add(cone);
  }
  return g;
}

export class WuxingHeroDistrict {
  public readonly group: THREE.Group;
  private nightLights: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'wuxing-hero-district';

    this.group.add(
      buildPlazaMedallionPaving(),
      buildRealFiveStarSculpture(this.nightLights),
      buildWuxingCommercialMall(this.nightLights),
      buildDongduMall(this.nightLights),
      buildBookCenter(this.nightLights),
      buildGongmaoMall(this.nightLights),
      buildPlazaPalmsAndClusterLamps(this.nightLights),
      buildLiuzhouKarstBackdrop(),
    );
  }

  public setAtmosphere(nightGlow: number, visible: boolean): void {
    this.group.visible = visible;
    for (const mat of this.nightLights) {
      mat.emissiveIntensity = 0.22 + nightGlow * 1.15;
    }
  }

  public dispose(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) mats.add(m);
      }
    });
    for (const g of geos) g.dispose();
    for (const m of mats) {
      if ('map' in m && (m as THREE.MeshStandardMaterial).map) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
      }
      m.dispose();
    }
  }
}
