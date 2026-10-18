import {
  BlueprintLineObject,
  BlueprintTier,
  setBlueprintLineOpacity,
  setBlueprintLineWidthScale,
  swapLineMaterial,
} from './onboarding-3d-edge-lines';

export type BlueprintRevealReason = 'preset' | 'floors';

export interface BlueprintTierAnim {
  tier: BlueprintTier;
  startMs: number;
  duration: number;
  lineObjects: BlueprintLineObject[];
}

const STAGGER_MS = 96;
const DURATION_MS = 520;

export function startBlueprintReveal(
  tiers: BlueprintTier[],
  nowMs: number,
  _reason: BlueprintRevealReason,
): BlueprintTierAnim[] {
  const sorted = [...tiers].sort((a, b) => a.yMin - b.yMin || a.index - b.index);
  const anims: BlueprintTierAnim[] = [];

  sorted.forEach((tier, order) => {
    for (const line of tier.lineObjects) {
      if (!line.userData['blueprintGlow']) {
        swapLineMaterial(line, true);
      }
      line.visible = true;
      setBlueprintLineOpacity(line, 0);
      setBlueprintLineWidthScale(line, 0.55);
    }
    anims.push({
      tier,
      startMs: nowMs + order * STAGGER_MS,
      duration: DURATION_MS,
      lineObjects: tier.lineObjects,
    });
  });

  return anims;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 2;
}

export function tickBlueprintLineAnimations(anims: BlueprintTierAnim[], nowMs: number): boolean {
  let anyActive = false;

  for (const anim of anims) {
    const elapsed = nowMs - anim.startMs;
    if (elapsed < 0) {
      anyActive = true;
      continue;
    }

    const t = Math.min(1, elapsed / anim.duration);
    const active = t < 1;
    if (active) {
      anyActive = true;
    }

    const eased = easeOut(t);
    const opacity = active ? eased : 1;
    const widthScale = active ? 0.55 + 0.45 * eased : 1;

    for (const line of anim.lineObjects) {
      line.visible = true;
      setBlueprintLineOpacity(line, opacity);
      setBlueprintLineWidthScale(line, widthScale);
      if (!active && !line.userData['blueprintGlow']) {
        swapLineMaterial(line, false);
      }
    }
  }

  return anyActive;
}
