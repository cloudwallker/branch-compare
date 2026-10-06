import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { TestContext } from 'node:test';

export function fixtureEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^GIT_/i.test(key)) delete env[key];
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  return env;
}

export function git(repo: string, args: string[]): string {
  return execFileSync(process.env.BRANCH_COMPARE_TEST_GIT ?? 'git', ['-C', repo, ...args], {
    env: fixtureEnvironment(), encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'branch-compare-fixture-'));
  const repo = join(root, '源 仓库');
  const scans = join(root, 'scans');
  await mkdir(repo);
  await mkdir(scans);
  t.after(async () => {
    const target = resolve(root);
    const parent = resolve(tmpdir());
    if (!target.startsWith(parent + sep) || !target.includes('branch-compare-fixture-')) throw new Error('Unsafe fixture cleanup');
    await rm(target, { recursive: true, force: true });
  });
  git(repo, ['init', '--initial-branch=main']);
  git(repo, ['config', 'user.name', 'Branch Compare Test Fixture']);
  git(repo, ['config', 'user.email', 'fixture@invalid.example']);
  await writeFile(join(repo, 'limits.json'), '{"quota":10}\n');
  await writeFile(join(repo, 'usage.json'), '{"requests":5}\n');
  await writeFile(join(repo, 'note.txt'), 'base\n');
  await writeFile(join(repo, 'verify.mjs'), "import {readFileSync} from 'node:fs';\nconst a=JSON.parse(readFileSync('limits.json','utf8'));\nconst b=JSON.parse(readFileSync('usage.json','utf8'));\nconsole.log('quota check'); process.exit(b.requests <= a.quota ? 0 : 7);\n");
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'base']);
  const base = git(repo, ['rev-parse', 'HEAD']);
  async function branch(name: string, file: string, content: string) {
    git(repo, ['checkout', '-b', name, base]);
    await writeFile(join(repo, file), content);
    git(repo, ['add', file]);
    git(repo, ['commit', '-m', name]);
    return git(repo, ['rev-parse', 'HEAD']);
  }
  const a = await branch('A', 'limits.json', '{"quota":6}\n');
  const c = await branch('C', 'usage.json', '{"requests":8}\n');
  const x = await branch('X', 'note.txt', 'left\n');
  const y = await branch('Y', 'note.txt', 'right\n');
  git(repo, ['checkout', 'main']);
  return { root, repo, scans, base, a, c, x, y, branch };
}

export async function waitForFile(path: string, timeoutMs = 5000): Promise<void> {
  const { access } = await import('node:fs/promises');
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { await access(path); return; } catch { await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  throw new Error('Fixture child did not become ready');
}

export function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
