import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LayoutFocusField, Onboarding3dMode, Onboarding3dVisual } from './onboarding-3d.types';
import {
  buildPropertyBuildingLayout,
  buildRoomTypesShowcase,
  paletteFromHex,
  propertyBuildingLayoutCount,
} from './onboarding-3d-floor-grid';
import {
  buildEstablishmentBlueprintModel,
  buildEstablishmentModel,
  buildEstablishmentPropertyBuilding,
  buildPropertyBlueprintUnit,
} from './onboarding-3d-establishment-models';
import {
  BlueprintRevealReason,
  BlueprintTierAnim,
  startBlueprintReveal,
  tickBlueprintLineAnimations,
} from './onboarding-3d-blueprint-animation';
import {
  collectTiersFromRoot,
  isBlueprintLineObject,
  updateBlueprintLineResolution,
} from './onboarding-3d-edge-lines';
import { buildRoomTypesBlueprintShowcase } from './onboarding-3d-room-types-blueprint';
import {
  Onboarding3dEnvVariant,
  buildPropertyLayoutEnvDecor,
  disposeEnvTexture,
  makePropertyLayoutSkyTexture,
} from './onboarding-3d-environment';
import {
  LayoutSnapshot,
  layoutSnapshotChanged,
  startLayoutBuildingAnimations,
  tickLayoutBuildingAnimations,
} from './onboarding-3d-layout-animation';

