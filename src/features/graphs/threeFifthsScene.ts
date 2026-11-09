import * as THREE from 'three';
import { CHROMATIC, noteRailPoint } from '../../domain/graphs/fifthsTime.ts';
import type { TimeChord } from '../../domain/graphs/fifthsTime.ts';
import { cameraPosition } from '../../domain/graphs/fifthsCamera.ts';
import { GROOVES, meterFrame, overviewPoint, overviewX, rhythmEvents, type VisualRhythm } from '../../domain/graphs/rhythm.ts';
import { morphAmount } from '../../domain/graphs/chordMorph.ts';
import { buildFocusedChord } from './focusedChord.ts';
import { buildTimingTrack } from './dnaTimingTrack.ts';
import type { TransitionCandidate } from '../../domain/song/transitions.ts';
import { buildSongOverview } from './songOverview.ts';
import { noteColor, unambiguousPitch } from '../../domain/harmony/noteColor.ts';
import type { PianoNote } from '../../domain/instruments/voicings.ts';

const RADIUS = 2.25, SPACING = 1.45, LAYERS = 10;
const point = (pitch: number, z: number, radius = RADIUS) => {
  const result = noteRailPoint(pitch, z, radius);
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

function labelSprite(label: string, fontSize = 32): THREE.Sprite {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.font = `500 ${fontSize}px Inter, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#273252'; context.shadowColor = '#ffffff'; context.shadowBlur = 7; context.fillText(label, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(2.1, .525, 1); return sprite;
}

export class ThreeFifthsScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  private readonly orbit = new THREE.Group();
  private readonly data = new THREE.Group();
  private readonly voiceLayer = new THREE.Group();
  private track: ReturnType<typeof buildTimingTrack> | null = null;
  private readonly focusLayer = new THREE.Group();
  private position = 0;
  private secondsPerChord = 240 / 90;
  private morph: ReturnType<typeof buildFocusedChord> | null = null;
  private morphProgress = 0;
  private motionProbe: THREE.Mesh | null = null;
  private chordLayers: { index: number; group: THREE.Group }[] = [];
  private anchor = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly resize: ResizeObserver;
  private readonly intersection: IntersectionObserver | null;
  private noteMeshes: THREE.Mesh[] = [];
  private visible = true;
  private playbackPosition: (() => number) | null = null;
  private yaw = .15;
  private tilt = .4;
  private zoom = 1;
  private overview = false;
  private focus = 0;
  private count = 0;
  private cursor: THREE.Line | null = null;
  private lastChords: TimeChord[] | null = null;
  private lastRhythm: VisualRhythm | null = null;
  private lastVoicings: readonly { id: string; notes: PianoNote[] }[] | null = null;
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
    this.scene.add(this.orbit); this.orbit.add(this.data, this.focusLayer, this.voiceLayer);
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
    this.canvas.dataset.viewYaw = yaw.toFixed(4); this.canvas.dataset.viewTilt = tilt.toFixed(4); this.canvas.dataset.viewZoom = zoom.toFixed(4);
    this.updateCamera(); this.render();
  }

  private updateCamera() {
    const { yaw, tilt, zoom } = this;
    if (this.overview) {
      // Keep both ends of the song visible while viewing the circular layers obliquely.
      const distance = Math.max(25, 23 / Math.max(.1, this.camera.aspect)) / Math.tan(21 * Math.PI / 180) / zoom;
      const angle = .55 + yaw;
      const elevation = tilt;
      this.camera.far = Math.max(100, distance * 3); this.camera.updateProjectionMatrix();
      this.camera.position.set(Math.sin(angle) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, Math.cos(angle) * Math.cos(elevation) * distance);
      this.camera.up.set(-Math.sin(angle) * Math.sin(elevation), Math.cos(elevation), -Math.cos(angle) * Math.sin(elevation));
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.up.set(0, 1, 0);
      const position = cameraPosition(this.camera.aspect, yaw, tilt, zoom);
      const targetZ = 0;
      this.camera.position.set(position.x, position.y, position.z + 5.4 + targetZ);
      this.camera.lookAt(0, 0, targetZ);
    }
    this.camera.updateMatrixWorld();
    const center = new THREE.Vector3(this.overview ? overviewX(this.focus, this.count) : 0, 0, 0).project(this.camera);
    if (this.overview) {
      const ends = [-16, 16].map(x => new THREE.Vector3(x, 0, 0).project(this.camera));
      this.canvas.dataset.overviewEnds = JSON.stringify(ends.map(p => [p.x, p.y]));
    }
    this.canvas.dataset.focusX = center.x.toFixed(4);
    this.canvas.dataset.focusY = center.y.toFixed(4);
    this.updateTimingTrack();
  }

  /** Project the fixed pitch-class rails at the focused chord plane. */
  railPositions() {
    this.camera.updateMatrixWorld();
    const progress = Math.max(0, Math.min(1, this.position - this.focus));
    const candidates = (pitch: number, z: number) => Array.from({ length: 9 }, (_, i) => point(pitch, z + .4 - i * .1).project(this.camera))
      .filter(p => p.z >= -1 && p.z <= 1)
      .map(p => ({ x: (p.x + 1) / 2, y: (1 - p.y) / 2 }))
      .filter(p => p.x >= .03 && p.x <= .97 && p.y >= .03 && p.y <= .97);
    return CHROMATIC.map(note => ({ pitch: note.pitch, current: candidates(note.pitch, 0), next: candidates(note.pitch, -SPACING + progress * SPACING) }));
  }

  setData(chords: TimeChord[], focus: number, selectedPitch: number | null, overview = false, rhythm: VisualRhythm = { groove: GROOVES[0], meter: '4/4' }, timingVisible = true, voicings: readonly { id: string; notes: PianoNote[] }[] = []) {
    if (this.track) { disposeTree(this.track.group); this.scene.remove(this.track.group); }
    this.track = buildTimingTrack(chords, focus, rhythm, text => labelSprite(text, 48));
    this.track.group.visible = timingVisible;
    this.canvas.dataset.timingVisible = String(timingVisible);
    this.scene.add(this.track.group);
    disposeTree(this.focusLayer); this.focusLayer.clear(); this.noteMeshes = [];
    const focused = chords[focus];
    const byId = new Map(voicings.map(item => [item.id, item.notes]));
    const focusNotes = focused ? byId.get(focused.id) : undefined;
    const nextNotes = chords[focus + 1] ? byId.get(chords[focus + 1].id) : undefined;
    this.canvas.dataset.noteColors = JSON.stringify((focused?.notes ?? []).map(note => { const midi = unambiguousPitch(focusNotes, note.pitch); return { pitch: note.pitch, midi, color: noteColor(midi), root: note.root }; }));
    this.morph = !overview && focused ? buildFocusedChord(this.focusLayer, focused, chords[focus + 1], selectedPitch, labelSprite, focusNotes, nextNotes) : null;
    this.noteMeshes = this.morph?.meshes ?? [];
    if (overview && this.overview && this.lastChords === chords && this.lastRhythm === rhythm && this.lastVoicings === voicings) {
      this.focus = focus; this.setPosition(this.playbackPosition?.() ?? focus); return;
    }
    if (!overview && !this.overview && this.lastChords === chords && this.lastRhythm === rhythm && this.lastVoicings === voicings && focus >= this.anchor && focus < this.anchor + LAYERS - 2) {
      this.focus = focus; this.updateChordVisibility(); this.setPosition(this.playbackPosition?.() ?? focus); return;
    }
    this.lastChords = chords; this.lastRhythm = rhythm; this.lastVoicings = voicings;
    disposeTree(this.data); this.data.clear(); this.motionProbe = null; this.chordLayers = [];
    this.overview = overview; this.focus = focus; this.anchor = focus; this.count = chords.length; this.cursor = null;
    this.scene.fog = overview ? null : new THREE.FogExp2(0xf6f8ff, .025);
    this.canvas.dataset.scope = overview ? 'whole' : 'detail';
    this.canvas.dataset.groove = rhythm.groove.id;
    this.canvas.dataset.meter = rhythm.meter;
    this.canvas.dataset.total = String(chords.length);
    this.setView(this.yaw, this.tilt, this.zoom);
    if (overview) {
      this.cursor = buildSongOverview(this.data, chords, rhythm, voicings);
      this.canvas.dataset.rendered = String(chords.length);
      this.canvas.dataset.first = '1'; this.canvas.dataset.last = String(chords.length);
      this.setPosition(this.playbackPosition?.() ?? focus); return;
    }
    // The central thread marks depth; it does not imply an inferred musical beat.
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(.025, .055, 21, 12), new THREE.MeshBasicMaterial({ color: 0x49358f, depthTest: false, depthWrite: false, fog: false }));
    axis.renderOrder = 20; axis.rotation.x = Math.PI / 2; axis.position.z = -7; this.data.add(axis);
    const axisGlow = new THREE.Mesh(new THREE.CylinderGeometry(.10, .14, 21, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xb2a2ed, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    axisGlow.rotation.x = Math.PI / 2; axisGlow.position.z = -7; this.data.add(axisGlow);

    // Straight longitudinal rails hold pitch-class positions fixed across chord layers.
    this.canvas.dataset.railGeometry = 'straight-pitch-class';
    for (const note of CHROMATIC) {
      const coords = [point(note.pitch, 3), point(note.pitch, -19)];
      this.data.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords), new THREE.LineBasicMaterial({ color: 0x817cbd, transparent: true, opacity: .34, depthWrite: false })));
    }
    const start = Math.max(0, focus - 2);
    const visible = chords.slice(start, focus + LAYERS);
    this.canvas.dataset.rendered = String(visible.length);
    this.canvas.dataset.first = String(start + 1); this.canvas.dataset.last = String(start + visible.length);
    visible.forEach((chord, index) => {
      const chordIndex = start + index;
      const z = -(chordIndex - focus) * SPACING;
      const backgroundPoint = (pitch: number) => { const p = point(pitch, -chordIndex * SPACING); p.z = z; return p; };
      // A light circle marks each chord plane without forming a continuous spiral.
      const circle = Array.from({ length: 64 }, (_, step) => {
        const angle = step * Math.PI * 2 / 64;
        return new THREE.Vector3(Math.cos(angle) * RADIUS, Math.sin(angle) * RADIUS, z);
      });
      this.data.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle), new THREE.LineBasicMaterial({ color: 0x817cbd, transparent: true, opacity: .16, depthWrite: false })));

      const ticks: THREE.Vector3[] = [];
      for (let beat = 0; beat < 4; beat++) {
        const depth = z - beat / 4 * SPACING, width = beat === 0 ? .24 : .1;
        ticks.push(new THREE.Vector3(-width, 0, depth), new THREE.Vector3(width, 0, depth));
      }
      this.data.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), new THREE.LineBasicMaterial({ color: 0x49358f, depthTest: false, depthWrite: false, fog: false })));
      if (rhythm.groove.steps.length) {
        const frame = meterFrame(rhythm.meter, 3.05).map(p => new THREE.Vector3(p.x, p.y, z));
        this.data.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(frame), new THREE.LineBasicMaterial({ color: 0xcc631d, transparent: true, opacity: .45 })));
        const accents: THREE.Vector3[] = [];
        for (const event of rhythmEvents(rhythm)) {
          const depth = z - event.fraction * SPACING;
          accents.push(new THREE.Vector3(3.35, 0, depth), new THREE.Vector3(3.35 + event.strength * .6, 0, depth));
        }
        this.data.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(accents), new THREE.LineBasicMaterial({ color: 0xcc631d, transparent: true, opacity: .65 })));
      }
      const layer = new THREE.Group();
      this.chordLayers.push({ index: chordIndex, group: layer });
      this.data.add(layer);
      const chordPoints = chord.notes.map(note => backgroundPoint(note.pitch));
      if (chordPoints.length > 1) {
        const outline = chordPoints.length > 2 ? [...chordPoints, chordPoints[0]] : chordPoints;
        layer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline), new THREE.LineBasicMaterial({ color: 0x7542d4, transparent: true, opacity: .22, depthWrite: false })));
      }
      chord.notes.forEach(note => {
        const isSelected = chordIndex === focus && note.pitch === selectedPitch;
        const color = noteColor(unambiguousPitch(byId.get(chord.id), note.pitch));
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(note.root ? .115 : .085, 20, 14), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .38, depthWrite: false, fog: false, toneMapped: false }));
        mesh.position.copy(backgroundPoint(note.pitch)); mesh.userData.pitch = note.pitch;
        if (!this.motionProbe) this.motionProbe = mesh;
        if (note.root || isSelected) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(isSelected ? .18 : .15, .018, 6, 20), new THREE.MeshBasicMaterial({ color: 0x19243a, transparent: true, opacity: .38, depthWrite: false, fog: false, toneMapped: false }));
          ring.position.z = .03; mesh.add(ring);
        }
        layer.add(mesh);
      });

    });
    this.updateChordVisibility();
    this.setPosition(this.playbackPosition?.() ?? focus);
  }

  private updateChordVisibility() {
    for (const layer of this.chordLayers) layer.group.visible = layer.index === this.focus + 1;
    this.canvas.dataset.previewChord = this.focus + 1 < this.count ? String(this.focus + 2) : '';
  }

  private updateTimingTrack() {
    if (!this.track) return;
    const distance = 10, height = 2 * distance * Math.tan(21 * Math.PI / 180);
    const pixel = height / Math.max(1, this.canvas.clientHeight);
    const scale = pixel * 128 / 9;
    const x = height * this.camera.aspect / 2 - 12 * pixel - 4.5 * scale;
    const y = -height / 2 + 12 * pixel + 3.25 * scale;
    this.track.group.position.copy(new THREE.Vector3(x, y, -distance).applyMatrix4(this.camera.matrixWorld));
    this.track.group.quaternion.copy(this.camera.quaternion); this.track.group.scale.setScalar(scale);
    this.track.marker.position.set(-3 + Math.max(0, Math.min(1, this.position - this.focus)) * 6, 1, .02);
    this.track.group.updateMatrixWorld(true);
    const railA = new THREE.Vector3(-4.5, -3.25, 0).applyMatrix4(this.track.group.matrixWorld).project(this.camera);
    const railB = new THREE.Vector3(4.5, 3.25, 0).applyMatrix4(this.track.group.matrixWorld).project(this.camera);
    this.canvas.dataset.railBounds = JSON.stringify([railA.x, railA.y, railB.x, railB.y]);
    this.canvas.dataset.timingTrack = 'camera-facing';
    this.canvas.dataset.timingBeat = (1 + Math.max(0, Math.min(1, this.position - this.focus)) * 4).toFixed(3);
  }

  setVoiceLeading(candidate: TransitionCandidate | null) {
    disposeTree(this.voiceLayer); this.voiceLayer.clear();
    this.canvas.dataset.voicePaths = String(candidate?.movements.length ?? 0);
    if (!candidate) { this.render(); return; }
    const voicePoint = (pitch: number, next: boolean) => {
      if (!this.overview) return point(pitch, next ? -SPACING : 0);
      const p = overviewPoint(pitch, this.focus + (next ? 1 : 0), this.count);
      return new THREE.Vector3(p.x, p.y, p.z);
    };
    for (const voice of candidate.movements) {
      const a = voice.from ? voicePoint(voice.from.midi % 12, false) : null;
      const b = voice.to ? voicePoint(voice.to.midi % 12, true) : null;
      if (a && b) {
        const curve = new THREE.LineCurve3(a, b);
        const color = 0x37465e;
        if (voice.semitones === 0) {
          const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 1, .045, 6, false), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false }));
          line.renderOrder = 25; this.voiceLayer.add(line);
        } else {
          const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
          const line = new THREE.Line(geometry, new THREE.LineDashedMaterial({ color, dashSize: .18, gapSize: .12, depthTest: false, depthWrite: false, fog: false }));
          line.computeLineDistances(); line.renderOrder = 25; this.voiceLayer.add(line);
          const arrow = new THREE.Mesh(new THREE.ConeGeometry(.12, .30, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false }));
          arrow.position.copy(curve.getPoint(.72)); arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(.72).normalize());
          arrow.renderOrder = 25; this.voiceLayer.add(arrow);
        }
      }

    }
    this.render();
  }

  setTempo(tempo: number) { this.secondsPerChord = 240 / tempo; }

  setPlayback(position: (() => number) | null) { this.playbackPosition = position; this.syncLoop(); }
  private setPosition(position: number) {
    this.position = position;
    this.morphProgress = this.morph?.canMorph ? morphAmount(position, this.focus, this.secondsPerChord) : 0;
    this.morph?.update(this.morphProgress);
    this.canvas.dataset.morph = this.morphProgress.toFixed(4);
    this.data.position.z = this.overview ? 0 : (position - this.anchor) * SPACING;
    if (this.cursor) this.cursor.position.x = overviewX(position, this.count);
    this.canvas.dataset.position = position.toFixed(3);
    if (this.motionProbe) this.canvas.dataset.backgroundZ = this.motionProbe.getWorldPosition(new THREE.Vector3()).z.toFixed(4);
    this.updateCamera();
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
    if (this.morphProgress > 0) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    return this.raycaster.intersectObjects(this.noteMeshes, false)[0]?.object.userData.pitch ?? null;
  }

  pickOccurrence(clientX: number, clientY: number): number | null {
    if (!this.overview || !this.count) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // Select the closest projected chord axis position, including when the camera
    // is edge-on to the old z=0 picking plane.
    let best = -1, bestDistance = 64 * 64;
    for (let i = 0; i < this.count; i++) {
      const projected = new THREE.Vector3(overviewX(i, this.count), 0, 0).project(this.camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const x = rect.left + (projected.x + 1) * rect.width / 2;
      const y = rect.top + (1 - projected.y) * rect.height / 2;
      const distance = (clientX - x) ** 2 + (clientY - y) ** 2;
      if (distance < bestDistance) { best = i; bestDistance = distance; }
    }
    return best < 0 ? null : best;
  }

  dispose() {
    if (this.destroyed) return;
    this.destroyed = true; this.renderer.setAnimationLoop(null);
    this.resize.disconnect(); this.intersection?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility); this.canvas.removeEventListener('webglcontextlost', this.onLost);
    disposeTree(this.scene); this.renderer.dispose();
  }
}
