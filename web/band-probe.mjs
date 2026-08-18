import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4700/#/items', { waitUntil: 'networkidle' });
await p.fill('input[type=search], input[placeholder*="earch"]', 'Shadow Rage Helm').catch(()=>{});
await p.waitForTimeout(900);
const row = p.locator('text=Shadow Rage Helm').first();
await row.hover().catch(()=>{});
await p.waitForTimeout(700);
const win = p.locator('.iwin').first();
if (!(await win.count())) { console.log('NO ITEM WINDOW'); await b.close(); process.exit(0); }
const info = await win.evaluate((el) => {
  const body = el.querySelector('.iwin-body');
  const cs = getComputedStyle(body);
  const title = el.querySelector('.iwin-title');
  return {
    standing: el.getAttribute('data-standing'),
    bandColor: cs.borderTopColor,
    bandWidth: cs.borderTopWidth,
    titleBg: getComputedStyle(title).backgroundImage.slice(0, 60),
    winTop: getComputedStyle(el).borderTopColor,
  };
});
console.log(JSON.stringify(info, null, 1));
await win.screenshot({ path: '../.artifacts/band-after.png' });
await b.close();
