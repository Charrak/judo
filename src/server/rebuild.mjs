import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Rebuilds dist/ synchronously and reports the result to the admin UI. */
export function makeRebuilder(rootDir) {
  return function rebuild() {
    const startedAt = Date.now();
    const result = spawnSync(process.execPath, [path.join(rootDir, 'scripts', 'build.mjs')], {
      cwd: rootDir,
      encoding: 'utf8',
      timeout: 60_000,
      env: process.env,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    return {
      ok: result.status === 0,
      output,
      ms: Date.now() - startedAt,
    };
  };
}
