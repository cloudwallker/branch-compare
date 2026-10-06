import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type { CellResult, ScanOptions, ScanReport } from '../src/types.ts';
import { fixture, git, processExists, waitForFile } from './helpers/git-fixture.ts';

async function scan(options: ScanOptions): Promise<ScanReport> {
  try {
    const module = await import('../src/runner.ts');
    return await module.runScan(options);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') assert.fail('The isolated scan is not implemented');
    throw error;
  }
}
const command = { mode: 'argv' as const, argv: [process.execPath, 'verify.mjs'] };

test('real nonconflicting branches pass alone and fail in both merge directions', async t => {
  const f = await fixture(t);
  const report = await scan({ repo: f.repo, base: 'main', refs: ['A', 'C'], command, timeoutMs: 3000, tempParent: f.scans });
  assert.deepEqual(report.cells.map(c => [c.id, c.status, c.interactionFailure]), [
    ['base', 'passed', false], ['single-0', 'passed', false], ['single-1', 'passed', false],
    ['pair-0-1', 'test-failed', true], ['pair-1-0', 'test-failed', true],
  ]);
  assert.equal(report.base.sha, f.base);
  assert.equal(report.refs[0].sha, f.a);
  assert.equal(report.cells[3].exitCode, 7);
  assert.equal(report.cells[3].treeSha, report.cells[4].treeSha);
  assert.deepEqual(report.cleanupErrors, []);
  assert.deepEqual(await readdir(f.scans), []);
  assert.ok(!JSON.stringify(report).includes(f.repo));
  assert.ok(!JSON.stringify(report).includes(f.root));
});

test('real unresolved index paths distinguish merge conflicts from test failures', async t => {
  const f = await fixture(t);
  const report = await scan({ repo: f.repo, base: f.base, refs: ['X', 'Y'], command, timeoutMs: 3000, tempParent: f.scans });
  for (const cell of report.cells.slice(3)) {
    assert.equal(cell.status, 'merge-conflict');
    assert.deepEqual(cell.conflictPaths, ['note.txt']);
    assert.equal(cell.interactionFailure, false);
  }
});

test('a failing baseline does not label pair test failures as interactions', async t => {
  const f = await fixture(t);
  const report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', 'process.exit(7)'] }, timeoutMs: 3000, tempParent: f.scans });
  assert.equal(report.cells[0].status, 'test-failed');
  assert.ok(report.cells.every(c => c.status === 'test-failed' && !c.interactionFailure));
});

test('invalid refs, duplicate commits and ancestors are rejected before creating scan resources', async t => {
  const f = await fixture(t);
  const opts = { repo: f.repo, base: f.base, refs: ['A', 'C'], command, timeoutMs: 3000, tempParent: f.scans };
  await assert.rejects(scan({ ...opts, refs: ['--help', 'C'] }), /ref/i);
  await assert.rejects(scan({ ...opts, refs: ['missing', 'C'] }), /ref|commit/i);
  await assert.rejects(scan({ ...opts, refs: ['A', f.a] }), /duplicate/i);
  await assert.rejects(scan({ ...opts, base: f.a }), /ancestor/i);
  await assert.rejects(scan({ ...opts, onlyCell: '../../source' }), /onlyCell/i);
  assert.deepEqual(await readdir(f.scans), []);
});

test('resolved SHAs stay pinned when the source branch moves after the baseline', async t => {
  const f = await fixture(t);
  const report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command, timeoutMs: 3000, tempParent: f.scans,
    onCell(cell) { if (cell.id === 'base') git(f.repo, ['update-ref', 'refs/heads/A', f.c]); },
  });
  assert.equal(report.refs[0].sha, f.a);
  assert.equal(report.cells[3].status, 'test-failed');
});

