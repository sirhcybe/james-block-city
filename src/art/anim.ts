import type Phaser from 'phaser';

/**
 * Squash and stretch (docs/art-style.md: "everything bounces"). A quick squash on landing: wider
 * and shorter for a moment, then back to the size it had. Safe to call again mid-squash.
 */
export function landSquash(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  amount = 0.14,
  ms = 90,
): void {
  const key = 'squashBase';
  const base =
    (img.getData(key) as { x: number; y: number } | undefined) ??
    ({ x: img.scaleX, y: img.scaleY } as const);
  img.setData(key, base);
  scene.tweens.add({
    targets: img,
    scaleX: base.x * (1 + amount * 0.8),
    scaleY: base.y * (1 - amount),
    duration: ms,
    yoyo: true,
    ease: 'Quad.easeOut',
    onComplete: () => {
      img.setScale(base.x, base.y);
      img.setData(key, undefined);
    },
  });
}
