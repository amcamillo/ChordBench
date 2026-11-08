import * as THREE from 'three';
import { FIFTHS, fifthsOrbitPoint, sharedPitchClasses } from '../../domain/graphs/fifthsTime.ts';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';
import { cameraPosition } from '../../domain/graphs/fifthsCamera.ts';

const RADIUS = 2.25, SPACING = 1.45, LAYERS = 10;
const point = (pitch: number, z: number, radius = RADIUS) => {
  const result = fifthsOrbitPoint(pitch, z, radius);
  return new THREE.Vector3(result.x, result.y, result.z);
};

function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    for (const item of Array.isArray(material) ? material : material ? [material] : []) {
      materials.add(item);
      const mapped = item as THREE.SpriteMaterial;
      if (mapped.map) textures.add(mapped.map);
    }
  });
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
}

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.12, 'rgba(255,255,255,.8)');
  gradient.addColorStop(.4, 'rgba(255,255,255,.18)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function labelSprite(label: string): THREE.Sprite {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.font = '500 26px Inter, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#273252'; context.shadowColor = '#ffffff'; context.shadowBlur = 7; context.fillText(label, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.75, .44, 1); return sprite;
}

export class ThreeFifthsScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  private readonly orbit = new THREE.Group();
  private readonly data = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly resize: ResizeObserver;
  private readonly intersection: IntersectionObserver | null;
  private noteMeshes: THREE.Mesh[] = [];
  private visible = true;
  private playbackPosition: (() => number) | null = null;
  private yaw = .15;
  private tilt = .4;
  private zoom = 1;
  private destroyed = false;
  private readonly onVisibility = () => this.syncLoop();
  private readonly onLost: (event: Event) => void;

  constructor(private readonly canvas: HTMLCanvasElement, onError: (message: string) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0xf6f8ff, 1);
    this.scene.fog = new THREE.FogExp2(0xf6f8ff, .025);
    this.scene.add(new THREE.AmbientLight(0xb9d9ff, 1.2));
    const light = new THREE.PointLight(0xc2e8ff, 24, 30); light.position.set(0, 0, 2); this.scene.add(light);
    this.scene.add(this.orbit); this.orbit.add(this.data);
    const positions: number[] = [];
    for (let i = 0; i < 420; i++) positions.push(((i * 197 + 31) % 997) / 997 * 56 - 28, ((i * 347 + 89) % 991) / 991 * 44 - 22, -((i * 97 + 11) % 997) / 997 * 50 + 7);
    const stars = new THREE.BufferGeometry(); stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x9685c0, size: .035, transparent: true, opacity: .45, depthWrite: false })));
    this.onLost = event => { event.preventDefault(); this.renderer.setAnimationLoop(null); onError('The 3D graphics context was interrupted. Switch views or reload to try again.'); };
    canvas.addEventListener('webglcontextlost', this.onLost);
    this.resize = new ResizeObserver(() => this.updateSize()); this.resize.observe(canvas);
    this.intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.syncLoop(); });
    this.intersection?.observe(canvas);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.setView(this.yaw, this.tilt, this.zoom); this.updateSize();
  }

  private updateSize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height; this.camera.updateProjectionMatrix(); this.setView(this.yaw, this.tilt, this.zoom);
  }

  setView(yaw: number, tilt: number, zoom: number) {
    this.yaw = yaw; this.tilt = tilt; this.zoom = zoom;
    const position = cameraPosition(this.camera.aspect, yaw, tilt, zoom);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(0, 0, -5.4); this.camera.updateMatrixWorld(); this.render();
  }

  setData(chords: TimeChord[], focus: number, selectedPitch: number | null) {
    disposeTree(this.data); this.data.clear(); this.noteMeshes = [];
    const glows = glowTexture();
    const halo = (color: number, scale: number) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glows, color, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false }));
      sprite.scale.setScalar(scale); return sprite;
    };
    // The central thread marks depth; it does not imply an inferred musical beat.
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(.025, .055, 21, 12), new THREE.MeshBasicMaterial({ color: 0x7353d8, transparent: true, opacity: .65 }));
    axis.rotation.x = Math.PI / 2; axis.position.z = -focus * SPACING - 7; this.data.add(axis);
    const axisGlow = new THREE.Mesh(new THREE.CylinderGeometry(.10, .14, 21, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xb2a2ed, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    axisGlow.rotation.x = Math.PI / 2; axisGlow.position.z = -focus * SPACING - 7; this.data.add(axisGlow);

    // Stable pitch-class lanes, like a curved musical staff, continue through the visible window.
    for (const note of FIFTHS) {
      const coords: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) coords.push(point(note.pitch, -focus * SPACING + 3 - i * 22 / 160));
      this.data.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords), new THREE.LineBasicMaterial({ color: 0x817cbd, transparent: true, opacity: .32, depthWrite: false })));
      const label = labelSprite(note.label); label.position.copy(point(note.pitch, -focus * SPACING + .05, RADIUS + .48)); this.data.add(label);
    }
    const start = Math.max(0, focus - 2);
    const visible = chords.slice(start, focus + LAYERS);
    visible.forEach((chord, index) => {
      const chordIndex = start + index;
      const z = -chordIndex * SPACING;
      const chordPoints = chord.notes.map(note => point(note.pitch, z));
      if (chordPoints.length > 1) {
        const outline = chordPoints.length > 2 ? [...chordPoints, chordPoints[0]] : chordPoints;
        this.data.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline), new THREE.LineBasicMaterial({ color: 0x7542d4, transparent: true, opacity: chordIndex === focus ? .8 : .42, depthWrite: false })));
      }
      chord.notes.forEach(note => {
        const isSelected = chordIndex === focus && note.pitch === selectedPitch;
        const color = note.root ? 0xe72f65 : 0x1478d4;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(note.root ? .115 : .085, 20, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isSelected ? 1.5 : .75, roughness: .24, metalness: .08 }));
        mesh.position.copy(point(note.pitch, z)); mesh.userData.pitch = note.pitch;
        mesh.add(halo(color, isSelected ? 1.15 : note.root ? .9 : .7));
        if (chordIndex === focus) this.noteMeshes.push(mesh);
        this.data.add(mesh);
      });
      const next = visible[index + 1];
      if (next) for (const pitch of sharedPitchClasses(chord, next)) {
        const coords: THREE.Vector3[] = [];
        for (let j = 0; j <= 32; j++) coords.push(point(pitch, z - j * SPACING / 32));
        this.data.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords), new THREE.LineBasicMaterial({ color: 0x087d9f, transparent: true, opacity: .9, depthWrite: false })));
      }
    });
    this.setPosition(this.playbackPosition?.() ?? focus);
  }

  setPlayback(position: (() => number) | null) { this.playbackPosition = position; this.syncLoop(); }
  private setPosition(position: number) {
    this.data.position.z = position * SPACING;
    this.canvas.dataset.position = position.toFixed(3);
    this.render();
  }
  private syncLoop() {
    if (this.destroyed) return;
    if (this.visible && !document.hidden && this.playbackPosition) {
      this.renderer.setAnimationLoop(() => { if (this.playbackPosition) this.setPosition(this.playbackPosition()); });
    } else { this.renderer.setAnimationLoop(null); this.render(); }
  }
  private render() { if (!this.destroyed && !document.hidden) this.renderer.render(this.scene, this.camera); }

  pick(clientX: number, clientY: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    return this.raycaster.intersectObjects(this.noteMeshes, false)[0]?.object.userData.pitch ?? null;
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true; this.renderer.setAnimationLoop(null);
    this.resize.disconnect(); this.intersection?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility); this.canvas.removeEventListener('webglcontextlost', this.onLost);
    disposeTree(this.scene); this.renderer.dispose();
  }
}
