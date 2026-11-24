import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import { chromium, devices, webkit } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const site = join(root, '_site');
const firstDate = '2026-11-25';
const fixtureDate = '2099-11-25';
const singleDate = '2099-11-24';
const long = Array.from({ length: 28 }, (_, index) => `Paragraph ${index + 1}. Copy exactly: <tag> & “quotes”.`).join('\n\n');
const fixturePrompt = 'An unbroken string\n' + 'abcdefghijklmnopqrstuvwxyz'.repeat(14) + '\n\n' + long;
const fixturePath = `/fixtures/${fixtureDate}/`;
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];
const viewports = { desktop: { width: 1440, height: 900 }, mobile: { width: 320, height: 720 } };
let browser;
let server;
let temp;
let origin;
let original;

before(async () => {
  execFileSync(process.execPath, ['build.mjs'], { cwd: root });
  temp = await mkdtemp(join(tmpdir(), 'dream-room-test-'));
  for (const name of ['build.mjs', 'assets', 'sessions']) {
    await cp(join(root, name), join(temp, name), { recursive: true });
  }
  const source = await readFile(join(temp, 'sessions', firstDate + '.md'), 'utf8');
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const opening = lines.findIndex((line) => /^`{3,}text$/.test(line));
  const closing = lines.indexOf(lines[opening].slice(0, -4), opening + 1);
  original = lines.slice(opening + 1, closing).join('\n');
  await writeFile(join(temp, 'sessions', singleDate + '.md'), [
    '## Prompt 1 — Single prompt', '', '```text', 'One prompt.', '```', '',
  ].join('\n'));
  await writeFile(join(temp, 'sessions', fixtureDate + '.md'), [
    '## Prompt 1 — A heading visible only to authors',
    '',
    '```text',
    original,
    '```',
    '',
    '## Prompt 2 — Test long text',
    '',
    '```text',
    fixturePrompt,
    '```',
    '',
    '## Prompt 3 — Test last tab',
    '',
    '```text',
    'Last prompt.',
    '```',
    '',
  ].join('\n'));
  execFileSync(process.execPath, ['build.mjs'], { cwd: temp });
  const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const fixture = pathname.startsWith('/fixtures/');
    const directory = fixture ? join(temp, '_site') : site;
    const relative = pathname.replace(fixture ? /^\/fixtures\// : /^\/dream-room\//, '');
    const file = resolve(directory, relative + (pathname.endsWith('/') ? 'index.html' : ''));
    try {
      if (!file.startsWith(directory + '/')) throw new Error('Invalid path');
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] + '; charset=utf-8' });
      response.end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done, reject) => server.listen(0, '127.0.0.1', done).once('error', reject));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.DREAM_ROOM_BROWSER_CHANNEL });
});

after(async () => {
  await browser?.close();
  if (server?.listening) await new Promise((done) => server.close(done));
  if (temp) await rm(temp, { recursive: true, force: true });
});

async function scan(page, label) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate((runTags) => window.axe.run({ runOnly: { type: 'tag', values: runTags } }), tags);
  const failures = result.violations.flatMap(({ id, nodes }) =>
    nodes.map(({ target, failureSummary }) => `${id} ${target.join(' ')}: ${failureSummary}`));
  assert.deepEqual(failures, [], label);
  console.log(`axe ${label}: ${result.passes.length} passed rules, ${result.violations.length} violations, ${result.incomplete.length} rules for review`);
  if (result.incomplete.length) console.log('Review:', result.incomplete.map(({ id }) => id).join(', '));
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
}

async function selected(page, number) {
  await page.waitForFunction((index) => !document.querySelector(`#prompt-${index}`).hidden, number);
  assert.equal(await page.locator('.prompt:visible').count(), 1);
}

async function targets(page) {
  const bounds = await page.locator('button:visible, .tabs a:visible, .back:visible, .session-link:visible')
    .evaluateAll((controls) => controls.map((control) => {
      const { width, height } = control.getBoundingClientRect();
      return [control.textContent.trim(), width, height];
    }));
  for (const [label, width, height] of bounds) assert.ok(width >= 48 && height >= 48, label);
}

test('axe checks the archive and every published session at desktop and 320px', async () => {
  const dirs = await readdir(site, { withFileTypes: true });
  const paths = ['/dream-room/', ...dirs.filter((entry) => entry.isDirectory() && /^\d{4}-/.test(entry.name))
    .map((entry) => `/dream-room/${entry.name}/`)];
  for (const [layout, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport });
    for (const path of paths) {
      assert.equal((await page.goto(origin + path)).status(), 200);
      await scan(page, layout + ' ' + path);
      await noOverflow(page);
      await targets(page);
    }
    await page.close();
  }
});

