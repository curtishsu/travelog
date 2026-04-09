#!/usr/bin/env node

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from '@playwright/test';

function getArg(name, fallback = null) {
  const full = `--${name}`;
  const index = process.argv.indexOf(full);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function getBoolArg(name, fallback) {
  const value = getArg(name, null);
  if (value === null) {
    return fallback;
  }
  return value === 'true';
}

function requiredValue(label, value) {
  if (!value) {
    throw new Error(`Missing required value: ${label}`);
  }
  return value;
}

async function smoothScroll(page, options = {}) {
  const {
    step = 160,
    delayMs = 120,
    targetRatio = 0.8,
    minDistance = 600,
    maxDistance = 3200
  } = options;
  const distance = await page.evaluate(
    ({ targetRatio: safeRatio, minDistance: safeMin, maxDistance: safeMax }) => {
      const body = document.body;
      const doc = document.documentElement;
      const scrollHeight = Math.max(
        body?.scrollHeight ?? 0,
        doc?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        doc?.offsetHeight ?? 0
      );
      const viewportHeight = window.innerHeight || doc?.clientHeight || 0;
      const maxScrollable = Math.max(0, scrollHeight - viewportHeight);
      const desired = Math.floor(maxScrollable * safeRatio);
      return Math.max(safeMin, Math.min(safeMax, desired));
    },
    { targetRatio, minDistance, maxDistance }
  );
  const steps = Math.max(1, Math.floor(distance / step));
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(delayMs);
  }
}

async function rotateCanvas(page, selector = 'canvas') {
  const canvas = page.locator(selector).first();
  if ((await canvas.count()) === 0) {
    await page.mouse.move(960, 420);
    await page.mouse.down();
    await page.mouse.move(1180, 420, { steps: 24 });
    await page.mouse.move(720, 380, { steps: 24 });
    await page.mouse.up();
    return;
  }

  const box = await canvas.boundingBox();
  if (!box) {
    return;
  }

  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 260, startY, { steps: 30 });
  await page.mouse.move(startX - 220, startY - 40, { steps: 30 });
  await page.mouse.up();
}

async function waitForRealTripLink(page, timeout = 30000) {
  await page.waitForFunction(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/trips/"]'));
    return links.some((link) => {
      const href = link.getAttribute('href');
      return Boolean(href && href.startsWith('/trips/') && href !== '/trips/new' && !href.includes('/edit'));
    });
  }, { timeout });
}

async function hasRealTripLink(page) {
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/trips/"]'));
    return links.some((link) => {
      const href = link.getAttribute('href');
      return Boolean(href && href.startsWith('/trips/') && href !== '/trips/new' && !href.includes('/edit'));
    });
  });
}

async function signInIfNeeded(page, { baseUrl, email, password }) {
  await page.goto(`${baseUrl}/journal`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const reachedSignInRoute = page.url().includes('/auth/signin');
  const inlineSignInPrompt =
    (await page.getByRole('link', { name: /^sign in$/i }).count()) > 0 ||
    (await page.getByRole('button', { name: /^sign in$/i }).count()) > 0;
  const realTripLinksVisible = await hasRealTripLink(page);

  if (realTripLinksVisible && !reachedSignInRoute && !inlineSignInPrompt) {
    return;
  }

  if (!email || !password) {
    throw new Error('Sign-in was required but DEMO_USER_EMAIL/DEMO_USER_PASSWORD were not provided.');
  }

  if (!reachedSignInRoute) {
    await page.goto(`${baseUrl}/auth/signin`, { waitUntil: 'domcontentloaded' });
  }

  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/journal/, { timeout: 30000 });
  await waitForRealTripLink(page, 30000);
}

