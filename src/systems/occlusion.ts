import { depthOf, isInFrontOf, resolveDepth, type Footprint } from '../iso/projection';

export interface Occluder {
  id: string;
  box: Footprint;
  /** Static depth of the occluder's sprite. */
  depth: number;
  /** Whether the occluder's visible pixels overlap the walker's sprite on screen this frame. */
  overlaps: boolean;
}

export interface OcclusionResult {
  /** Depth to give the walker so it sorts correctly against every overlapping occluder. */
  depth: number;
  /** Occluders drawn over the walker (they should fade). */
  hiding: Set<string>;
}

/**
 * Per-frame depth + fade decision for one walker among static boxes.
 * Only occluders that overlap the walker on screen matter; for those, the walker is in front if it
 * is past the box's far x or far y edge, otherwise behind (and the box hides it).
 */
export function resolveOcclusion(
  walker: { x: number; y: number; r: number },
  occluders: Occluder[],
): OcclusionResult {
  const own = depthOf(walker.x, walker.y) + 50;
  const front: number[] = [];
  const behind: number[] = [];
  const hiding = new Set<string>();
  for (const o of occluders) {
    if (!o.overlaps) continue;
    if (isInFrontOf(walker.x, walker.y, o.box, walker.r * 0.5)) front.push(o.depth);
    else {
      behind.push(o.depth);
      hiding.add(o.id);
    }
  }
  return { depth: resolveDepth(own, front, behind), hiding };
}
