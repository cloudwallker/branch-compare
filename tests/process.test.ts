import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function api() {
  try { return await import('../src/process.ts'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') assert.fail('Bounded process execution is not implemented'); throw error; }
}

test('stdout and stderr share a UTF-8 safe bounded redacted capture', async () => {
  const { runProcess } = await api();
  const secret = 'fixture-stream-secret-0123456789';
  const result = await runProcess({ mode: 'argv', argv: [process.execPath, '-e', "process.stdout.write(process.env.TEST_SECRET.slice(0,6)); setTimeout(()=>{process.stdout.write(process.env.TEST_SECRET.slice(6));process.stderr.write('中'.repeat(200000))},20)"] }, { cwd: process.cwd(), timeoutMs: 3000, environment: { ...process.env, TEST_SECRET: secret } });
  assert.equal(result.exitCode, 0);
  assert.equal(result.logTruncated, true);
  assert.ok(Buffer.byteLength(result.log) <= 256 * 1024);
  assert.ok(!result.log.includes(secret));
  assert.ok(!result.log.includes('\ufffd'));
});

test('spawn errors are explicit and never become a zero exit status', async () => {
  const { runProcess } = await api();
  const result = await runProcess({ mode: 'argv', argv: ['branch-compare-fixture-missing-executable'] }, { cwd: process.cwd(), timeoutMs: 1000 });
  assert.equal(result.exitCode, null);
  assert.ok(result.error);
});

test('stderr between stdout chunks cannot reveal a split known credential', async () => {
  const { runProcess } = await api();
  const secret='fixture-interleaved-value-0123456789';
  const result=await runProcess({mode:'argv',argv:[process.execPath,'-e',"process.stdout.write(process.env.TEST_TOKEN.slice(0,12));setTimeout(()=>process.stderr.write('DIAGNOSTIC\\n'),50);setTimeout(()=>process.stdout.write(process.env.TEST_TOKEN.slice(12)),100)"]},{cwd:process.cwd(),timeoutMs:3000,environment:{...process.env,TEST_TOKEN:secret}});
  assert.equal(result.exitCode,0);assert.ok(result.log.includes('DIAGNOSTIC'));
  assert.ok(result.log.includes('[REDACTED]'));assert.ok(!result.log.includes(secret.slice(0,12)));
  assert.ok(!result.log.includes(secret.slice(12)));
});

test('an already-aborted process is cancelled before launching', async () => {
  const { runProcess } = await api();
  const controller = new AbortController();
  controller.abort();
  const result = await runProcess({ mode: 'argv', argv: [process.execPath, '-e', 'process.exit(9)'] }, { cwd: process.cwd(), timeoutMs: 1000, signal: controller.signal });
  assert.equal(result.cancelled, true);
  assert.equal(result.exitCode, null);
});

test('Windows batch argv reports the explicit shell requirement', { skip: process.platform !== 'win32' }, async t => {
  const { runProcess } = await api();
  const dir = await mkdtemp(join(tmpdir(), 'branch-compare-process-'));
  t.after(async () => { await rm(dir, { recursive: true, force: true }); });
  const { writeFile } = await import('node:fs/promises');
  const path = join(dir, 'fixture.cmd');
  await writeFile(path, '@exit /b 0\r\n');
  const result = await runProcess({ mode: 'argv', argv: [path] }, { cwd: dir, timeoutMs: 1000 });
  assert.equal(result.exitCode, null);
  assert.match(result.error ?? '', /shell|--test/i);
});

test('a secret that crosses the public log cutoff cannot leave a prefix in the report', async () => {
  const { runProcess } = await api();
  const secret = 'fixture-boundary-value-0123456789';
  const result = await runProcess({ mode: 'argv', argv: [process.execPath, '-e', "process.stdout.write('x'.repeat(262140)+process.env.TEST_SECRET+' tail'.repeat(100000))"] }, { cwd: process.cwd(), timeoutMs: 3000, environment: { ...process.env, TEST_SECRET: secret } });
  assert.equal(result.exitCode, 0);
  assert.equal(result.logTruncated, true);
  assert.ok(!result.log.includes('fixt'));
  assert.ok(Buffer.byteLength(result.log) <= 262144);
});

test('a failed Windows tree killer returns within a bound and marks termination unverified', { skip: process.platform !== 'win32' }, async () => {
  const { runProcess } = await api();
  const dir = await mkdtemp(join(tmpdir(), 'branch-compare-process-'));
  const marker = join(dir, 'pid.txt');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(dir, 'taskkill.exe'), 'This is a deliberately invalid fixture executable.');
  const originalCwd = process.cwd();
  process.chdir(dir);
  const script = "require('fs').writeFileSync(process.argv[1],JSON.stringify([process.pid]));setInterval(()=>{},1000)";
  const pending = runProcess({ mode: 'argv', argv: [process.execPath, '-e', script, marker] }, { cwd: dir, timeoutMs: 150 });
  try {
    const result = await Promise.race([pending, new Promise<'unbounded'>(resolve => setTimeout(() => resolve('unbounded'), 1800))]);
    assert.notEqual(result, 'unbounded');
    if (result !== 'unbounded') assert.equal(result.terminationFailed, true);
  } finally {
    const { readFile } = await import('node:fs/promises');
    const pids = JSON.parse(await readFile(marker, 'utf8')) as number[];
    for (const pid of pids) try { process.kill(pid); } catch { /* It has already exited. */ }
    await pending;
    for (let attempts = 0; attempts < 50; attempts++) {
      const alive = pids.some(pid => { try { process.kill(pid, 0); return true; } catch { return false; } });
      if (!alive) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});
