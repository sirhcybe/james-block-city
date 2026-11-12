// Draws the app icons (PWA, spec 007) from an inline SVG with headless Chrome, and writes PNGs to
// public/icons. Run once after changing the design: `node scripts/make-icons.mjs`. Output is committed.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#3FB8E0"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
    <ellipse cx="256" cy="430" rx="230" ry="60" fill="#7BD35A" stroke="#2B2D42" stroke-width="10"/>
    <rect x="70" y="190" width="110" height="230" rx="14" fill="#2F6FDE" stroke="#2B2D42" stroke-width="10"/>
    <rect x="200" y="110" width="112" height="310" rx="14" fill="#FFD23F" stroke="#2B2D42" stroke-width="10"/>
    <rect x="332" y="220" width="110" height="200" rx="14" fill="#E63946" stroke="#2B2D42" stroke-width="10"/>
    <g fill="#7EC8F2" stroke="#2B2D42" stroke-width="6">
      <rect x="95" y="225" width="26" height="30" rx="4"/><rect x="130" y="225" width="26" height="30" rx="4"/>
      <rect x="95" y="280" width="26" height="30" rx="4"/><rect x="130" y="280" width="26" height="30" rx="4"/>
      <rect x="357" y="255" width="26" height="30" rx="4"/><rect x="392" y="255" width="26" height="30" rx="4"/>
    </g>
    <polygon points="256,40 274,86 322,86 284,114 298,160 256,132 214,160 228,114 190,86 238,86"
      fill="#FFF3B0" stroke="#2B2D42" stroke-width="8" stroke-linejoin="round"/>
  </g>
</svg>`;

mkdirSync('public/icons', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 60],
  ['apple-touch-icon.png', 180, 0],
]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg(pad)}`);
  await p.screenshot({ path: `public/icons/${name}`, omitBackground: false });
  console.log('wrote', name);
}
await b.close();
