# Driving a real browser in this environment

Playwright's browser **download** is blocked by the egress proxy
(`cdn.playwright.dev` returns 403). Do **not** run `npx playwright install` —
it will fail. Chromium is already installed; point Playwright at it directly.

```
Executable: /opt/pw-browsers/chromium-1194/chrome-linux/chrome
Headless shell: /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

## Working recipe

```js
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// Always capture these — silent console errors are the most common defect.
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'shot.png', fullPage: true });
await browser.close();
```

For `playwright.config.ts`, set the same path:

```ts
use: { launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] } }
```

## Serving the app

```bash
cd /home/user/EQL50ups/web
npm run build
npx vite preview --port 4173 --host 127.0.0.1 &
```

`vite preview` silently picks a **different port** if 4173 is taken, so check
its output or curl the port before assuming it is up. Kill stale servers with
`pkill -f "vite preview"`.

## Routes

```
/                      landing
/#/characters          character list
/#/character/new       creation
/#/set/:id             gear set editor (also /exaltations, /weights)
/#/items               item browser
/#/share/<payload>     shared read-only set
```

## Standing checks for every screen

- `document.body.innerText` must never contain `NaN`, `undefined`, `[object Object]`.
- Zero console errors and zero page errors.
- Every interactive control reachable and operable by keyboard; visible focus ring.
- No horizontal page scroll at 1280, 1024 and 768 px wide.
