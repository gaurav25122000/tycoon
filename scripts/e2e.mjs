// End-to-end checks: starts the server in-process, drives Chromium, saves screenshots, reports console errors.
// Usage: node scripts/e2e.mjs <scenario...>   (run `npx vite build` first)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'tycoon-shots');
fs.mkdirSync(SHOTS, { recursive: true });
process.env.PORT = process.env.PORT || '8123';
process.env.TYCOON_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tycoon-data-'));
await import('../server.js');
const BASE = `http://localhost:${process.env.PORT}`;
const EXE = process.env.CHROME || path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const browser = await chromium.launch({ executablePath: EXE, headless: !process.env.HEADED, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required'] });

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const errors = [];
let shotN = 0;

async function open(device = DESKTOP, label = 'page') {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
  await page.goto(BASE + '/');
  await page.waitForFunction(() => window.__tycoon && window.__tycoon.scene, null, { timeout: 60000 });
  page.label = label;
  return page;
}
async function shot(page, name) {
  await wait(450); // let panels finish popping in
  const file = path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${page.label}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('shot', file);
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// start a local game straight from a setup object
async function local(page, seats, settings = {}) {
  await page.evaluate(([seats, settings]) => {
    const T = window.__tycoon;
    T.startLocal({ mode: 'pass', seats, settings: { ...T.E.DEFAULTS, ...settings } });
  }, [seats, settings]);
  await page.waitForFunction(() => window.__tycoon.game && window.__tycoon.game.presenter.view);
  await page.evaluate(() => window.__tycoon.game.presenter.idle());
}

const scenarios = (await import('./flows.mjs')).default;
const names = process.argv.slice(2);
const t0 = Date.now();
for (const n of names) {
  if (!scenarios[n]) { console.log('unknown scenario', n); continue; }
  console.log(`\n=== ${n}`);
  const limit = +(process.env.SCENARIO_SECONDS || 280) * 1000;
  try {
    await Promise.race([scenarios[n]({ open, shot, wait, local, DESKTOP, PHONE }), wait(limit).then(() => { throw new Error(`timed out after ${limit / 1000}s`); })]);
    console.log(`=== ${n} done`);
  }
  catch (e) { errors.push(`[${n}] FAILED: ${e.stack || e.message}`); console.log(`=== ${n} FAILED: ${e.message}`); }
}
console.log(`\n${errors.length} problem(s) in ${Math.round((Date.now() - t0) / 1000)}s`);
errors.forEach(e => console.log(' -', e));
await browser.close();
fs.rmSync(process.env.TYCOON_DATA, { recursive: true, force: true });
process.exit(errors.length ? 1 : 0);
