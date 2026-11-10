import { DRIVE_TUNING } from './entities/LaneDriver';

/**
 * Dev-only (`npm run dev`, then `?play&drive`): sliders for the road-assist feel, applied live.
 * "Copy" puts the current values on the clipboard to paste into `src/config.ts`.
 * Never in the production build (main.ts only imports it in DEV).
 */
const KNOBS: {
  key: keyof typeof DRIVE_TUNING;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'maxSpeed', label: 'top speed (tiles/s)', min: 2, max: 10, step: 0.1 },
  { key: 'accel', label: 'acceleration', min: 1, max: 20, step: 0.5 },
  { key: 'brake', label: 'braking', min: 2, max: 30, step: 0.5 },
  { key: 'cornerSpeed', label: 'corner speed', min: 1, max: 8, step: 0.1 },
  { key: 'turnRadius', label: 'corner curve (tiles)', min: 0, max: 1.5, step: 0.05 },
  { key: 'uturnSec', label: 'U-turn spin (s)', min: 0.1, max: 1, step: 0.05 },
];

export function installDriveTuning(): void {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:10;background:#fffffff0;font:12px system-ui;' +
    'padding:8px 10px;border-radius:8px;box-shadow:0 2px 8px #0004;color:#2b2d42;width:240px';
  for (const k of KNOBS) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:4px 0';
    const val = document.createElement('b');
    val.textContent = ` ${DRIVE_TUNING[k.key]}`;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: k.min, max: k.max, step: k.step });
    input.value = String(DRIVE_TUNING[k.key]);
    input.style.width = '100%';
    input.addEventListener('input', () => {
      DRIVE_TUNING[k.key] = Number(input.value);
      val.textContent = ` ${input.value}`;
    });
    // Keep arrow keys for driving, not for nudging the slider.
    input.addEventListener('keydown', (e) => e.preventDefault());
    row.append(k.label, val, input);
    box.append(row);
  }
  const copy = document.createElement('button');
  copy.textContent = 'Copy values';
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(DRIVE_TUNING, null, 2));
  });
  box.append(copy);
  document.body.append(box);
}