test('desktop vertical tabs support APG keys, deep links, history and the clipboard', async () => {
  const context = await browser.newContext({ viewport: viewports.desktop, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.goto(origin + fixturePath);
  assert.deepEqual(await page.locator('.pagination:visible').count(), 0);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'All sessions');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-1');
  assert.equal(await page.getByRole('tablist').getAttribute('aria-orientation'), 'vertical');
  await page.keyboard.press('ArrowUp');
  await selected(page, 3);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await selected(page, 2);
  assert.equal(await page.getByRole('tab', { name: 'Prompt 2' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tabpanel', { name: 'Prompt 2' }).count(), 1);
  await page.keyboard.press('End');
  await selected(page, 3);
  await page.keyboard.press('ArrowDown');
  await selected(page, 1);
  await page.keyboard.press('ArrowDown');
  await selected(page, 2);
  assert.ok(page.url().endsWith('#prompt-2'));
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt-2');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Copied' }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixturePrompt);
  assert.equal(await page.evaluate(() => document.activeElement.className), 'copy');
  assert.equal(await page.locator('#copy-status').textContent(), 'Prompt copied to clipboard.');
  await scan(page, 'desktop multi-prompt, copied state');
  await page.reload();
  await selected(page, 2);
  await page.goBack();
  await selected(page, 1);
  await page.goForward();
  await selected(page, 2);
  await context.close();
});

test('mobile pagination manages focus and handles clipboard rejection', async () => {
  const context = await browser.newContext({ viewport: viewports.mobile, hasTouch: true });
  await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: () => Promise.reject(new Error('Clipboard denied for test')) },
  }));
  const page = await context.newPage();
  await page.goto(origin + `/fixtures/${singleDate}/`);
  assert.equal(await page.getByRole('navigation', { name: 'Prompt pages' }).count(), 0);
  assert.equal(await page.getByRole('tab').count(), 0);
  await page.goto(origin + fixturePath);
  const pagination = page.getByRole('navigation', { name: 'Prompt pages' });
  assert.equal(await pagination.getByRole('button', { name: 'Previous prompt' }).isDisabled(), true);
  assert.equal(await pagination.getByText('Prompt 1 of 3').isVisible(), true);
  await pagination.getByRole('button', { name: 'Next prompt' }).tap();
  await selected(page, 2);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt-2');
  assert.ok((await page.locator('#prompt-2').boundingBox()).y >= 0);
  assert.ok(page.url().endsWith('#prompt-2'));
  await noOverflow(page);
  await targets(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const manual = page.getByRole('textbox', { name: 'Prompt text for manual copying' });
  await manual.waitFor();
  assert.equal(await manual.inputValue(), fixturePrompt);
  assert.equal(await page.evaluate(() => document.activeElement.className), 'copy');
  assert.equal(await page.getByRole('button', { name: 'Copied' }).count(), 0);
  assert.match(await page.locator('#copy-status').textContent(), /Couldn’t copy automatically/);
  await page.keyboard.press('Tab');
  assert.equal(await manual.evaluate((element) => element.selectionEnd - element.selectionStart), fixturePrompt.length);
  await scan(page, 'mobile multi-prompt, copy failure');
  await page.locator('.after-prompt').getByRole('button', { name: 'Next prompt' }).tap();
  await selected(page, 3);
  assert.equal(await pagination.getByRole('button', { name: 'Next prompt' }).isDisabled(), true);
  assert.equal(await page.locator('.after-prompt:visible').count(), 0);
  await page.goBack();
  await selected(page, 2);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'prompt-2');
  await page.goForward();
  await selected(page, 3);
  await context.close();
});

