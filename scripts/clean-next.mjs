import fs from 'node:fs/promises';
import path from 'node:path';

const distDirName = process.env.NEXT_DIST_DIR || '.next';
const nextDir = path.join(process.cwd(), distDirName);

try {
  await fs.rm(nextDir, { recursive: true, force: true });
  console.log(`[clean-next] removed ${distDirName} cache`);
} catch (error) {
  console.warn(`[clean-next] failed to remove ${distDirName}:`, error);
}

