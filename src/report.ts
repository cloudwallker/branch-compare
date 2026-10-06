import { createHash } from 'node:crypto';
import type { CellPlan, Locale, ScanReport } from './types.ts';
import { reportScript, reportStyles } from './report-assets.ts';

/** The report file supplies fixed SHAs; callers run this from their repository. */
export function reproduceCommand(report: ScanReport, cell: CellPlan, shell: 'bash' | 'powershell'): string {
  if (shell !== 'bash' && shell !== 'powershell') throw new Error('Unsupported shell');
  const recorded = report.cells.find((result) => result.id === cell.id);
  if (!/^(?:base|single-\d+|pair-\d+-\d+)$/.test(cell.id) || !recorded ||
      recorded.kind !== cell.kind || recorded.indices.join(',') !== cell.indices.join(',')) {
    throw new Error('Cell does not match the report');
  }
  return `branch-compare reproduce --repo . --report report.json --cell ${cell.id} --out ../replay-${cell.id}`;
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Generates one self-contained offline document. All user content is inert JSON. */
export function renderReportHtml(report: ScanReport, locale: Locale = 'en'): string {
  const hash = createHash('sha256').update(reportScript).digest('base64');
  const data = encodeJson({ report, locale: locale === 'zh' ? 'zh' : 'en', commands: Object.fromEntries(
    report.cells.map((cell) => [cell.id, {
      bash: reproduceCommand(report, cell, 'bash'), powershell: reproduceCommand(report, cell, 'powershell'),
    }]),
  ) });
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="${locale === 'zh' ? 'zh' : 'en'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Branch Compare</title><style>${reportStyles}</style></head>
<body><a class="skip-link" href="#matrix-section">Skip to comparison matrix / 跳到组合矩阵</a>
<main class="workspace">
  <header class="page-header"><div><p class="eyebrow">BRANCH COMPARE <span> / </span><span id="eyebrow-text"></span></p><h1 id="page-title"></h1><p id="repo-name" class="repo-name"></p></div>
    <div class="language-switch" role="group" aria-label="Language / 语言"><button id="locale-en" type="button">English</button><button id="locale-zh" type="button">中文</button></div>
  </header>
  <section id="summary" class="summary" aria-label="Summary / 摘要"></section>
  <section class="baseline-section"><div id="baseline-card"></div><div id="run-context" class="run-context"></div></section>
  <p id="condition-note" class="condition-note"></p>
  <div id="scan-notices" class="scan-notices"></div>
  <div class="report-grid">
    <section id="matrix-section" class="panel matrix-panel" aria-labelledby="matrix-title" tabindex="-1">
      <div class="panel-heading"><div><h2 id="matrix-title"></h2><p id="matrix-subtitle" class="muted"></p></div></div>
      <div class="matrix-controls"><label class="filter"><input id="failed-only" type="checkbox"><span id="filter-label"></span></label><span id="filter-count" class="muted" aria-live="polite"></span></div>
      <div id="matrix-scroll" class="matrix-scroll" tabindex="0" role="region" aria-label="Scrollable comparison matrix / 可滚动组合矩阵"><table id="matrix"></table></div>
      <div id="status-legend" class="status-legend"></div>
      <p id="scope-note" class="scope-note"></p>
    </section>
    <section class="panel detail-panel" aria-labelledby="detail-heading">
      <div class="panel-heading"><div><p id="detail-eyebrow" class="eyebrow"></p><h2 id="detail-heading"></h2></div><span id="detail-id" class="cell-id"></span></div>
      <h3 id="detail-title" class="detail-title"></h3><div id="detail-status" class="detail-status"></div>
      <dl id="detail-meta" class="detail-meta"></dl>
      <details class="sha-details" open><summary id="sha-title"></summary><div id="detail-shas"></div></details>
      <section id="conflict-section" class="detail-block"><h3 id="conflict-title"></h3><ul id="conflict-paths"></ul></section>
      <section class="detail-block"><div class="block-heading"><h3 id="log-title"></h3><span id="log-truncated" class="small-note"></span></div><pre id="detail-log" tabindex="0"></pre></section>
      <section class="detail-block"><h3 id="reproduce-title"></h3><p id="reproduce-help" class="muted"></p><p id="redacted-notice" class="notice"></p>
        <div class="command-block"><label for="bash-command">bash</label><textarea id="bash-command" readonly spellcheck="false" rows="3"></textarea><button id="copy-bash" class="copy-button" type="button"></button></div>
        <div class="command-block"><label for="powershell-command">PowerShell</label><textarea id="powershell-command" readonly spellcheck="false" rows="3"></textarea><button id="copy-powershell" class="copy-button" type="button"></button></div>
        <p id="copy-feedback" class="copy-feedback" role="status" aria-live="polite"></p>
      </section>
    </section>
  </div>
  <footer id="report-footer"></footer>
</main><noscript>This report needs JavaScript to display the matrix. / 需要启用 JavaScript 才能显示矩阵。</noscript>
<script id="report-data" type="application/json">${data}</script>
<script>${reportScript}</script></body></html>`;
}
