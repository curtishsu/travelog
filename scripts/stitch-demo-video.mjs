#!/usr/bin/env node

import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

function getArg(name, fallback = null) {
  const full = `--${name}`;
  const index = process.argv.indexOf(full);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'pipe' });
  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8').trim();
    const stdout = result.stdout.toString('utf8').trim();
    throw new Error(`${cmd} ${args.join(' ')} failed.\n${stderr || stdout || 'No output.'}`);
  }
}

function hasBin(name) {
  const result = spawnSync('bash', ['-lc', `command -v ${name}`], { stdio: 'pipe' });
  return result.status === 0;
}

async function listShotFiles(rawDir) {
  const entries = await readdir(rawDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^(\d+)-.+\.(webm|mp4|mov)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(rawDir, name));
}

async function main() {
  const root = path.resolve(getArg('root', process.cwd()));
  const demoDir = path.resolve(getArg('demo-dir', path.join(root, 'public/demo')));
  const rawDir = path.resolve(getArg('raw-dir', path.join(demoDir, 'raw')));
  const audioFile = path.resolve(
    getArg('audio', path.join(demoDir, 'audio', 'full-narration.mp3'))
  );
  const outFile = path.resolve(getArg('out', path.join(demoDir, 'travelog-demo.mp4')));

  if (!hasBin('ffmpeg')) {
    throw new Error('ffmpeg is required but not installed.');
  }

  await mkdir(path.dirname(outFile), { recursive: true });

  const shotFiles = await listShotFiles(rawDir);
  if (!shotFiles.length) {
    throw new Error(`No shot files found in ${rawDir}`);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'travelog-stitch-'));
  const concatList = path.join(tempDir, 'concat.txt');
  const videoOnly = path.join(tempDir, 'video-only.mp4');

  try {
    const concatData = shotFiles
      .map((file) => `file '${file.replace(/'/g, "'\\''")}'`)
      .join('\n');
    await writeFile(concatList, `${concatData}\n`);

    run('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatList,
      '-an',
      '-r',
      '30',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-preset',
      'medium',
      videoOnly
    ]);

    const hasAudio = spawnSync('bash', ['-lc', `[ -f '${audioFile.replace(/'/g, "'\\''")}' ]`], {
      stdio: 'pipe'
    }).status === 0;

    if (hasAudio) {
      run('ffmpeg', [
        '-y',
        '-i',
        videoOnly,
        '-i',
        audioFile,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        outFile
      ]);
      console.log(`Stitched final demo video with narration: ${outFile}`);
    } else {
      run('ffmpeg', ['-y', '-i', videoOnly, '-c:v', 'copy', outFile]);
      console.log(`Stitched video only (no narration track found): ${outFile}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('Failed to stitch demo video.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
