import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

export type BlueprintTierKind = 'base' | 'floor' | 'roof';
export type BlueprintLineWeight = 'structure' | 'accent';

export interface BlueprintLineStyle {
  color?: THREE.ColorRepresentation;
  accentColor?: THREE.ColorRepresentation;
  thresholdAngle?: number;
  dashed?: boolean;
  weight?: BlueprintLineWeight;
  /** Additive glow pass (accent lines). */
  glow?: boolean;
  /** Resting opacity for structure/floor lines (glow stays softer). */
  opacity?: number;
}

export type BlueprintLineObject = LineSegments2;

export interface BlueprintTier {
  kind: BlueprintTierKind;
  index: number;
  yMin: number;
  yMax: number;
  lineObjects: BlueprintLineObject[];
}

const DEFAULT_LINE = 0x9fb4c8;
const DEFAULT_ACCENT = 0x7dd3fc;

const STRUCTURE_WIDTH = 1.15;
const ACCENT_WIDTH = 1.65;
const GLOW_WIDTH = 2.4;
const GLOW_OPACITY = 0.12;

export function isBlueprintLineObject(node: THREE.Object3D): node is BlueprintLineObject {
  return (node as BlueprintLineObject).isLineSegments2 === true;
}

function targetLinewidth(style: BlueprintLineStyle, glowPass: boolean): number {
  if (glowPass) {
    return style.weight === 'accent' ? GLOW_WIDTH : GLOW_WIDTH * 0.85;
  }
  return style.weight === 'accent' ? ACCENT_WIDTH : STRUCTURE_WIDTH;
}

type MaterialStyle = BlueprintLineStyle & { glowPass?: boolean };

export function createBlueprintLineMaterial(style: MaterialStyle): LineMaterial {
  const glowPass = style.glowPass === true;
  const mat = new LineMaterial({
    color: new THREE.Color(style.color ?? (style.weight === 'accent' ? DEFAULT_ACCENT : DEFAULT_LINE)),
    linewidth: targetLinewidth(style, glowPass),
    transparent: true,
    opacity: glowPass ? GLOW_OPACITY : (style.opacity ?? 1),
    dashed: !glowPass && (style.dashed ?? false),
    dashSize: 0.22,
    gapSize: 0.16,
    alphaToCoverage: !glowPass,
  });
  if (glowPass) {
    mat.blending = THREE.AdditiveBlending;
    mat.depthWrite = false;
  }
  return mat;
}

function fatLinesFromEdges(
  edges: THREE.EdgesGeometry,
  style: BlueprintLineStyle,
): BlueprintLineObject[] {
  const lineGeo = new LineSegmentsGeometry();
  lineGeo.fromEdgesGeometry(edges);
  edges.dispose();

  const weight = style.weight ?? 'structure';
  const primaryStyle: MaterialStyle = { ...style, weight };
  const primary = new LineSegments2(lineGeo, createBlueprintLineMaterial(primaryStyle));
  primary.userData['blueprintStyleWeight'] = weight;
  primary.userData['blueprintLineColor'] = style.color ?? (weight === 'accent' ? DEFAULT_ACCENT : DEFAULT_LINE);
  primary.userData['blueprintTargetOpacity'] = style.opacity ?? 1;
  primary.userData['blueprintTargetLinewidth'] = targetLinewidth(primaryStyle, false);
  if (primaryStyle.dashed) {
    primary.computeLineDistances();
  }

  const result: BlueprintLineObject[] = [primary];
  if (weight === 'accent' || style.glow) {
    const glowStyle: MaterialStyle = { ...style, weight, dashed: false, glowPass: true };
    const glow = new LineSegments2(lineGeo, createBlueprintLineMaterial(glowStyle));
    glow.userData['blueprintGlow'] = true;
    glow.userData['blueprintTargetLinewidth'] = targetLinewidth(glowStyle, true);
    result.push(glow);
  }
  return result;
}

/** Extract architectural edge lines from a box (or any BufferGeometry). */
export function meshToBlueprintLines(
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  style: BlueprintLineStyle = {},
): BlueprintLineObject[] {
  const threshold =
    style.thresholdAngle ?? (style.weight === 'structure' ? 8 : style.weight === 'accent' ? 12 : 10);
  const edges = new THREE.EdgesGeometry(geometry, threshold);
  edges.applyMatrix4(matrix);
  return fatLinesFromEdges(edges, style);
}

/** Box at position with size — returns line segments only. */
export function boxBlueprintLines(
  w: number,
  h: number,
  d: number,
  position: THREE.Vector3,
  style?: BlueprintLineStyle,
): BlueprintLineObject[] {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
  const lines = meshToBlueprintLines(geo, mat, style);
  geo.dispose();
  return lines;
}

export function disposeBlueprintGeometry(geo: THREE.BufferGeometry): void {
  geo.dispose();
}

