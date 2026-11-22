/**
 * MapHUD — HUD、指北针、图例、ODbL 常驻署名
 * art-direction.md §5 界面布局
 */
import * as THREE from 'three';

export interface HUDState {
  fps: number;
  drawCalls: number;
  triangles: number;
  buildingsTotal: number;
  buildingsMissing: number;
  roadsTotal: number;
  dataSource?: string;  // 数据来源标签（如 'Overture 2891'）
}

export class MapHUD {
  private statusEl:   HTMLElement;
  private compassEl:  HTMLElement;
  private legendEl:   HTMLElement;
  private attrEl:     HTMLElement;

  constructor(container: HTMLElement) {
    // ── 状态栏 (右下) ──
    this.statusEl = document.createElement('div');
    this.statusEl.id = 'map-hud';
    Object.assign(this.statusEl.style, {
      position: 'fixed', bottom: '22px', right: '30px', zIndex: '5',
      color: '#86b9b8', fontSize: '12px', pointerEvents: 'none',
      fontFamily: "'Segoe UI','Microsoft YaHei UI',sans-serif",
      lineHeight: '1.8',
    });
    container.appendChild(this.statusEl);

    // ── 指北针 (右上) ──
    this.compassEl = document.createElement('div');
    this.compassEl.id = 'map-compass';
    this.compassEl.title = '按 N 重置朝北';
    this.compassEl.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="#101820" stroke="#3E8F91" stroke-width="1.5" opacity="0.85"/>
        <polygon id="compass-n" points="24,6 20,24 24,28 28,24" fill="#D9549B"/>
        <polygon id="compass-s" points="24,42 20,24 24,20 28,24" fill="#86b9b8" opacity="0.6"/>
        <text x="24" y="12" text-anchor="middle" fill="#EDF4F5" font-size="8"
              font-family="'Segoe UI',sans-serif">N</text>
      </svg>`;
    Object.assign(this.compassEl.style, {
      position: 'fixed', top: '20px', right: '28px', zIndex: '5',
      cursor: 'pointer', userSelect: 'none',
    });
    container.appendChild(this.compassEl);

    // ── 图例 (左下，按 L 切换) ──
    this.legendEl = document.createElement('div');
    this.legendEl.id = 'map-legend';
    this.legendEl.innerHTML = `
      <div style="font-size:11px;letter-spacing:.18em;color:#86b9b8;margin-bottom:6px">图例</div>
      ${this.legendRow('#9FB0B8','#BCC9CE','OSM 建筑（有层数）')}
      ${this.legendRow('#5C4A57','#6E5868','OSM 建筑（高度缺失）', '#D9549B')}
      ${this.legendRow('#3A4954','#3A4954','主干道 / 次干道')}
      ${this.legendRow('#5A6B62','#5A6B62','步行街')}
    `;
    Object.assign(this.legendEl.style, {
      position: 'fixed', bottom: '48px', left: '20px', zIndex: '5',
      background: 'rgba(16,24,32,.82)', backdropFilter: 'blur(6px)',
      padding: '12px 16px', borderRadius: '6px',
      border: '1px solid #ffffff16', fontSize: '12px',
      color: '#EDF4F5', pointerEvents: 'none',
      fontFamily: "'Segoe UI','Microsoft YaHei UI',sans-serif",
      display: 'none',   // 默认隐藏，按 L 显示
    });
    container.appendChild(this.legendEl);

    // ── ODbL 常驻署名 (左下) ──
    const attrA = document.createElement('a') as HTMLAnchorElement;
    attrA.id     = 'map-attribution';
    attrA.href   = 'https://www.openstreetmap.org/copyright';
    attrA.target = '_blank';
    attrA.rel    = 'noopener noreferrer';
    attrA.textContent = '© OpenStreetMap contributors · ODbL 1.0';
    this.attrEl = attrA;
    Object.assign(this.attrEl.style, {
      position: 'fixed', bottom: '18px', left: '20px', zIndex: '6',
      color: '#d5e1e5', background: 'rgba(16,24,32,.78)',
      fontSize: '11px', padding: '3px 7px', borderRadius: '3px',
      textDecoration: 'none', pointerEvents: 'auto',
    });
    container.appendChild(this.attrEl);

    // 键盘快捷键
    document.addEventListener('keydown', e => {
      if (e.key === 'l' || e.key === 'L') this.toggleLegend();
    });
  }

  private legendRow(sideHex: string, topHex: string, label: string, stripeHex?: string): string {
    const border = stripeHex ? `border:1px solid ${stripeHex};` : '';
    const stripe = stripeHex
      ? `background:repeating-linear-gradient(45deg,${sideHex},${sideHex} 3px,${stripeHex} 3px,${stripeHex} 5px);`
      : `background:${sideHex};`;
    return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <div style="width:14px;height:14px;border-radius:2px;${stripe}${border}flex-shrink:0"></div>
      <span style="color:#AFC4CB">${label}</span>
    </div>`;
  }

  public toggleLegend(): void {
    this.legendEl.style.display = this.legendEl.style.display === 'none' ? 'block' : 'none';
  }

  /** 更新指北针旋转：angle 是相机绕 Y 轴的方位角（弧度，Three.js） */
  public updateCompass(camera: THREE.Camera, controls: { target: THREE.Vector3 }): void {
    const dir = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .setY(0).normalize();
    // dir.z > 0 表示相机在 +Z（南），北在上方的屏幕角度
    const angle = Math.atan2(dir.x, dir.z) * (180 / Math.PI);
    const svg = this.compassEl.querySelector('svg');
    if (svg) {
      // 只旋转指针部分（整个 SVG 内容，不含外框）
      const north = svg.querySelector('#compass-n') as SVGElement | null;
      const south = svg.querySelector('#compass-s') as SVGElement | null;
      if (north) north.style.transform = `rotate(${angle}deg)`;
      if (south) south.style.transform = `rotate(${angle}deg)`;
      [north, south].forEach(el => el && (el.style.transformOrigin = '24px 24px'));
    }
  }

  public update(state: HUDState): void {
    const missing = state.buildingsMissing > 0
      ? `<span style="color:#D9549B">缺失高度 ${state.buildingsMissing}/${state.buildingsTotal}</span>`
      : `建筑 ${state.buildingsTotal}`;
    const src = state.dataSource ? `<span style="color:#7795a0;font-size:10px"> ${state.dataSource}</span>` : '';
    this.statusEl.innerHTML =
      `WebGL · ${state.fps} FPS · 调用 ${state.drawCalls} · ` +
      `三角形 ${(state.triangles / 1000).toFixed(0)}k · ` +
      `${missing} · 道路 ${state.roadsTotal}${src} · <kbd style="opacity:.6">L</kbd>图例`;
  }

  public dispose(): void {
    this.statusEl.remove();
    this.compassEl.remove();
    this.legendEl.remove();
    this.attrEl.remove();
  }
}
