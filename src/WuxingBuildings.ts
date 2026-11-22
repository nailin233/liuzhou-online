import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface BuildingEntry {
  file: string;
  position: [number, number, number];
  heightSource: 'missing';
}

function enableMissingHeightStripes(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.stripeColor = { value: new THREE.Color(0xd9549b) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float stripeDistance;')
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 wallNormal = normalize(mat3(modelMatrix) * normal);
        // Horizontal tangent of this facade. The bottom cap is never striped.
        vec2 tangent = vec2(-wallNormal.z, wallNormal.x);
        stripeDistance = abs(wallNormal.y) > 0.5 ? 0.9 : (dot(world.xz, tangent) + world.y) * 0.70710678;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float stripeDistance;\nuniform vec3 stripeColor;')
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float footprint = max(fwidth(stripeDistance), 0.0001);
        float distanceToCenter = abs(mod(stripeDistance + 0.9, 1.8) - 0.9);
        float stripe = 1.0 - smoothstep(0.3 - footprint * 0.5, 0.3 + footprint * 0.5, distanceToCenter);
        stripe = mix(stripe, 0.6 / 1.8, smoothstep(0.6, 1.8, footprint));
        diffuseColor.rgb = mix(diffuseColor.rgb, stripeColor, stripe);
      `);
  };
}

export function disposeBuildings(group: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const list = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of list) materials.add(mat);
  });
  for (const material of materials) material.dispose();
}

export async function loadWuxingBuildings(): Promise<THREE.Group> {
  const base = new URL(import.meta.env.BASE_URL + 'models/wuxing-street/', document.baseURI);
  const response = await fetch(new URL('manifest.json', base));
  if (!response.ok) throw new Error(`manifest.json · HTTP ${response.status}`);
  const { buildings }: { buildings: BuildingEntry[] } = await response.json();
  const loader = new GLTFLoader();
  const group = new THREE.Group();
  const shared = new Map<string, THREE.Material>();
  const results = await Promise.allSettled(buildings.map(async entry => {
    const { scene } = await loader.loadAsync(new URL(entry.file, base).href);
    group.add(scene);
    scene.position.fromArray(entry.position);
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material;
      const existing = shared.get(material.name);
      if (existing) {
        if (existing !== material) material.dispose();
        child.material = existing;
      } else {
        shared.set(material.name, material);
        if (entry.heightSource === 'missing' && material.name === 'missing-facade') {
          enableMissingHeightStripes(material);
        }
      }
    });
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) {
    disposeBuildings(group);
    throw failure.reason;
  }
  return group;
}