test('reflow, large text, text spacing and accessibility colour preferences', async () => {
  const page = await browser.newPage({ viewport: viewports.mobile, forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto(origin + fixturePath + '#prompt-2');
  await selected(page, 2);
  await page.addStyleTag({ content: `
    * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }
    p { margin-bottom: 2em !important; }
    li.paragraph-gap { margin-top: 2em !important; }
    html { font-size: 200% !important; }
  ` });
  await noOverflow(page);
  await targets(page);
  assert.equal(await page.locator('#prompt-2 .prompt-text').evaluate((element) => getComputedStyle(element).fontSize), '36px');
  assert.match(await page.locator('#prompt-2 .prompt-text').textContent(), /Paragraph 28/);
  await page.setViewportSize({ width: 667, height: 320 });
  await noOverflow(page);
  await page.emulateMedia({ forcedColors: 'none' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await noOverflow(page);
  await page.close();
});

if (process.env.DREAM_ROOM_DEVICE_TESTS) {
  test('iPhone WebKit and Android Chrome profiles support touch pagination and copy', async () => {
    const safariEngine = await webkit.launch();
    try {
      for (const [engine, profile] of [[safariEngine, 'iPhone 15'], [browser, 'Pixel 7']]) {
        const context = await engine.newContext({
          ...devices[profile],
          ...(engine === browser && { permissions: ['clipboard-read', 'clipboard-write'] }),
        });
        const page = await context.newPage();
        await page.goto(origin + fixturePath + '#prompt-2');
        await selected(page, 2);
        await noOverflow(page);
        await page.getByRole('button', { name: 'Copy', exact: true }).tap();
        await page.getByRole('button', { name: 'Copied' }).waitFor({ timeout: 5000 });
        if (engine === browser) assert.equal(await page.evaluate(() => navigator.clipboard.readText()), fixturePrompt);
        await page.getByRole('navigation', { name: 'Prompt pages' }).getByRole('button', { name: 'Previous prompt' }).tap();
        await selected(page, 1);
        await context.close();
        console.log(`${profile} device profile: touch navigation and clipboard success passed`);
      }
    } finally {
      await safariEngine.close();
    }
  });
}

if (process.env.DREAM_ROOM_ZOOM_TEST) {
  test('native Chrome tab zoom at 400% reflows to mobile navigation', async () => {
    const extension = join(temp, 'zoom-extension');
    await mkdir(extension);
    await writeFile(join(extension, 'manifest.json'), JSON.stringify({
      manifest_version: 3, name: 'Dream Room zoom check', version: '1.0',
      background: { service_worker: 'worker.js' }, permissions: ['tabs'],
    }));
    await writeFile(join(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
    const context = await chromium.launchPersistentContext(join(temp, 'zoom-profile'), {
      channel: 'chromium', viewport: null,
      args: ['--window-size=1280,900', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      const page = context.pages()[0] ?? await context.newPage();
      const url = origin + fixturePath;
      await page.goto(url);
      assert.equal(await page.getByRole('tablist').isVisible(), true);
      const zoom = await worker.evaluate(async (tabUrl) => {
        const [tab] = await chrome.tabs.query({ url: tabUrl });
        await chrome.tabs.setZoom(tab.id, 4);
        return chrome.tabs.getZoom(tab.id);
      }, url);
      assert.ok(Math.abs(zoom - 4) < 0.001);
      await page.getByRole('navigation', { name: 'Prompt pages' }).waitFor();
      await noOverflow(page);
      await targets(page);
      await page.getByRole('navigation', { name: 'Prompt pages' }).getByRole('button', { name: 'Next prompt' }).click();
      await selected(page, 2);
      console.log('Chrome browser zoom:', Math.round(zoom * 100) + '%', 'viewport:', await page.evaluate(() => innerWidth) + 'px');
    } finally {
      await context.close();
    }
  });
}

test('palette has sufficient contrast for text, borders, active indicators and focus', async () => {
  const css = await readFile(join(root, 'assets/style.css'), 'utf8');
  const token = (name) => css.match(new RegExp(`--${name}: (#[0-9a-f]+);`, 'i'))[1];
  const luminance = (hex) => {
    const value = hex.length === 4 ? [...hex.slice(1)].map((digit) => digit.repeat(2)).join('') : hex.slice(1);
    const rgb = value.match(/../g).map((channel) => {
      const s = parseInt(channel, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const ratio = (a, b) => {
    const [dark, light] = [luminance(token(a)), luminance(token(b))].sort((x, y) => x - y);
    return (light + 0.05) / (dark + 0.05);
  };
  const backgrounds = ['paper', 'page', 'selected', 'hover', 'pressed'];
  const checks = [
    ['ink', backgrounds, 7], ['interactive', backgrounds, 7], ['secondary', backgrounds, 4.5],
    ['success', ['paper', 'hover', 'pressed'], 4.5], ['error', ['paper'], 7],
    ['border', backgrounds, 3], ['focus', backgrounds, 3],
  ];
  for (const [foreground, surfaces, minimum] of checks) {
    for (const surface of surfaces) assert.ok(ratio(foreground, surface) >= minimum, `${foreground}/${surface}`);
  }
});

test('published prompt source stays verbatim and screenshots use production content', async () => {
  const page = await browser.newPage({ viewport: viewports.desktop });
  await page.goto(origin + '/fixtures/');
  assert.equal(await page.locator('.sessions time').first().getAttribute('datetime'), fixtureDate);
  const session = origin + `/dream-room/${firstDate}/`;
  await page.goto(session);
  assert.equal(await page.locator('.prompt-source').evaluate((template) => template.content.textContent), original);
  assert.equal(await page.getByText('Design a small experiment', { exact: true }).count(), 0);
  assert.equal(await page.locator('.prompt-text li').count(), 3);
  if (process.env.DREAM_ROOM_SCREENSHOTS) {
    const output = process.env.DREAM_ROOM_SCREENSHOTS;
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tabs').waitFor({ state: 'hidden' });
    await page.screenshot({ path: join(output, 'mobile.png'), fullPage: true });
  }
  await page.close();
});
