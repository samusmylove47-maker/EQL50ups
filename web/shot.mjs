import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:4600/', { waitUntil: 'networkidle' });
// build a character and import the real export, as the verifier did
await p.evaluate(() => localStorage.clear());
await p.goto('http://localhost:4600/#/characters/new', { waitUntil: 'networkidle' });
await p.fill('input[type=text]', 'Avenrae').catch(()=>{});
for (const c of ['WAR','BRD','BER']) await p.click(`text=${c}`).catch(()=>{});
await p.click('button:has-text("Create")').catch(()=>{});
await p.waitForTimeout(600);
const url = p.url();
console.log('after create:', url);
await b.close();