/** Group line segments into a tier for animation. */
export function createBlueprintTier(
  kind: BlueprintTierKind,
  index: number,
  yMin: number,
  yMax: number,
  segments: BlueprintLineObject[],
): BlueprintTier {
  const group = new THREE.Group();
  group.userData['blueprintTierKind'] = kind;
  group.userData['blueprintTierIndex'] = index;
  group.userData['blueprintYMin'] = yMin;
  group.userData['blueprintYMax'] = yMax;

  for (const seg of segments) {
    group.add(seg);
  }

  return { kind, index, yMin, yMax, lineObjects: segments };
}

export function tierGroupFromTier(tier: BlueprintTier): THREE.Group {
  const g = new THREE.Group();
  g.userData['blueprintTierKind'] = tier.kind;
  g.userData['blueprintTierIndex'] = tier.index;
  g.userData['blueprintYMin'] = tier.yMin;
  g.userData['blueprintYMax'] = tier.yMax;
  for (const line of tier.lineObjects) {
    g.add(line);
  }
  return g;
}

export function collectTiersFromRoot(root: THREE.Object3D): BlueprintTier[] {
  const tiers: BlueprintTier[] = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.Group) || node.userData['blueprintTierKind'] == null) {
      return;
    }
    const lines: BlueprintLineObject[] = [];
    node.children.forEach((child) => {
      if (isBlueprintLineObject(child)) {
        lines.push(child);
      }
    });
    if (lines.length === 0) {
      return;
    }
    tiers.push({
      kind: node.userData['blueprintTierKind'] as BlueprintTierKind,
      index: node.userData['blueprintTierIndex'] as number,
      yMin: node.userData['blueprintYMin'] as number,
      yMax: node.userData['blueprintYMax'] as number,
      lineObjects: lines,
    });
  });
  return tiers.sort((a, b) => a.yMin - b.yMin || a.index - b.index);
}

export function swapLineMaterial(
  line: BlueprintLineObject,
  dashed: boolean,
  color: THREE.ColorRepresentation = DEFAULT_LINE,
): void {
  if (line.userData['blueprintGlow']) {
    return;
  }
  const weight = (line.userData['blueprintStyleWeight'] as BlueprintLineWeight) ?? 'structure';
  const old = line.material as LineMaterial;
  const prevOpacity = old.opacity;
  old.dispose();
  const style: BlueprintLineStyle = {
    color: color ?? line.userData['blueprintLineColor'] ?? DEFAULT_LINE,
    weight,
    dashed,
  };
  line.material = createBlueprintLineMaterial(style);
  const mat = line.material as LineMaterial;
  mat.opacity = prevOpacity;
  line.userData['blueprintTargetLinewidth'] = targetLinewidth(style, false);
  if (dashed) {
    line.computeLineDistances();
  }
}

export function blueprintStructure(style?: Partial<BlueprintLineStyle>): BlueprintLineStyle {
  return {
    weight: 'structure',
    color: DEFAULT_LINE,
    thresholdAngle: 8,
    ...style,
  };
}

export function blueprintFloor(style?: Partial<BlueprintLineStyle>): BlueprintLineStyle {
  return {
    weight: 'structure',
    color: DEFAULT_LINE,
    thresholdAngle: 8,
    opacity: 0.55,
    glow: false,
    ...style,
  };
}

export function blueprintAccent(style?: Partial<BlueprintLineStyle>): BlueprintLineStyle {
  return {
    weight: 'accent',
    color: style?.color ?? DEFAULT_ACCENT,
    accentColor: style?.accentColor ?? DEFAULT_ACCENT,
    thresholdAngle: 12,
    glow: true,
    ...style,
  };
}

export function setBlueprintLineOpacity(line: BlueprintLineObject, opacity: number): void {
  const mat = line.material as LineMaterial;
  mat.transparent = true;
  if (line.userData['blueprintGlow']) {
    mat.opacity = opacity * GLOW_OPACITY;
    return;
  }
  const rest = (line.userData['blueprintTargetOpacity'] as number) ?? 1;
  mat.opacity = opacity * rest;
}

export function setBlueprintLineWidthScale(line: BlueprintLineObject, scale: number): void {
  const mat = line.material as LineMaterial;
  const target =
    (line.userData['blueprintTargetLinewidth'] as number) ?? mat.linewidth;
  mat.linewidth = target * scale;
}

export function updateBlueprintLineResolution(root: THREE.Object3D, width: number, height: number): void {
  const resolution = new THREE.Vector2(Math.max(1, width), Math.max(1, height));
  root.traverse((node) => {
    if (!isBlueprintLineObject(node)) {
      return;
    }
    const mat = node.material as LineMaterial;
    if (mat.resolution) {
      mat.resolution.copy(resolution);
    }
  });
}

export function disposeLineObject(obj: THREE.Object3D): void {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  obj.traverse((node) => {
    if (!isBlueprintLineObject(node)) {
      return;
    }
    const geo = node.geometry as LineSegmentsGeometry;
    if (geo && !node.userData['blueprintGlow'] && !disposedGeos.has(geo)) {
      disposedGeos.add(geo);
      geo.dispose();
    }
    const mat = node.material as LineMaterial;
    mat?.dispose();
  });
}