test('dirty source files, index, hooks, config and refs survive hostile Git environment variables', async t => {
  const f = await fixture(t);
  await writeFile(join(f.repo, 'note.txt'), 'user work\n');
  await writeFile(join(f.repo, 'private-untracked.txt'), 'user work\n');
  const hooks = join(f.root, 'source-hooks');
  await mkdir(hooks);
  const marker = join(f.root, 'hook-ran');
  for (const name of ['pre-commit', 'post-checkout', 'post-merge']) await writeFile(join(hooks, name), `#!/bin/sh\necho ran > '${marker.replaceAll('\\', '/')}'\nexit 1\n`, { mode: 0o755 });
  git(f.repo, ['config', 'core.hooksPath', hooks]);
  git(f.repo, ['config', 'commit.gpgsign', 'true']);
  git(f.repo, ['config', 'rerere.enabled', 'true']);
  const before = { refs: git(f.repo, ['show-ref']), status: git(f.repo, ['status', '--porcelain']), config: await readFile(join(f.repo, '.git', 'config')), index: await readFile(join(f.repo, '.git', 'index')) };
  const names = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS'];
  const saved = Object.fromEntries(names.map(k => [k, process.env[k]]));
  for (const name of names) process.env[name] = join(f.root, 'bad-git-location');
  let report: ScanReport;
  try {
    report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', "require('fs').writeFileSync('test-artifact','ok')"] }, timeoutMs: 3000, tempParent: f.scans });
  } finally { for (const name of names) if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  assert.ok(report.cells.every(c => c.status === 'passed'));
  assert.equal(git(f.repo, ['show-ref']), before.refs);
  assert.equal(git(f.repo, ['status', '--porcelain']), before.status);
  assert.deepEqual(await readFile(join(f.repo, '.git', 'config')), before.config);
  assert.deepEqual(await readFile(join(f.repo, '.git', 'index')), before.index);
  await assert.rejects(access(marker));
  assert.deepEqual(await readdir(f.scans), []);
});

test('onlyCell retains unexecuted cells and cleans timed out child and grandchild processes', async t => {
  const f = await fixture(t);
  const marker = join(f.root, 'pids.json');
  const script = "const {spawn}=require('child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync(process.argv[1],JSON.stringify([process.pid,c.pid])); setInterval(()=>{},1000)";
  const report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', script, marker] }, timeoutMs: 1000, onlyCell: 'base', tempParent: f.scans });
  assert.equal(report.cells[0].status, 'timeout');
  assert.ok(report.cells.slice(1).every(c => c.status === 'not-run'));
  const pids = JSON.parse(await readFile(marker, 'utf8')) as number[];
  assert.ok(pids.every(pid => !processExists(pid)));
  assert.deepEqual(report.cleanupErrors, []);
  assert.deepEqual(await readdir(f.scans), []);
});

test('abort stops the current process tree and leaves future cells unexecuted', async t => {
  const f = await fixture(t);
  const marker = join(f.root, 'abort-pids.json');
  const controller = new AbortController();
  const script = "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync(process.argv[1],JSON.stringify([process.pid,c.pid])); setInterval(()=>{},1000)";
  const pending = scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', script, marker] }, timeoutMs: 30000, signal: controller.signal, tempParent: f.scans });
  await waitForFile(marker);
  controller.abort();
  const report = await pending;
  assert.equal(report.cancelled, true);
  assert.equal(report.cells[0].status, 'cancelled');
  assert.ok(report.cells.slice(1).every(c => c.status === 'not-run'));
  assert.ok((JSON.parse(await readFile(marker, 'utf8')) as number[]).every(pid => !processExists(pid)));
  assert.deepEqual(await readdir(f.scans), []);
});

test('logs and progress callbacks redact split secrets and absolute paths within one shared output limit', async t => {
  const f = await fixture(t);
  const secret = 'fixture-only-value-123456789';
  const old = process.env.BRANCH_COMPARE_TEST_API_TOKEN;
  process.env.BRANCH_COMPARE_TEST_API_TOKEN = secret;
  const seen: CellResult[] = [];
  const script = "process.stdout.write('\\x1b[31m'+process.env.BRANCH_COMPARE_TEST_API_TOKEN.slice(0,8)); setTimeout(()=>{process.stdout.write(process.env.BRANCH_COMPARE_TEST_API_TOKEN.slice(8)+' '+process.cwd()+'\\n'); process.stderr.write('x'.repeat(400000))},25)";
  try {
    const report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', script, secret] }, timeoutMs: 3000, onlyCell: 'base', tempParent: f.scans, onCell(cell) { seen.push(cell); } });
    const cell = report.cells[0];
    assert.equal(cell.status, 'passed');
    assert.equal(cell.logTruncated, true);
    assert.ok(Buffer.byteLength(cell.log) <= 256 * 1024);
    assert.ok(!JSON.stringify(report).includes(secret));
    assert.ok(!JSON.stringify(seen).includes(secret));
    assert.ok(!cell.log.includes('\x1b'));
    assert.ok(!JSON.stringify(report).includes(f.root));
    assert.equal(report.commandRedacted, true);
  } finally { if (old === undefined) delete process.env.BRANCH_COMPARE_TEST_API_TOKEN; else process.env.BRANCH_COMPARE_TEST_API_TOKEN = old; }
});

test('a missing argv executable is an infrastructure error and explicit shell commands run', async t => {
  const f = await fixture(t);
  const opts = { repo: f.repo, base: f.base, refs: ['A', 'C'], timeoutMs: 3000, onlyCell: 'base', tempParent: f.scans };
  const missing = await scan({ ...opts, command: { mode: 'argv', argv: ['branch-compare-missing-fixture-executable'] } });
  assert.equal(missing.cells[0].status, 'error');
  assert.equal(missing.cells[0].exitCode, null);
  const passed = await scan({ ...opts, command: { mode: 'shell', text: `"${process.execPath}" -e "process.exit(0)"` } });
  assert.equal(passed.cells[0].status, 'passed');
});

test('the independent clone has copied object files and does not execute tracked hook-shaped files', async t => {
  const f = await fixture(t);
  const marker = join(f.root, 'tracked-hook-ran');
  git(f.repo, ['checkout', 'A']);
  await writeFile(join(f.repo, 'pre-merge-commit'), `#!/bin/sh\necho ran > '${marker.replaceAll('\\', '/')}'\nexit 1\n`, { mode: 0o755 });
  git(f.repo, ['add', 'pre-merge-commit']);
  git(f.repo, ['update-index', '--chmod=+x', 'pre-merge-commit']);
  git(f.repo, ['commit', '-m', 'tracked hook-shaped file']);
  git(f.repo, ['checkout', 'main']);
  const proof = join(f.root, 'object-proof.json');
  const original = join(f.repo, '.git', 'objects', f.base.slice(0, 2), f.base.slice(2));
  const script = "const fs=require('fs'),path=require('path'); const common=require('child_process').execFileSync('git',['rev-parse','--git-common-dir'],{encoding:'utf8'}).trim(); const sha=process.argv[1]; const copied=path.resolve(common,'objects',sha.slice(0,2),sha.slice(2)); const a=fs.statSync(copied),b=fs.statSync(process.argv[2]); fs.writeFileSync(process.argv[3],JSON.stringify({distinct:a.ino!==b.ino,links:a.nlink}));";
  const report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', script, f.base, original, proof] }, timeoutMs: 3000, tempParent: f.scans });
  assert.ok(report.cells.every(cell => cell.status === 'passed'));
  assert.deepEqual(JSON.parse(await readFile(proof, 'utf8')), { distinct: true, links: 1 });
  await assert.rejects(access(marker));
});

test('changed ownership markers preserve scan resources and leave the source intact', async t => {
  const f = await fixture(t);
  const sourceBefore = git(f.repo, ['show-ref']);
  const script = "const p=require('path');require('fs').writeFileSync(p.join(p.dirname(process.cwd()),'.branch-compare-owned'),'changed by fixture')";
  const report = await scan({ repo: f.repo, base: f.base, refs: ['A', 'C'], command: { mode: 'argv', argv: [process.execPath, '-e', script] }, timeoutMs: 3000, onlyCell: 'base', tempParent: f.scans });
  assert.equal(report.cells[0].status, 'passed');
  assert.ok(report.cleanupErrors.length > 0);
  assert.equal((await readdir(f.scans)).length, 1);
  assert.equal(git(f.repo, ['show-ref']), sourceBefore);
  assert.ok(!JSON.stringify(report).includes(f.root));
});

test('cloning a source with alternate object storage removes borrowed object database links', async t => {
  const f = await fixture(t);
  const borrowed = join(f.root, 'borrowed-source');
  git(f.root, ['clone', '--shared', '--no-checkout', '--', f.repo, borrowed]);
  git(borrowed, ['checkout', 'main']);
  const alternatesBefore = await readFile(join(borrowed, '.git', 'objects', 'info', 'alternates'), 'utf8');
  const orphan = git(f.repo, ['commit-tree', git(f.repo, ['rev-parse', 'A^{tree}']), '-p', f.base, '-m', 'unreferenced fixture input']);
  const script = "const p=require('path');const common=require('child_process').execFileSync('git',['rev-parse','--git-common-dir'],{encoding:'utf8'}).trim();process.exit(require('fs').existsSync(p.resolve(common,'objects','info','alternates'))?9:0)";
  const report = await scan({ repo: borrowed, base: f.base, refs: [orphan, f.c], command: { mode: 'argv', argv: [process.execPath, '-e', script] }, timeoutMs: 3000, onlyCell: 'single-0', tempParent: f.scans });
  assert.equal(report.cells[1].status, 'passed');
  assert.equal(await readFile(join(borrowed, '.git', 'objects', 'info', 'alternates'), 'utf8'), alternatesBefore);
});

test('large real conflict lists stay valid and explicitly report omitted paths', async t => {
  const f=await fixture(t);await mkdir(join(f.repo,'conflicts'));
  const names=Array.from({length:1001},(_,i)=>`conflicts/file-${i}.txt`);
  for(const name of names)await writeFile(join(f.repo,name),'base\n');
  git(f.repo,['add','.']);git(f.repo,['commit','-m','many conflict baseline']);
  const base=git(f.repo,['rev-parse','HEAD']);
  for(const [branch,value] of [['many-left','left'],['many-right','right']]) {
    git(f.repo,['checkout','-b',branch!,base]);
    for(const name of names)await writeFile(join(f.repo,name),value+'\n');
    git(f.repo,['add','.']);git(f.repo,['commit','-m',branch!]);
  }
  git(f.repo,['checkout','main']);
  const report=await scan({repo:f.repo,base,refs:['many-left','many-right'],command,timeoutMs:3000,onlyCell:'pair-0-1',tempParent:f.scans});
  const {validateReport}=await import('../src/model.ts');assert.doesNotThrow(()=>validateReport(report));
  const cell=report.cells.find(c=>c.id==='pair-0-1')!;
  assert.equal(cell.status,'merge-conflict');assert.equal(cell.conflictPaths.length,1000);
  assert.equal(cell.logTruncated,true);assert.match(cell.log,/Conflict path list truncated/);
  assert.deepEqual(await readdir(f.scans),[]);
});
