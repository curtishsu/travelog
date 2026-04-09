#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function getArg(name, fallback = null) {
  const full = `--${name}`;
  const index = process.argv.indexOf(full);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function sanitizeFileName(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function loadNarrationLines(demoDocPath) {
  const content = await readFile(demoDocPath, 'utf8');
  const startMarker = '## Polished Voiceover Script';
  const endMarker = '## Shot List And Timing';

  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Could not find section: ${startMarker}`);
  }

  const endIndex = content.indexOf(endMarker, startIndex);
  if (endIndex === -1) {
    throw new Error(`Could not find section: ${endMarker}`);
  }

  const block = content
    .slice(startIndex + startMarker.length, endIndex)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!block.length) {
    throw new Error('No narration lines found in demo.md');
  }

  return block;
}

function estimateDurationSeconds(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const wordsPerSecond = 2.6;
  return Number((words / wordsPerSecond + 0.25).toFixed(2));
}

async function generateClip({ apiKey, model, voice, text, outputPath }) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      voice,
      format: 'mp3',
      input: text
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`TTS request failed (${response.status}): ${message}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

function runBinary(command, args) {
  const result = spawnSync(command, args, { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed: ${
        result.stderr.toString('utf8').trim() || result.stdout.toString('utf8').trim() || 'no output'
      }`
    );
  }
}

async function generateClipWithMacOS({ voice, text, outputPath }) {
  const aiffPath = outputPath.replace(/\.mp3$/i, '.aiff');
  runBinary('say', ['-v', voice, '-o', aiffPath, text]);
  try {
    runBinary('ffmpeg', ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '2', outputPath]);
  } finally {
    await rm(aiffPath, { force: true });
  }
}

function tryConcatWithFfmpeg({ clipPaths, outputPath, tempListPath }) {
  const list = clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join('\n');
  return writeFile(tempListPath, `${list}\n`)
    .then(() => {
      const ffmpeg = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          tempListPath,
          '-codec:a',
          'libmp3lame',
          '-q:a',
          '2',
          outputPath
        ],
        { stdio: 'pipe' }
      );

      if (ffmpeg.status !== 0) {
        return { ok: false, reason: ffmpeg.stderr.toString('utf8') };
      }

      return { ok: true };
    })
    .catch(() => ({ ok: false, reason: 'failed_to_write_concat_file' }));
}

async function main() {
  const provider = getArg('provider', process.env.DEMO_TTS_PROVIDER ?? (process.env.OPENAI_API_KEY ? 'openai' : 'macos'));
  const apiKey = process.env.OPENAI_API_KEY ?? null;
  const model = getArg('model', process.env.DEMO_TTS_MODEL ?? 'gpt-4o-mini-tts');
  const voice = getArg('voice', process.env.DEMO_TTS_VOICE ?? (provider === 'macos' ? 'Samantha' : 'alloy'));
  const rootDir = path.resolve(getArg('root', process.cwd()));
  const demoDocPath = path.resolve(rootDir, 'docs/demo.md');
  const outputDir = path.resolve(getArg('out', path.join(rootDir, 'public/demo/audio')));

  if (provider === 'openai' && !apiKey) {
    throw new Error('OPENAI_API_KEY is required when provider=openai.');
  }

  await mkdir(outputDir, { recursive: true });

  const lines = await loadNarrationLines(demoDocPath);
  const manifest = {
    generatedAt: new Date().toISOString(),
    provider,
    model: provider === 'openai' ? model : null,
    voice,
    clips: []
  };

  const clipPaths = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const prefix = String(index + 1).padStart(2, '0');
    const slug = sanitizeFileName(line);
    const fileName = `${prefix}-${slug}.mp3`;
    const outputPath = path.join(outputDir, fileName);

    console.log(`Generating clip ${prefix}/${String(lines.length).padStart(2, '0')}: ${line}`);
    if (provider === 'macos') {
      await generateClipWithMacOS({
        voice,
        text: line,
        outputPath
      });
    } else {
      await generateClip({
        apiKey,
        model,
        voice,
        text: line,
        outputPath
      });
    }

    clipPaths.push(outputPath);
    manifest.clips.push({
      index: index + 1,
      text: line,
      file: fileName,
      estimatedDurationSec: estimateDurationSeconds(line)
    });
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const fullTrackPath = path.join(outputDir, 'full-narration.mp3');
  const concatListPath = path.join(outputDir, '.concat.txt');
  const concatResult = await tryConcatWithFfmpeg({
    clipPaths,
    outputPath: fullTrackPath,
    tempListPath: concatListPath
  });

  if (!concatResult.ok) {
    console.warn('Skipping full narration concat; ffmpeg unavailable or failed.');
    console.warn(concatResult.reason);
  } else {
    console.log(`Created full narration track: ${fullTrackPath}`);
  }

  console.log(`Generated ${lines.length} TTS clips in ${outputDir}`);
}

main().catch((error) => {
  console.error('Failed to generate demo TTS audio.');
  console.error(error);
  process.exitCode = 1;
});
