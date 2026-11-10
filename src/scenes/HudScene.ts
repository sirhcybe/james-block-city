import Phaser from 'phaser';
import { RS } from '../art/renderScale';
import { UI } from '../art/ui';
import type { InputMapper } from '../input/InputMapper';
import { INPUT_KEY } from './CityScene';

/** Screen-space overlay. For now: the floating touch joystick only. */
export class HudScene extends Phaser.Scene {
  private base!: Phaser.GameObjects.Image;
  private knob!: Phaser.GameObjects.Image;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.cameras.main.setZoom(RS).setOrigin(0, 0);
    this.base = this.add
      .image(0, 0, UI.stickBase)
      .setScale(1 / RS)
      .setVisible(false);
    this.knob = this.add
      .image(0, 0, UI.stickKnob)
      .setScale(1 / RS)
      .setVisible(false);
  }

  update(): void {
    const mapper = this.registry.get(INPUT_KEY) as InputMapper | undefined;
    const js = mapper?.joystick;
    const show = !!js?.active;
    this.base.setVisible(show);
    this.knob.setVisible(show);
    if (js && show) {
      this.base.setPosition(js.origin.x, js.origin.y);
      this.knob.setPosition(js.knob.x, js.knob.y);
    }
  }
}