@Component({
  selector: 'app-onboarding-3d-scene',
  standalone: true,
  template: `<canvas
    #canvas
    class="onb-3d-canvas"
    [class.onb-3d-canvas--interactive]="interactive"
    aria-hidden="true"
  ></canvas>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-height: 220px;
      }
      .onb-3d-canvas {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
      }
      .onb-3d-canvas--interactive {
        cursor: grab;
      }
      .onb-3d-canvas--interactive:active {
        cursor: grabbing;
      }
    `,
  ],
})
export class Onboarding3dScene implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() mode: Onboarding3dMode = 'establishment';
  @Input() visual: Onboarding3dVisual = 'tower';
  /** Establishment preset id (hotel, hospital, …) — drives dedicated 3D model. */
  @Input() presetId: string | null = 'hotel';
  @Input() primaryColor: string | null = '#2563eb';
  @Input() highlightPulse = 0;
  @Input() step = 1;
  @Input() compounds = 1;
  @Input() buildingsPerCompound = 1;
  @Input() floorsPerBuilding = 2;
  @Input() roomsPerFloor = 4;
  @Input() roomTypeCount = 2;
  @Input() roomTypeLabels: string[] = [];
  @Input() activeTypeIndex = 0;
  @Input() layoutFocus: LayoutFocusField = 'none';
  /** Drag to orbit / scroll to zoom the 3D preview. */
  @Input() interactive = true;
  /** Architectural line sketch vs legacy solid meshes. */
  @Input() renderStyle: 'blueprint' | 'legacy' = 'blueprint';

  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private world = new THREE.Group();
  private particles?: THREE.Points;
  private rafId = 0;
  private resizeObserver?: ResizeObserver;
  private ready = false;
  private targetCam = new THREE.Vector3(8, 6, 10);
  private lookAt = new THREE.Vector3(0, 1.2, 0);
  private controls?: OrbitControls;
  private groundMat?: THREE.MeshStandardMaterial;
  private groundMesh?: THREE.Mesh;
  private particleMat?: THREE.PointsMaterial;
  private envDecor = new THREE.Group();
  private skyTexture?: THREE.CanvasTexture;
  private layoutSnapshot: LayoutSnapshot = {
    compounds: 0,
    buildingsPerCompound: 0,
    floorsPerBuilding: 0,
    roomsPerFloor: 0,
  };
  private layoutAnims: ReturnType<typeof startLayoutBuildingAnimations> = [];
  private layoutAnimating = false;
  private layoutAnimSeen = false;
  private blueprintAnims: BlueprintTierAnim[] = [];
  private blueprintGrid?: THREE.GridHelper;
  private lastBlueprintPreset: string | null = null;
  private lastBlueprintFloors = 0;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.ngZone.runOutsideAngular(() => {
      this.init();
      this.ready = true;
      this.rebuild();
      this.loop();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready) {
      return;
    }
    const keys = [
      'visual', 'presetId', 'primaryColor', 'compounds', 'buildingsPerCompound', 'floorsPerBuilding',
      'roomsPerFloor', 'step', 'roomTypeCount', 'roomTypeLabels', 'activeTypeIndex',
      'layoutFocus', 'mode', 'interactive', 'renderStyle',
    ];
    if (keys.some((k) => changes[k])) {
      this.ngZone.runOutsideAngular(() => this.rebuild(changes));
    }
    if (changes['interactive'] && this.ready) {
      this.ngZone.runOutsideAngular(() => this.syncOrbitControls());
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.controls?.dispose();
    this.resizeObserver?.disconnect();
    if (this.blueprintGrid) {
      this.blueprintGrid.geometry.dispose();
      (this.blueprintGrid.material as THREE.Material).dispose();
      this.blueprintGrid = undefined;
    }
    this.disposeGroup(this.world);
    this.disposeGroup(this.envDecor);
    disposeEnvTexture(this.skyTexture);
    this.particles?.geometry.dispose();
    (this.particles?.material as THREE.Material)?.dispose();
    this.renderer?.dispose();
  }

  private init(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? 480;
    const h = parent?.clientHeight ?? 320;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1a3358, 0.038);

    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 120);
    this.camera.position.copy(this.targetCam);
    this.camera.lookAt(this.lookAt);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight(0xe2e8f0, 0x1a3358, 0.72);
    const key = new THREE.DirectionalLight(0xffffff, 0.88);
    key.position.set(5, 11, 7);
    const fill = new THREE.DirectionalLight(0x94a3b8, 0.42);
    fill.position.set(-6, 4, -4);
    const rim = new THREE.DirectionalLight(0xbfdbfe, 0.28);
    rim.position.set(0, 6, -8);
    this.scene.add(hemi, key, fill, rim);

    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x243b55, roughness: 0.94, metalness: 0 });
    this.groundMesh = new THREE.Mesh(new THREE.CircleGeometry(20, 64), this.groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.groundMesh);

    this.scene.add(this.envDecor);
    this.particles = this.makeParticles();
    this.scene.add(this.particles);
    this.scene.add(this.world);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    if (parent) {
      this.resizeObserver.observe(parent);
    }

    this.applyEnvironmentTheme();
    this.syncOrbitControls();
  }

  private syncOrbitControls(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!this.camera || !canvas) {
      return;
    }
    if (!this.interactive) {
      this.controls?.dispose();
      this.controls = undefined;
      return;
    }
    if (!this.controls) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = true;
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 32;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
      this.controls.rotateSpeed = 0.85;
      this.controls.zoomSpeed = 0.9;
    }
    this.controls.target.copy(this.lookAt);
    this.controls.update();
  }

  private syncCameraToTarget(): void {
    if (!this.camera) {
      return;
    }
    if (this.controls) {
      this.controls.target.copy(this.lookAt);
      this.camera.position.copy(this.targetCam);
      this.controls.update();
      return;
    }
    this.camera.position.copy(this.targetCam);
    this.camera.lookAt(this.lookAt);
  }

  private layoutCameraDistance(): number {
    const compounds = Math.max(1, this.compounds);
    const per = Math.max(1, this.buildingsPerCompound);
    const total = propertyBuildingLayoutCount({
      compounds,
      buildingsPerCompound: per,
    });
    const cols = Math.ceil(Math.sqrt(per));
    const compoundSpread = compounds > 1 ? 2.4 + compounds * 0.15 : 0;
    const gridSpread = (cols - 1) * 1.25;
    const footprint: Record<string, number> = {
      hospital: 1.32,
      student_housing: 1.26,
      residential_compound: 1.18,
      serviced_apartments: 1.08,
      corporate_housing: 1.04,
      hotel: 1.06,
    };
    const scale = footprint[this.presetId ?? 'hotel'] ?? 1;
    return (8 + compoundSpread * 0.55 + gridSpread * 0.35 + Math.sqrt(total) * 0.45) * scale;
  }

  private makeParticles(): THREE.Points {
    const count = 120;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = 2 + Math.random() * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particleMat = new THREE.PointsMaterial({
      color: 0xc7d9ee,
      size: 0.045,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    return new THREE.Points(geo, this.particleMat);
  }

  private useBlueprintRendering(): boolean {
    if (this.renderStyle !== 'blueprint') {
      return false;
    }
    if (this.mode === 'establishment' || this.mode === 'welcome') {
      return true;
    }
    return this.mode === 'property' && this.step >= 1;
  }

  private envVariant(): Onboarding3dEnvVariant {
    if (this.mode === 'property' && this.step >= 2) {
      return 'propertyLayout';
    }
    if (this.mode === 'property' && this.step === 1) {
      return 'roomTypes';
    }
    return 'default';
  }

  private rebuildEnvDecor(variant: Onboarding3dEnvVariant, accent: THREE.Color): void {
    this.disposeGroup(this.envDecor);
    while (this.envDecor.children.length) {
      this.envDecor.remove(this.envDecor.children[0]);
    }
    if (variant === 'propertyLayout') {
      this.envDecor.add(buildPropertyLayoutEnvDecor(accent));
    }
  }

  private applyEnvironmentTheme(): void {
    if (!this.scene) {
      return;
    }
    const accent = new THREE.Color(this.primaryColor ?? '#2563eb');
    const variant = this.envVariant();
    const fog = this.scene.fog as THREE.FogExp2 | null;

    this.rebuildEnvDecor(variant, accent);

    if (this.useBlueprintRendering()) {
      this.applyBlueprintEnvironment(accent);
      return;
    }

    if (this.blueprintGrid) {
      this.scene.remove(this.blueprintGrid);
      this.blueprintGrid.geometry.dispose();
      (this.blueprintGrid.material as THREE.Material).dispose();
      this.blueprintGrid = undefined;
    }

    if (variant === 'propertyLayout') {
      disposeEnvTexture(this.skyTexture);
      this.skyTexture = makePropertyLayoutSkyTexture(accent);
      this.scene.background = this.skyTexture;

      const fogColor = new THREE.Color(0x243d5c);
      fogColor.lerp(accent, 0.1);
      if (fog) {
        fog.color.copy(fogColor);
        fog.density = 0.024;
      }
      if (this.groundMesh) {
        this.groundMesh.visible = false;
      }
      if (this.particles) {
        this.particles.visible = false;
      }
      return;
    }

    disposeEnvTexture(this.skyTexture);
    this.skyTexture = undefined;

    const bg = new THREE.Color(0x132a47);
    bg.lerp(accent, variant === 'roomTypes' ? 0.08 : 0.1);
    this.scene.background = bg;

    const fogColor = new THREE.Color(0x1a3358);
    fogColor.lerp(accent, 0.07);
    if (fog) {
      fog.color.copy(fogColor);
      fog.density = variant === 'roomTypes' ? 0.034 : 0.038;
    }
    if (this.groundMesh) {
      this.groundMesh.visible = true;
    }
    if (this.groundMat) {
      this.groundMat.color.set(0x243b55).lerp(accent, 0.07);
    }
    if (this.particles) {
      this.particles.visible = variant !== 'roomTypes';
    }
    if (this.particleMat) {
      this.particleMat.color.set(0xdbeafe).lerp(accent, 0.2);
      this.particleMat.opacity = variant === 'roomTypes' ? 0.14 : 0.22;
    }
  }

  private applyBlueprintEnvironment(accent: THREE.Color): void {
    if (!this.scene) {
      return;
    }
    disposeEnvTexture(this.skyTexture);
    this.skyTexture = undefined;

    const establishment = this.mode === 'establishment' || this.mode === 'welcome';
    const bg = new THREE.Color(establishment ? 0x040a12 : 0x0d1b2a);
    bg.lerp(accent, establishment ? 0.11 : 0.03);
    this.scene.background = bg;

    const fog = this.scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(bg);
      fog.density = establishment ? 0.024 : 0.028;
    }

    if (this.groundMesh) {
      this.groundMesh.visible = true;
    }
    if (this.groundMat) {
      this.groundMat.color.set(establishment ? 0x040a12 : 0x0d1b2a).lerp(accent, establishment ? 0.1 : 0.06);
    }
    if (this.particles) {
      this.particles.visible = false;
    }

    if (!this.blueprintGrid) {
      this.blueprintGrid = new THREE.GridHelper(14, 28, 0x2a4055, 0x152238);
      this.blueprintGrid.position.y = 0.002;
      this.scene.add(this.blueprintGrid);
    }
    this.tintBlueprintGrid(accent, establishment);
  }

  private tintBlueprintGrid(accent: THREE.Color, establishment: boolean): void {
    if (!this.blueprintGrid) {
      return;
    }
    const center = accent.clone().lerp(new THREE.Color(0x1e3a52), establishment ? 0.45 : 0.65);
    const edge = accent.clone().lerp(new THREE.Color(0x081018), establishment ? 0.72 : 0.82);
    const gridMat = this.blueprintGrid.material;
    const mats = Array.isArray(gridMat) ? gridMat : [gridMat];
    mats.forEach((m, i) => {
      m.transparent = true;
      m.opacity = establishment ? 0.48 : 0.42;
      if ('color' in m && m.color instanceof THREE.Color) {
        m.color.copy(i === 0 ? center : edge);
      }
    });
  }

  private onResize(): void {
    if (!this.renderer || !this.camera) {
      return;
    }
    const parent = this.canvasRef.nativeElement.parentElement;
    if (!parent) {
      return;
    }
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w <= 0 || h <= 0) {
      return;
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.useBlueprintRendering()) {
      this.syncBlueprintLineResolution();
    }
  }

  private afterBlueprintWorldUpdate(): void {
    if (this.useBlueprintRendering()) {
      this.syncBlueprintLineResolution();
    }
  }

  private palette() {
    return paletteFromHex(this.primaryColor);
  }

  private rebuild(changes?: SimpleChanges): void {
    this.disposeGroup(this.world);
    while (this.world.children.length) {
      this.world.remove(this.world.children[0]);
    }
    this.blueprintAnims = [];

    this.applyEnvironmentTheme();
    const palette = this.palette();
    const floorH = this.visual === 'compound' ? 0.32 : 0.42;
    const stackHeight = this.floorsPerBuilding * floorH;
    const now = performance.now();

    if (this.mode === 'establishment' || this.mode === 'welcome') {
      const id = this.presetId ?? 'hotel';
      if (this.useBlueprintRendering()) {
        const { root, tiers } = buildEstablishmentBlueprintModel(id, palette, true);
        this.world.add(root);
        const reason: BlueprintRevealReason =
          changes?.['presetId'] || this.lastBlueprintPreset !== id ? 'preset' : 'floors';
        this.blueprintAnims = startBlueprintReveal(tiers, now, reason);
        this.lastBlueprintPreset = id;
      } else {
        const model = buildEstablishmentModel(id, palette);
        this.world.add(model);
      }
      const camByPreset: Record<string, [number, number, number]> = {
        hospital: [7.2, 3.6, 8.4],
        residential_compound: [6.4, 5.4, 7.2],
        corporate_housing: [6.2, 4.2, 7.4],
        student_housing: [6.8, 3.2, 8.6],
        serviced_apartments: [6.6, 4.6, 7.8],
        hotel: [5.8, 3.8, 7.2],
      };
      const lookByPreset: Record<string, number> = {
        hospital: 0.55,
        residential_compound: 0.32,
        corporate_housing: 0.7,
        student_housing: 0.62,
        serviced_apartments: 0.85,
        hotel: 0.95,
      };
      const cam = camByPreset[id] ?? camByPreset['hotel'];
      this.targetCam.set(cam[0], cam[1], cam[2]);
      this.lookAt.set(0, lookByPreset[id] ?? 0.75, 0);
      this.syncCameraToTarget();
      this.afterBlueprintWorldUpdate();
      return;
    }

    if (this.step === 1) {
      const showcase = this.buildRoomTypesScene(palette, changes, now);
      const focusY = (showcase.userData['showcaseFocusY'] as number) ?? 0.42;
      const camDist = (showcase.userData['showcaseCamDist'] as number) ?? 8.8;
      this.lookAt.set(0, focusY, 0);
      this.targetCam.set(camDist * 0.82, focusY + 3.2, camDist);
      this.syncCameraToTarget();
      this.afterBlueprintWorldUpdate();
      return;
    }

    const layout = this.buildPropertyLayout(palette);
    if (this.useBlueprintRendering()) {
      const tiers = collectTiersFromRoot(layout);
      const presetId = this.presetId ?? 'hotel';
      const presetChanged =
        changes?.['presetId'] != null || this.lastBlueprintPreset !== presetId;
      const reason: BlueprintRevealReason = presetChanged ? 'preset' : 'floors';
      this.blueprintAnims = startBlueprintReveal(tiers, now, reason);
      this.lastBlueprintFloors = this.floorsPerBuilding;
      this.lastBlueprintPreset = presetId;
    } else {
      this.applyPropertyLayoutMotion(layout);
    }

    const zoom = this.step === 3 ? 1.08 : 1;
    const dist = this.layoutCameraDistance() * zoom;
    let camY = 3.2 + stackHeight * 0.55 + Math.min(this.compounds, 6) * 0.08;
    if (this.layoutFocus === 'floors') {
      camY += 0.6;
    }
    if (this.layoutFocus === 'rooms') {
      camY -= 0.15;
    }
    if (this.layoutFocus === 'compounds' || this.layoutFocus === 'buildings') {
      camY += 0.25;
    }
    this.targetCam.set(dist * 0.78, camY, dist * 0.95);
    this.lookAt.set(0, stackHeight * 0.45, 0);
    if (this.layoutAnimating) {
      if (this.controls) {
        this.controls.target.copy(this.lookAt);
      }
    } else {
      this.syncCameraToTarget();
    }
    this.afterBlueprintWorldUpdate();
  }

  private currentLayoutSnapshot(): LayoutSnapshot {
    return {
      compounds: this.compounds,
      buildingsPerCompound: this.buildingsPerCompound,
      floorsPerBuilding: this.floorsPerBuilding,
      roomsPerFloor: this.roomsPerFloor,
    };
  }

  private applyPropertyLayoutMotion(layout: THREE.Group): void {
    const next = this.currentLayoutSnapshot();
    const prev = this.layoutSnapshot;
    const shouldAnimate =
      layout.children.length > 0
      && (!this.layoutAnimSeen || layoutSnapshotChanged(prev, next));

    if (shouldAnimate) {
      this.layoutAnims = startLayoutBuildingAnimations(layout, prev, next, performance.now());
      this.layoutAnimating = true;
      this.layoutAnimSeen = true;
    } else {
      this.layoutAnims = [];
      this.layoutAnimating = false;
    }

    this.layoutSnapshot = { ...next };
  }

  private buildRoomTypesScene(
    palette: ReturnType<typeof paletteFromHex>,
    changes?: SimpleChanges,
    nowMs = performance.now(),
  ): THREE.Group {
    const labels = this.roomTypeLabels.length
      ? this.roomTypeLabels
      : Array.from({ length: Math.max(2, this.roomTypeCount) }, (_, i) => `T${i + 1}`);

    if (this.useBlueprintRendering()) {
      const { root, tiers } = buildRoomTypesBlueprintShowcase(
        labels,
        this.activeTypeIndex,
        palette,
        true,
      );
      this.world.add(root);
      const typesChanged =
        changes?.['roomTypeLabels'] != null
        || changes?.['roomTypeCount'] != null
        || changes?.['activeTypeIndex'] != null;
      this.blueprintAnims = startBlueprintReveal(tiers, nowMs, typesChanged ? 'floors' : 'preset');
      return root;
    }

    const showcase = buildRoomTypesShowcase(labels, this.activeTypeIndex, palette);
    this.world.add(showcase);
    return showcase;
  }

  private buildPropertyLayout(palette: ReturnType<typeof paletteFromHex>): THREE.Group {
    const presetId = this.presetId ?? undefined;
    const presetSpacing: Record<string, number> = {
      hospital: 2.15,
      corporate_housing: 1.55,
      student_housing: 2.05,
      residential_compound: 1.85,
      serviced_apartments: 1.45,
      hotel: 1.55,
    };
    const layout = buildPropertyBuildingLayout({
      compounds: this.compounds,
      buildingsPerCompound: this.buildingsPerCompound,
      floorsPerBuilding: this.floorsPerBuilding,
      roomsPerFloor: this.roomsPerFloor,
      visual: this.visual,
      palette,
      layoutSpacing: presetId ? presetSpacing[presetId] : undefined,
      buildUnit: presetId
        ? (floors, rooms, pal) =>
            this.useBlueprintRendering()
              ? buildPropertyBlueprintUnit(presetId, floors, rooms, pal).root
              : buildEstablishmentPropertyBuilding(presetId, floors, rooms, pal, true)
        : undefined,
    });
    this.world.add(layout);
    return layout;
  }

  private syncBlueprintLineResolution(): void {
    const canvas = this.canvasRef?.nativeElement;
    const parent = canvas?.parentElement;
    if (!parent) {
      return;
    }
    updateBlueprintLineResolution(this.world, parent.clientWidth, parent.clientHeight);
  }

  private disposeGroup(group: THREE.Object3D): void {
    const disposedGeos = new Set<THREE.BufferGeometry>();
    group.traverse((node) => {
      if (isBlueprintLineObject(node)) {
        const geo = node.geometry;
        if (geo && !node.userData['blueprintGlow'] && !disposedGeos.has(geo)) {
          disposedGeos.add(geo);
          geo.dispose();
        }
        (node.material as THREE.Material)?.dispose();
        return;
      }
      if (node instanceof THREE.LineSegments) {
        node.geometry?.dispose();
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => m?.dispose());
        return;
      }
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    const now = performance.now();
    if (this.layoutAnims.length) {
      const still = tickLayoutBuildingAnimations(this.layoutAnims, now);
      if (!still) {
        this.layoutAnims = [];
        this.layoutAnimating = false;
      }
    }

    if (this.blueprintAnims.length) {
      const stillBlueprint = tickBlueprintLineAnimations(this.blueprintAnims, now);
      if (!stillBlueprint) {
        this.blueprintAnims = [];
      }
    }

    if (this.layoutAnimating) {
      this.camera.position.lerp(this.targetCam, 0.055);
      if (this.controls) {
        this.controls.target.lerp(this.lookAt, 0.07);
        this.controls.update();
      } else {
        this.camera.lookAt(this.lookAt);
      }
    } else if (this.controls) {
      this.controls.update();
    } else {
      this.camera.position.lerp(this.targetCam, 0.06);
      this.camera.lookAt(this.lookAt);
    }
    this.renderer.render(this.scene, this.camera);
  };
}
