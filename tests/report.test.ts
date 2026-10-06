import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderReportHtml, reproduceCommand } from '../src/report.ts';
import { parseCli } from '../src/arguments.ts';
import { ensureOutputLocation } from '../src/output.ts';
import { reportFixture } from '../e2e/report-fixture.ts';

test('reproduction command selects the fixed report cell for both shells', () => {
  const report = reportFixture();
  const cell = report.cells[4]!;
  const expected = 'branch-compare reproduce --repo . --report report.json --cell pair-0-1 --out ../replay-pair-0-1';
  assert.equal(reproduceCommand(report, cell, 'bash'), expected);
  assert.equal(reproduceCommand(report, cell, 'powershell'), expected);
  report.commandRedacted = true;
  assert.equal(reproduceCommand(report, cell, 'bash'), expected);
});

test('reproduction IDs cannot become shell syntax', () => {
  const report = reportFixture();
  assert.throws(() => reproduceCommand(report, { id: "pair-0-1;curl bad", kind: 'pair', indices: [0, 1] }, 'bash'));
  assert.throws(() => reproduceCommand(report, { id: 'pair-0-1', kind: 'pair', indices: [1, 0] }, 'powershell'));
});

test('copied reproduction commands pass the real output boundary check from the repository root', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'branch-compare-reproduce-path-'));
  context.after(async () => { await rm(directory, { recursive: true, force: true }); });
  const source = join(directory, 'source-repository');
  const git = join(source, '.git');
  await mkdir(git, { recursive: true });
  const report = reportFixture();
  await writeFile(join(source, 'report.json'), JSON.stringify(report));
  const cell = report.cells[4]!;
  for (const shell of ['bash', 'powershell'] as const) {
    const args = parseCli(reproduceCommand(report, cell, shell).split(' ').slice(1));
    assert.equal(args.mode, 'reproduce');
    if (args.mode !== 'reproduce') throw new Error('Expected a reproduction command');
    assert.equal(resolve(source, args.repo), source);
    assert.deepEqual(JSON.parse(await readFile(resolve(source, args.report), 'utf8')), JSON.parse(JSON.stringify(report)));
    const target = await ensureOutputLocation(resolve(source, args.out), [source, git]);
    assert.equal(target, join(await realpath(directory), 'replay-pair-0-1'));
  }
  await assert.rejects(ensureOutputLocation(join(source, 'replay-pair-0-1'), [source, git]), /outside the source repository/);
});

test('report emits safe standalone data and CSP-authorized static JavaScript', () => {
  const html = renderReportHtml(reportFixture(true), 'zh');
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="zh"/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<img\b/i);
  assert.equal((html.match(/<script\b/g) || []).length, 2);
  const scripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
  assert.equal(scripts.length, 2);
  const data = JSON.parse(scripts[0]!);
  assert.equal(data.report.repoName, reportFixture(true).repoName);
  assert.equal(data.locale, 'zh');
  assert.doesNotMatch(scripts[0]!, /<|\u2028|\u2029/);
  const hash = createHash('sha256').update(scripts[1]!).digest('base64');
  assert.ok(html.includes(`script-src 'sha256-${hash}'`));
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
});

test('embedded data round-trips status, interaction, complete SHA and command metadata', () => {
  const report = reportFixture();
  report.commandRedacted = true;
  const html = renderReportHtml(report);
  const dataText = html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)![1]!;
  const data = JSON.parse(dataText);
  assert.deepEqual(data.report, JSON.parse(JSON.stringify(report)));
  assert.equal(data.locale, 'en');
  assert.equal(new Set(data.report.cells.map((cell: { status: string }) => cell.status)).size, 7);
});