async function resolveFirstTripId(page, baseUrl) {
  await page.goto(`${baseUrl}/journal`, { waitUntil: 'domcontentloaded' });
  await waitForRealTripLink(page, 30000);

  const tripLinks = page.locator('a[href^="/trips/"]:not([href="/trips/new"])');
  const count = await tripLinks.count();
  let href = null;

  for (let index = 0; index < count; index += 1) {
    const candidate = await tripLinks.nth(index).getAttribute('href');
    if (candidate && candidate.startsWith('/trips/') && candidate !== '/trips/new') {
      href = candidate;
      break;
    }
  }

  const match = href?.match(/^\/trips\/([^/?#]+)$/);

  if (!match?.[1]) {
    throw new Error('Could not find a trip link on /journal.');
  }

  return match[1];
}

async function recordShot(browser, {
  shot,
  baseUrl,
  storageStatePath,
  outDir,
  viewport
}) {
  const rawDir = path.join(outDir, 'raw');
  await mkdir(rawDir, { recursive: true });

  const context = await browser.newContext({
    viewport,
    storageState: storageStatePath,
    recordVideo: {
      dir: rawDir,
      size: viewport
    }
  });

  const page = await context.newPage();
  await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await shot.perform(page);
  await page.waitForTimeout(1000);

  const video = page.video();
  await context.close();

  const videoPath = await video.path();
  const extension = path.extname(videoPath) || '.webm';
  const finalName = `${shot.order.toString().padStart(2, '0')}-${shot.name}${extension}`;
  const finalPath = path.join(rawDir, finalName);
  await rename(videoPath, finalPath);

  return {
    ...shot,
    file: path.relative(outDir, finalPath)
  };
}

async function main() {
  const baseUrl = requiredValue('DEMO_BASE_URL or --url', getArg('url', process.env.DEMO_BASE_URL));
  const email = getArg('email', process.env.DEMO_USER_EMAIL ?? process.env.NEXT_PUBLIC_DEMO_EMAIL ?? null);
  const password = getArg('password', process.env.DEMO_USER_PASSWORD ?? process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? null);
  const outputDir = path.resolve(getArg('out', path.join(process.cwd(), 'public/demo')));
  const headless = getBoolArg('headless', true);

  const viewport = { width: 1920, height: 1080 };

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless,
    args: ['--window-size=1920,1080']
  });

  const authStatePath = path.join(os.tmpdir(), `travelog-demo-auth-${Date.now()}.json`);

  try {
    const authContext = await browser.newContext({ viewport });
    const authPage = await authContext.newPage();

    await signInIfNeeded(authPage, { baseUrl, email, password });
    const firstTripId = await resolveFirstTripId(authPage, baseUrl);
    await authContext.storageState({ path: authStatePath });
    await authContext.close();

    const shots = [
      {
        order: 1,
        name: 'journal-list-scroll',
        path: '/journal',
        notes: 'Homepage journal list scroll',
        perform: async (page) => {
          await smoothScroll(page, { targetRatio: 0.9, minDistance: 900, maxDistance: 2800 });
        }
      },
      {
        order: 2,
        name: 'trip-overview-edit',
        path: `/trips/${firstTripId}/edit?tab=overview`,
        notes: 'Trip overview edit page',
        perform: async (page) => {
          await smoothScroll(page, { targetRatio: 0.75, minDistance: 1000, maxDistance: 2400, step: 140, delayMs: 110 });
        }
      },
      {
        order: 3,
        name: 'trip-day1-edit',
        path: `/trips/${firstTripId}/edit?tab=day-1`,
        notes: 'Trip day 1 edit page',
        perform: async (page) => {
          await smoothScroll(page, { targetRatio: 0.9, minDistance: 1400, maxDistance: 3200, step: 170, delayMs: 120 });
        }
      },
      {
        order: 4,
        name: 'globe-rotate',
        path: '/map',
        notes: 'Globe view rotation',
        perform: async (page) => {
          await rotateCanvas(page, 'canvas');
          await page.waitForTimeout(1200);
          await rotateCanvas(page, 'canvas');
        }
      },
      {
        order: 5,
        name: 'stats-scroll',
        path: '/stats',
        notes: 'Stats dashboard scroll',
        perform: async (page) => {
          await page.waitForTimeout(1200);
          await smoothScroll(page, { targetRatio: 0.85, minDistance: 1000, maxDistance: 2800 });
        }
      }
    ];

    const captured = [];

    for (const shot of shots) {
      console.log(`Recording shot ${shot.order}: ${shot.name}`);
      const result = await recordShot(browser, {
        shot,
        baseUrl,
        storageStatePath: authStatePath,
        outDir: outputDir,
        viewport
      });
      captured.push(result);
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      viewport,
      shots: captured
    };

    const manifestPath = path.join(outputDir, 'raw', 'shots-manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`Capture complete. Clips written to ${path.join(outputDir, 'raw')}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to capture demo footage.');
  console.error(error);
  process.exitCode = 1;
});
