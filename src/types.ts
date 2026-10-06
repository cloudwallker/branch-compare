export type Locale = 'en' | 'zh';
export type TestCommand = { mode: 'shell'; text: string } | { mode: 'argv'; argv: string[] };
export interface ResolvedRef { label: string; sha: string }
export type CellKind = 'base' | 'single' | 'pair';
export type CellStatus = 'passed' | 'test-failed' | 'merge-conflict' | 'timeout' | 'cancelled' | 'error' | 'not-run';
export interface CellPlan { id: string; kind: CellKind; indices: number[] }
export interface CellResult extends CellPlan {
  status: CellStatus;
  elapsedMs: number;
  exitCode: number | null;
  log: string;
  logTruncated: boolean;
  conflictPaths: string[];
  treeSha?: string;
  interactionFailure: boolean;
}
export interface ScanReport {
  schemaVersion: 1;
  toolVersion: string;
  repoName: string;
  startedAt: string;
  finishedAt: string;
  base: ResolvedRef;
  refs: ResolvedRef[];
  command: TestCommand;
  commandRedacted: boolean;
  timeoutMs: number;
  environment: { node: string; git: string; platform: string };
  cells: CellResult[];
  cancelled: boolean;
  cleanupErrors: string[];
}
export interface ScanOptions {
  repo: string;
  base: string;
  refs: string[];
  command: TestCommand;
  timeoutMs: number;
  signal?: AbortSignal;
  onlyCell?: string;
  tempParent?: string;
  onCell?: (cell: CellResult) => void;
}
