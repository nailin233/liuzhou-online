/**
 * LandmarksAndSigns — 真实柳州地标雕塑、中国蓝白街道名牌与地标浮标（landmarks.json）
 *
 * 100% 来源自仓库内 map-wide.osm.gz 与 manifest-overture.json 的真实 OSM 名称：
 *  - 「柳州五星」标志雕塑（node/2065206730）
 *  - 10 块真实街头蓝白双面路牌（五星街、解放南路、中山东路、龙城路、广场路、屏山大道等）
 *  - 代表性柳州地标浮标（地王国际财富中心、柳州博物馆、柳侯公园、华侨大厦、文惠桥等）
 */
import * as THREE from 'three';

interface LandmarkEntry {
  id: string;
  name: string;
  kind: 'sculpture' | 'plaza' | 'bridge' | 'park' | 'building' | 'cultural' | 'skyscraper';
  position: [number, number];
  heightHint: number;
}

interface StreetSignEntry {
  id: string;
  name: string;
  position: [number, number];
  yaw: number;
}

interface LandmarksManifest {
  landmarks: LandmarkEntry[];
  streetSigns: StreetSignEntry[];
}

export interface LandmarksController {
  setVisible(cityVisible: boolean, badgesVisible: boolean): void;
  update(cameraPos: THREE.Vector3): void;
}

export interface LoadLandmarksResult {
  group: THREE.Group;
  controller: LandmarksController;
  landmarkCount: number;
  signCount: number;
}

const PINYIN_MAP: Record<string, string> = {
  '五星街':   'WUXING JIE',
  '解放南路': 'JIEFANG NAN LU',
  '中山东路': 'ZHONGSHAN DONG LU',
  '中山西路': 'ZHONGSHAN XI LU',
  '龙城路':   'LONGCHENG LU',
  '广场路':   'GUANGCHANG LU',
  '屏山大道': 'PINGSHAN DADAO',
  '滨江东路': 'BINJIANG DONG LU',
  '培新路':   'PEIXIN LU',
  '五一路':   'WUYI LU',
  '曙光中路': 'SHUGUANG ZHONG LU',
};

/** 生成标准中国绿/蓝白路牌高清贴图（仅浏览器环境创建 Canvas） */
function createStreetSignTexture(roadName: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 上半白底（东西/南北箭头装饰）+ 下半标准交通蓝底
  ctx.fillStyle = '#F5F7FA';
  ctx.fillRect(0, 0, 512, 46);
  ctx.fillStyle = '#1558A8';
  ctx.fillRect(0, 46, 512, 146);

  // 边框
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 506, 186);

  // 顶部方向提示
  ctx.fillStyle = '#1558A8';
  ctx.font = 'bold 24px "Microsoft YaHei UI", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('←  柳州 · 城中区  →', 256, 24);

  // 路名大字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px "Microsoft YaHei UI", "Segoe UI", sans-serif';
  ctx.fillText(roadName, 256, 108);

  // 拼音副标题
  ctx.fillStyle = '#D9ECFF';
  ctx.font = '600 22px "Segoe UI", sans-serif';
  ctx.fillText(PINYIN_MAP[roadName] ?? 'LIUZHOU', 256, 162);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 生成悬浮地标标签贴图（磨砂深青底 + 亮绿圆点） */
function createBadgeTexture(label: string, accentHex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 512, 112);

  // 圆角磨砂胶囊底
  const r = 44;
  ctx.beginPath();
  ctx.roundRect(12, 14, 488, 84, r);
  ctx.fillStyle = 'rgba(14, 28, 36, 0.84)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accentHex;
  ctx.stroke();

  // 左侧高亮图标点
  ctx.beginPath();
  ctx.arc(58, 56, 12, 0, Math.PI * 2);
  ctx.fillStyle = accentHex;
  ctx.fill();

  // 中文地标名
  ctx.fillStyle = '#F2F8FA';
  ctx.font = 'bold 40px "Microsoft YaHei UI", "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 88, 58, 390);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 构建五星步行街「柳州五星」雕塑（真实坐标 node/2065206730） */
function createWuxingSculpture(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'landmark-wuxing-sculpture';
  g.position.set(x, 0, z);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xD8D2C6, roughness: 0.78, metalness: 0.05 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xCC3333, roughness: 0.35, metalness: 0.25 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xF0C24B, roughness: 0.25, metalness: 0.75 });

  // 两级石质底座
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.45, 16), stoneMat);
  base1.position.y = 0.225;
  base1.castShadow = true;
  base1.receiveShadow = true;
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.75, 16), stoneMat);
  base2.position.y = 0.82;
  base2.castShadow = true;

  // 五角星主体形状
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? 1.85 : 0.78;
    const ang = (i * Math.PI) / 5 + Math.PI / 2;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) starShape.moveTo(px, py);
    else starShape.lineTo(px, py);
  }
  starShape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06 });
  starGeo.center();
  const star = new THREE.Mesh(starGeo, redMat);
  star.position.y = 3.1;
  star.castShadow = true;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.11, 10, 32), goldMat);
  ring.position.y = 3.1;
  ring.castShadow = true;

  g.add(base1, base2, star, ring);
  return g;
}

