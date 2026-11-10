// Usage: node shot.mjs <url> <out.png> [mobile] [jsAfterLoad]
import { chromium, devices } from 'playwright';

const [url, out, mobile, js] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext(
  mobile === 'mobile'
    ? { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } }
    : { viewport: { width: 1280, height: 720 } },
);
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForTimeout(1500);
if (js && js !== '-') {
  const r = await page.evaluate(js);
  if (r !== undefined) console.log('eval:', JSON.stringify(r));
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
