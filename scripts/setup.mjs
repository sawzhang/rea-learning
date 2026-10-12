import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../upstream/', import.meta.url));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run('git', ['submodule', 'update', '--init'], { cwd: fileURLToPath(new URL('../', import.meta.url)) });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
run(npx, ['--yes', 'npm@11.16.0', 'ci'], { env: { ...process.env, HUSKY: '0' } });
run(npx, ['--yes', 'npm@11.16.0', 'run', 'build:cached']);