const FEATURED_BADGES = new Set([
  '地王国际财富中心', '柳州博物馆', '柳侯公园', '人民广场', '柳州五星',
  '华侨大厦', '工贸大厦', '东都大厦', '聚宝大厦', '中交大厦', '新大地商贸城',
  '文惠桥', '文昌桥', '红光大桥', '柳州文庙', '柳州市体育场', '马鞍山公园',
]);

export async function loadLandmarksAndSigns(): Promise<LoadLandmarksResult> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('landmarks.json', base));
  if (!response.ok) throw new Error(`landmarks.json · HTTP ${response.status}`);
  const manifest: LandmarksManifest = await response.json();

  const root = new THREE.Group();
  root.name = 'liuzhou-landmarks-and-signs';

  const propsGroup = new THREE.Group();
  propsGroup.name = 'liuzhou-physical-signs';
  const badgesGroup = new THREE.Group();
  badgesGroup.name = 'liuzhou-landmark-badges';
  root.add(propsGroup, badgesGroup);

  // 1. 实体路牌（五星街等 10 块蓝白路牌，立柱精确止于牌面底沿不穿字）
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xD5DCE2, roughness: 0.35, metalness: 0.65 });
  const poleGeo = new THREE.CylinderGeometry(0.045, 0.055, 2.43, 8);
  poleGeo.translate(0, 1.215, 0);
  const boardGeo = new THREE.BoxGeometry(1.55, 0.58, 0.06);

  for (const s of manifest.streetSigns) {
    const signGroup = new THREE.Group();
    signGroup.name = `street-sign-${s.name}`;
    signGroup.position.set(s.position[0], 0, s.position[1]);
    signGroup.rotation.y = s.yaw;

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.castShadow = true;

    const tex = createStreetSignTexture(s.name);
    const faceMat = tex
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.05 })
      : new THREE.MeshStandardMaterial({ color: 0x1558A8, roughness: 0.45 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xE6ECF2, roughness: 0.4 });
    const board = new THREE.Mesh(boardGeo, [edgeMat, edgeMat, edgeMat, edgeMat, faceMat, faceMat]);
    board.position.set(0, 2.72, 0);
    board.castShadow = true;

    signGroup.add(pole, board);
    propsGroup.add(signGroup);
  }

  // 2. 「柳州五星」实体雕塑 + 核心地标浮标
  const badgeSprites: { sprite: THREE.Sprite; baseY: number; priority: boolean }[] = [];

  for (const lm of manifest.landmarks) {
    if (lm.kind === 'sculpture') {
      propsGroup.add(createWuxingSculpture(lm.position[0], lm.position[1]));
    }
    if (!FEATURED_BADGES.has(lm.name)) continue;

    const accent = lm.kind === 'park' ? '#6EE084'
      : lm.kind === 'bridge' ? '#5DD3EE'
      : lm.kind === 'skyscraper' ? '#FFD166'
      : lm.kind === 'sculpture' ? '#FF758F'
      : '#D9EE98';

    const labelText = lm.kind === 'skyscraper' ? `${lm.name} ${Math.round(lm.heightHint)}m` : lm.name;
    const tex = createBadgeTexture(labelText, accent);
    if (!tex) continue;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const y = Math.max(lm.heightHint + 8, 16);
    sprite.position.set(lm.position[0], y, lm.position[1]);
    sprite.renderOrder = 20;
    badgesGroup.add(sprite);
    badgeSprites.push({
      sprite,
      baseY: y,
      priority: lm.kind === 'skyscraper' || lm.kind === 'park' || lm.kind === 'bridge' || lm.name === '柳州五星',
    });
  }

  const controller: LandmarksController = {
    setVisible(cityVisible: boolean, badgesVisible: boolean) {
      propsGroup.visible = cityVisible;
      badgesGroup.visible = cityVisible && badgesVisible;
    },
    update(cameraPos: THREE.Vector3) {
      if (!badgesGroup.visible) return;
      for (const item of badgeSprites) {
        const dist = cameraPos.distanceTo(item.sprite.position);
        const maxDist = item.priority ? 1900 : 820;
        if (dist > maxDist || dist < 12) {
          item.sprite.visible = false;
          continue;
        }
        item.sprite.visible = true;
        // 保持屏幕上读字大小稳定，不随远近过度膨胀或消失
        const scale = THREE.MathUtils.clamp(dist * 0.145, 7, 130);
        item.sprite.scale.set(scale, scale * (112 / 512), 1);
      }
    },
  };

  return {
    group: root,
    controller,
    landmarkCount: manifest.landmarks.length,
    signCount: manifest.streetSigns.length,
  };
}

export function disposeLandmarks(group: THREE.Group): void {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  group.traverse(o => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      if (o instanceof THREE.Mesh) geos.add(o.geometry);
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) mats.add(m);
    }
  });
  for (const g of geos) g.dispose();
  for (const m of mats) {
    if ('map' in m && (m as THREE.SpriteMaterial).map) {
      (m as THREE.SpriteMaterial).map?.dispose();
    }
    m.dispose();
  }
}
