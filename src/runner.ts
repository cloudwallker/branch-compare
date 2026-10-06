import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { makePlan, markInteractions, validateCommand } from './model.ts';
import { runProcess, type ProcessResult } from './process.ts';
import { limitLog, redactCommand, redactText, type RedactionOptions } from './redact.ts';
import type { CellPlan, CellResult, ResolvedRef, ScanOptions, ScanReport } from './types.ts';

function gitEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) if (/^GIT_/i.test(key)) delete environment[key];
  environment.GIT_CONFIG_NOSYSTEM = '1';
  environment.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  environment.GIT_TERMINAL_PROMPT = '0';
  environment.GIT_AUTHOR_NAME = 'Branch Compare Temporary Merge';
  environment.GIT_AUTHOR_EMAIL = 'temporary-merge@invalid.example';
  environment.GIT_COMMITTER_NAME = environment.GIT_AUTHOR_NAME;
  environment.GIT_COMMITTER_EMAIL = environment.GIT_AUTHOR_EMAIL;
  return environment;
}

function contained(path: string, parent: string): boolean {
  const rel = relative(parent, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

const gitFlags = ['-c', 'core.hooksPath=', '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'rerere.enabled=false', '-c', 'rerere.autoupdate=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false'];

async function git(cwd: string, args: string[], redaction: RedactionOptions = {}, signal?: AbortSignal, timeoutMs = 30000): Promise<ProcessResult> {
  return await runProcess({ mode: 'argv', argv: ['git', ...gitFlags, ...args] }, { cwd, timeoutMs, environment: gitEnvironment(), redaction, signal });
}

function requireGit(result: ProcessResult, operation: string, redaction: RedactionOptions): string {
  if (result.error || result.exitCode !== 0 || result.timedOut || result.cancelled || result.terminationFailed) {
    throw new Error(redactText(`${operation} failed: ${result.error ?? result.log ?? 'Git did not exit successfully'}`, redaction));
  }
  return result.stdout.trim();
}

/** Read-only canonical source boundaries used by the CLI's output validation. */
export async function resolveRepository(repo: string): Promise<{ repoPath: string; commonDir: string }> {
  const input = await realpath(resolve(repo));
  const redaction = { paths: [input] };
  const bare = requireGit(await git(input, ['rev-parse', '--is-bare-repository'], redaction), 'Repository validation', redaction);
  if (bare === 'true') throw new Error('Bare repositories are unsupported; provide a local working tree.');
  const top = requireGit(await git(input, ['rev-parse', '--show-toplevel'], redaction), 'Repository validation', redaction);
  const repoPath = await realpath(top);
  const common = requireGit(await git(repoPath, ['rev-parse', '--git-common-dir'], { paths: [repoPath] }), 'Repository validation', redaction);
  return { repoPath, commonDir: await realpath(isAbsolute(common) ? common : resolve(repoPath, common)) };
}

function emptyCell(plan: CellPlan): CellResult {
  return { ...plan, indices: [...plan.indices], status: 'not-run', elapsedMs: 0, exitCode: null, log: '', logTruncated: false, conflictPaths: [], interactionFailure: false };
}

export async function runScan(options: ScanOptions): Promise<ScanReport> {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 3600000) throw new Error('timeoutMs must be between 1000 and 3600000.');
  const command = validateCommand(options.command);
  if (!Array.isArray(options.refs) || options.refs.length < 2 || options.refs.length > 5) throw new Error('Provide 2–5 candidate refs.');
  const plan = makePlan(options.refs.length);
  if (options.onlyCell !== undefined && !plan.some(cell => cell.id === options.onlyCell)) throw new Error('Unknown onlyCell ID.');
  const { repoPath, commonDir } = await resolveRepository(options.repo);
  let redaction: RedactionOptions = { environment: process.env, paths: [repoPath, commonDir] };
  async function resolveRef(label: string): Promise<ResolvedRef> {
    if (typeof label !== 'string' || !label.trim() || label.includes('\0') || label.startsWith('-') || label.length > 512) throw new Error('Invalid ref label.');
    const sha = requireGit(await git(repoPath, ['rev-parse', '--verify', '--end-of-options', `${label}^{commit}`], redaction), 'Ref commit validation', redaction);
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) throw new Error('Ref did not resolve to a full commit SHA.');
    return { label: redactText(label, redaction), sha };
  }
  const base = await resolveRef(options.base);
  const refs: ResolvedRef[] = [];
  for (const label of options.refs) refs.push(await resolveRef(label));
  if (new Set(refs.map(ref => ref.sha)).size !== refs.length) throw new Error('Duplicate candidate commit SHAs are unsupported.');
  for (const ref of refs) {
    const result = await git(repoPath, ['merge-base', '--is-ancestor', base.sha, ref.sha], redaction);
    if (result.exitCode === 1 && !result.error && !result.timedOut) throw new Error('The base must be an ancestor of every candidate ref.');
    requireGit(result, 'Candidate ancestor validation', redaction);
  }
  const startedAt = new Date().toISOString();
  const report: ScanReport = {
    schemaVersion: 1, toolVersion: '0.1.0', repoName: redactText(basename(repoPath), redaction), startedAt, finishedAt: startedAt,
    base, refs, ...redactCommand(command, redaction), timeoutMs: options.timeoutMs,
    environment: { node: process.version, git: requireGit(await git(repoPath, ['--version'], redaction), 'Git version', redaction), platform: process.platform },
    cells: plan.map(emptyCell), cancelled: false, cleanupErrors: [],
  };
  function cleanupError(message: string) { report.cleanupErrors.push(redactText(message, redaction).slice(0, 4096)); }
  if (options.signal?.aborted) { report.cancelled = true; report.finishedAt = new Date().toISOString(); return report; }
  const parent = await realpath(resolve(options.tempParent ?? tmpdir()));
  if (contained(parent, repoPath) || contained(parent, commonDir)) throw new Error('The temporary parent must be outside the source repository.');
  const tempRoot = await mkdtemp(join(parent, 'branch-compare-'));
  const ownedRoot = await realpath(tempRoot);
  const token = randomUUID();
  const marker = join(tempRoot, '.branch-compare-owned');
  await writeFile(marker, token, { flag: 'wx' });
  redaction = { environment: process.env, paths: [repoPath, commonDir, tempRoot, ownedRoot] };
  const clone = join(tempRoot, 'clone');
  let preserve = false;
  let unsafeProcess = false;
  async function isolatedGit(cwd: string, args: string[], redactionOptions = redaction, signal?: AbortSignal, timeoutMs = 30000) {
    const result = await git(cwd, args, redactionOptions, signal, timeoutMs);
    if (result.terminationFailed) { preserve = true; unsafeProcess = true; }
    return result;
  }
  async function ownPath(path: string) {
    if (!contained(resolve(path), ownedRoot) || resolve(path) === ownedRoot) throw new Error('Resource is outside this scan temporary directory.');
    if ((await lstat(tempRoot)).isSymbolicLink() || await realpath(tempRoot) !== ownedRoot || await readFile(marker, 'utf8') !== token) throw new Error('Temporary resource ownership changed.');
    const stat = await lstat(path).catch(() => undefined);
    if (stat?.isSymbolicLink()) throw new Error('Temporary resource was replaced by a link.');
    if (stat && !contained(await realpath(path), ownedRoot)) throw new Error('Temporary resource resolves outside this scan.');
  }
  try {
    const template = join(tempRoot, 'empty-template');
    await mkdir(template);
    const cloned = await isolatedGit(parent, ['clone', '--local', '--no-hardlinks', '--no-checkout', `--template=${template}`, '--', repoPath, clone], redaction, options.signal, 60000);
    if (cloned.terminationFailed) preserve = true;
    requireGit(cloned, 'Isolated local clone', redaction);
    // Pin even unreferenced input commits before materializing any borrowed object database.
    for (const [index, input] of [base, ...refs].entries()) {
      requireGit(await isolatedGit(clone, ['update-ref', `refs/branch-compare/inputs/${index}`, input.sha], redaction), 'Clone input pinning', redaction);
    }
    const alternates = join(clone, '.git', 'objects', 'info', 'alternates');
    if (await lstat(alternates).catch(() => undefined)) {
      await ownPath(alternates);
      requireGit(await isolatedGit(clone, ['repack', '-a', '-d'], redaction, options.signal, 60000), 'Independent object copy', redaction);
      await ownPath(alternates);
      await rm(alternates);
    }
    // Drop the source URL, which is unnecessary once all inputs are pinned.
    requireGit(await isolatedGit(clone, ['remote', 'remove', 'origin'], redaction), 'Clone setup', redaction);
    for (let index = 0; index < plan.length; index++) {
      const cellPlan = plan[index]!;
      if (options.signal?.aborted) { report.cancelled = true; break; }
      if (options.onlyCell !== undefined && cellPlan.id !== options.onlyCell) continue;
      const cell = emptyCell(cellPlan);
      const started = performance.now();
      const worktree = join(tempRoot, `cell-${index}`);
      let safeToRemove = true;
      function append(log: string, truncated = false) {
        const bounded = limitLog(cell.log + (cell.log ? '\n' : '') + log);
        cell.log = bounded.log;
        cell.logTruncated ||= truncated || bounded.logTruncated;
      }
      function stateOf(result: ProcessResult): CellResult['status'] | undefined {
        if (result.cancelled) report.cancelled = true;
        if (result.terminationFailed) { safeToRemove = false; preserve = true; return 'error'; }
        if (result.cancelled) { report.cancelled = true; return 'cancelled'; }
        if (result.timedOut) return 'timeout';
        if (result.error) return 'error';
        return undefined;
      }
      try {
        const added = await isolatedGit(clone, ['worktree', 'add', '--detach', worktree, base.sha], redaction, options.signal);
        append('[checkout]\n' + (added.error ?? added.log), added.logTruncated);
        const addStatus = stateOf(added);
        if (addStatus) cell.status = addStatus;
        else if (added.exitCode !== 0) cell.status = 'error';
        else {
          let merged = true;
          for (const refIndex of cellPlan.indices) {
            const result = await isolatedGit(worktree, ['merge', '--no-ff', '--no-edit', '--no-gpg-sign', '--', refs[refIndex]!.sha], redaction, options.signal);
            append(`[merge ${refIndex}]\n` + (result.error ?? result.log), result.logTruncated);
            const mergeStatus = stateOf(result);
            if (mergeStatus) { cell.status = mergeStatus; merged = false; break; }
            if (result.exitCode !== 0) {
              const unresolved = await isolatedGit(worktree, ['diff', '--name-only', '--diff-filter=U', '-z'], redaction);
              if (unresolved.exitCode === 0 && !unresolved.error) {
                const paths=unresolved.stdout.split('\0').filter(Boolean).map(path=>redactText(path,redaction));
                const truncated=paths.length>1000||unresolved.logTruncated||paths.some(path=>path.length>4096);
                cell.conflictPaths=paths.slice(0,1000).map(path=>path.slice(0,4096));
                if(truncated) append('[conflicts]\nConflict path list truncated: at most 1,000 paths and 4,096 characters per path are shown.',true);
              }
              cell.status = cell.conflictPaths.length ? 'merge-conflict' : 'error';
              merged = false;
              break;
            }
          }
          if (merged) {
            cell.treeSha = requireGit(await isolatedGit(worktree, ['rev-parse', 'HEAD^{tree}'], redaction), 'Tree verification', redaction);
            const environment = gitEnvironment();
            // Tests see their own working tree; inherited Git redirections cannot target the source.
            for (const key of Object.keys(environment)) if (/^GIT_/i.test(key)) delete environment[key];
            // A scan invoked by node:test must start a fresh test runner in each cell.
            delete environment.NODE_TEST_CONTEXT;
            environment.GIT_CONFIG_NOSYSTEM = '1';
            environment.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
            const result = await runProcess(command, { cwd: worktree, timeoutMs: options.timeoutMs, signal: options.signal, environment, redaction });
            append('[test]\n' + (result.error ?? result.log), result.logTruncated);
            cell.exitCode = result.exitCode;
            cell.status = stateOf(result) ?? (result.exitCode === 0 ? 'passed' : result.exitCode !== null ? 'test-failed' : 'error');
          }
        }
      } catch (error) {
        cell.status = options.signal?.aborted ? 'cancelled' : 'error';
        if (cell.status === 'cancelled') report.cancelled = true;
        append(redactText((error as Error).message, redaction));
      } finally {
        if (safeToRemove && !unsafeProcess) {
          try {
            await ownPath(worktree);
            const removed = await isolatedGit(clone, ['worktree', 'remove', '--force', worktree], redaction);
            // Failed add may leave an unregistered owned directory; the owned root removal below handles it.
            if (removed.exitCode !== 0) {
              const exists = await lstat(worktree).catch(() => undefined);
              if (exists) { preserve = true; cleanupError(`Worktree cleanup failed for ${cellPlan.id}: ${removed.error ?? removed.log}`); }
            }
          } catch (error) { preserve = true; cleanupError(`Worktree cleanup failed: ${(error as Error).message}`); }
        } else cleanupError(`Process tree termination could not be verified for ${cellPlan.id}; its temporary resources were preserved.`);
        cell.elapsedMs = Math.round(performance.now() - started);
        report.cells[index] = cell;
        // A caller only receives the already redacted public result.
        options.onCell?.({ ...cell, indices: [...cell.indices], conflictPaths: [...cell.conflictPaths] });
      }
      if (report.cancelled || preserve) break;
    }
  } catch (error) {
    if (options.signal?.aborted) report.cancelled = true;
    else {
      const index = options.onlyCell ? plan.findIndex(cell => cell.id === options.onlyCell) : 0;
      report.cells[index] = { ...emptyCell(plan[index]!), status: 'error', log: limitLog(redactText((error as Error).message, redaction)).log };
    }
  } finally {
    if (!preserve) {
      try {
        if ((await lstat(tempRoot)).isSymbolicLink() || await realpath(tempRoot) !== ownedRoot || await readFile(marker, 'utf8') !== token) throw new Error('Temporary directory ownership changed.');
        if (!contained(ownedRoot, parent) || ownedRoot === parent || contained(repoPath, ownedRoot) || contained(commonDir, ownedRoot)) throw new Error('Unsafe temporary directory boundary.');
        await rm(ownedRoot, { recursive: true, force: true });
      } catch (error) { cleanupError(`Temporary cleanup failed: ${(error as Error).message}`); }
    } else if (!report.cleanupErrors.length) cleanupError('Temporary resources were preserved because process or resource ownership could not be verified.');
    report.cells = markInteractions(report.cells);
    report.finishedAt = new Date().toISOString();
  }
  return report;
}
