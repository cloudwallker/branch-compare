import type { CellResult, ScanReport } from '../src/types.ts';

const sha = (digit: string) => digit.repeat(40);

export function reportFixture(malicious = false): ScanReport {
  const cells: CellResult[] = [
    { id: 'base', kind: 'base', indices: [], status: 'passed' },
    { id: 'single-0', kind: 'single', indices: [0], status: 'passed' },
    { id: 'single-1', kind: 'single', indices: [1], status: 'passed' },
    { id: 'single-2', kind: 'single', indices: [2], status: 'passed' },
    { id: 'pair-0-1', kind: 'pair', indices: [0, 1], status: 'test-failed' },
    { id: 'pair-1-0', kind: 'pair', indices: [1, 0], status: 'merge-conflict' },
    { id: 'pair-0-2', kind: 'pair', indices: [0, 2], status: 'timeout' },
    { id: 'pair-2-0', kind: 'pair', indices: [2, 0], status: 'cancelled' },
    { id: 'pair-1-2', kind: 'pair', indices: [1, 2], status: 'error' },
    { id: 'pair-2-1', kind: 'pair', indices: [2, 1], status: 'not-run' },
  ].map((cell) => ({
    ...cell, elapsedMs: cell.status === 'passed' ? 1250 : 8500,
    exitCode: cell.status === 'test-failed' ? 1 : cell.status === 'passed' ? 0 : null,
    log: cell.id === 'pair-0-1' ? 'Expected request count <= quota\nActual: 8 > 5\n' : 'Fixture run\n',
    logTruncated: cell.id === 'pair-0-1',
    conflictPaths: cell.status === 'merge-conflict' ? ['src/shared config.ts', '配置/限制.json'] : [],
    treeSha: cell.status === 'passed' || cell.status === 'test-failed' ? sha('f') : undefined,
    interactionFailure: cell.id === 'pair-0-1',
  })) as CellResult[];
  const payload = '</script><img src="https://invalid.example/x" onerror="window.__xss=1"><script>window.__xss=2</script>&\u2028\u2029';
  if (malicious) {
    cells[4]!.log = payload;
    cells[5]!.conflictPaths = [payload];
  }
  return {
    schemaVersion: 1, toolVersion: '0.1.0', repoName: malicious ? payload : 'parallel-check-demo',
    startedAt: '2026-10-06T06:00:00.000Z', finishedAt: '2026-10-06T06:00:42.000Z',
    base: { label: 'main', sha: sha('a') },
    refs: [
      { label: malicious ? payload : 'feature/lower-quota', sha: sha('b') },
      { label: 'feature/docs-update', sha: sha('c') },
      { label: '功能/提高用量并验证长中文分支名称在窄屏下完整可读的布局', sha: sha('d') },
    ],
    command: { mode: 'argv', argv: ['node', 'test.mjs', '--name', malicious ? payload : 'quota check'] },
    commandRedacted: false, timeoutMs: 120000,
    environment: { node: 'v24.15.0', git: 'git version 2.50.0', platform: 'win32' },
    cells, cancelled: false, cleanupErrors: [],
  };
}
