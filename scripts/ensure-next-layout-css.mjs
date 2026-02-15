import fs from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const distDirName = process.env.NEXT_DIST_DIR || '.next';
const nextDir = path.join(workspaceRoot, distDirName);
const manifestPath = path.join(nextDir, 'server', 'app', 'page_client-reference-manifest.js');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await fileExists(manifestPath))) {
    console.warn('[ensure-next-layout-css] manifest missing, skipping:', manifestPath);
    return;
  }

  const content = await fs.readFile(manifestPath, 'utf-8');

  // Find the CSS file emitted for src/app/layout.*
  // Example snippet: "/Users/.../src/app/layout":["static/css/060c6d....css"]
  const match = content.match(/src\/app\/layout"\s*:\s*\[\s*"static\/css\/([^"]+?\.css)"/);
  if (!match) {
    console.warn('[ensure-next-layout-css] could not find layout CSS entry in manifest');
    return;
  }

  const layoutCssRel = match[1];
  const sourcePath = path.join(nextDir, 'static', 'css', layoutCssRel);
  const targetPath = path.join(nextDir, 'static', 'css', 'app', 'layout.css');

  if (!(await fileExists(sourcePath))) {
    console.warn('[ensure-next-layout-css] source css missing, skipping:', sourcePath);
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);

  const sourceMapPath = `${sourcePath}.map`;
  const targetMapPath = `${targetPath}.map`;
  if (await fileExists(sourceMapPath)) {
    await fs.copyFile(sourceMapPath, targetMapPath);
  }

  console.log('[ensure-next-layout-css] wrote', path.relative(workspaceRoot, targetPath));
}

await main();

