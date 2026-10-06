import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { limitLog, redactText, secretValues, type RedactionOptions } from './redact.ts';
import type { TestCommand } from './types.ts';

export const MAX_LOG_BYTES = 256 * 1024;
export interface ProcessOptions {
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  environment?: NodeJS.ProcessEnv;
  redaction?: RedactionOptions;
}
export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  log: string;
  logTruncated: boolean;
  elapsedMs: number;
  timedOut: boolean;
  cancelled: boolean;
  error?: string;
  terminationFailed?: boolean;
}

async function terminateTree(child: ChildProcess): Promise<boolean> {
  if (!child.pid) return true;
  if (process.platform === 'win32') {
    // An exited parent's PID may have been reused; it cannot identify its former tree.
    if (child.exitCode !== null || child.signalCode !== null) return false;
    return await new Promise(resolve => {
      let killer: ChildProcess;
      try { killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }
      catch { resolve(false); return; }
      const deadline = setTimeout(() => { killer.kill(); resolve(false); }, 5000);
      killer.once('error', () => { clearTimeout(deadline); resolve(false); });
      killer.once('close', code => { clearTimeout(deadline); resolve(code === 0); });
    });
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false; }
  await new Promise(resolve => setTimeout(resolve, 200));
  try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false; }
  return true;
}

export async function runProcess(command: TestCommand, options: ProcessOptions): Promise<ProcessResult> {
  const started = performance.now();
  const environment = options.environment ?? process.env;
  const redaction = { ...options.redaction, environment: options.redaction?.environment ?? environment };
  const base = { exitCode: null, stdout: '', stderr: '', log: '', logTruncated: false, elapsedMs: 0, timedOut: false, cancelled: false };
  if (options.signal?.aborted) return { ...base, cancelled: true };
  if (process.platform === 'win32' && command.mode === 'argv' && /\.(?:cmd|bat)$/i.test(command.argv[0] ?? '')) {
    return { ...base, error: 'Windows batch programs require an explicit trusted shell command with --test.' };
  }
  const secrets = secretValues(redaction.environment);
  // Lookahead lets known values spanning chunks or the public log boundary be removed first.
  const rawLimit = MAX_LOG_BYTES + 64 * 1024 + Math.max(0, ...secrets.map(value => Buffer.byteLength(value)));
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  let captured = 0;
  let rawTruncated = false;
  let timedOut = false;
  let cancelled = false;
  let terminationFailed = false;
  let stopping: Promise<void> | undefined;
  let closed = false;
  let forceClose: ReturnType<typeof setTimeout> | undefined;
  let completeClose: ((code: number | null) => void) | undefined;
  let startupError: string | undefined;
  let child: ChildProcess;
  try {
    const common: SpawnOptions = { cwd: options.cwd, env: environment, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] };
    child = command.mode === 'shell'
      ? spawn(command.text, { ...common, shell: process.platform === 'win32' ? (environment.ComSpec ?? 'cmd.exe') : '/bin/sh' })
      : spawn(command.argv[0]!, command.argv.slice(1), { ...common, shell: false });
  } catch (error) {
    return { ...base, elapsedMs: Math.round(performance.now() - started), error: redactText(`Cannot start process: ${(error as Error).message}. Use --test for a trusted shell command when required.`, redaction) };
  }
  function collect(chunk: Buffer, target: Buffer[]) {
    const room = rawLimit - captured;
    if (chunk.length > room) rawTruncated = true;
    if (room > 0) { const part = chunk.subarray(0, room); target.push(part); captured += part.length; }
  }
  child.stdout?.on('data', chunk => collect(Buffer.from(chunk), out));
  child.stderr?.on('data', chunk => collect(Buffer.from(chunk), err));
  function stop(reason: 'timeout' | 'cancelled') {
    if (stopping) return;
    if (reason === 'timeout') timedOut = true; else cancelled = true;
    stopping = terminateTree(child).then(success => {
      terminationFailed = !success;
      if (!closed) forceClose = setTimeout(() => {
        if (closed) return;
        terminationFailed = true;
        // Do not keep the CLI alive when a descendant retains an inherited pipe.
        // The caller must preserve temporary resources because termination is unverified.
        child.stdout?.destroy();
        child.stderr?.destroy();
        child.unref();
        completeClose?.(null);
      }, success ? 1000 : 500);
    });
  }
  const timeout = setTimeout(() => stop('timeout'), options.timeoutMs);
  const abort = () => stop('cancelled');
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const code = await new Promise<number | null>(resolve => {
    completeClose = resolve;
    child.once('error', error => { startupError = redactText(`Cannot start process: ${error.message}. Use --test for a trusted shell command when required.`, redaction); });
    child.once('close', code => { closed = true; if (forceClose) clearTimeout(forceClose); resolve(code); });
  });
  clearTimeout(timeout);
  options.signal?.removeEventListener('abort', abort);
  if (stopping) await stopping;
  if (forceClose) clearTimeout(forceClose);
  const decode = (chunks: Buffer[]) => new StringDecoder('utf8').write(Buffer.concat(chunks));
  const redactStream = (chunks: Buffer[]) => {
    let raw=decode(chunks);
    if (rawTruncated) {
      // Each stream may stop midway through a value when their shared budget fills.
      const tail=Math.max(0,...secrets.map(value=>value.length));
      raw=raw.slice(0,Math.max(0,raw.length-tail));
    }
    return redactText(raw,redaction);
  };
  // Redact each stream before joining: stderr cannot split a stdout credential.
  const stdoutLog=redactStream(out),stderrLog=redactStream(err);
  const bounded = limitLog(stdoutLog+(stdoutLog&&stderrLog?'\n[stderr]\n':'')+stderrLog, MAX_LOG_BYTES);
  return {
    exitCode: startupError ? null : code, stdout: decode(out), stderr: decode(err),
    log: bounded.log, logTruncated: rawTruncated || bounded.logTruncated,
    elapsedMs: Math.round(performance.now() - started), timedOut, cancelled,
    ...(startupError ? { error: startupError } : {}), ...(terminationFailed ? { terminationFailed: true } : {}),
  };
}
