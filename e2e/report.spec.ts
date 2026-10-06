import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderReportHtml } from '../src/report.ts';
import { reportFixture } from './report-fixture.ts';

let directory: string;
test.beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'branch-compare-html-')); });
test.afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

async function openReport(page: Page, malicious = false, redacted = false) {
  const report = reportFixture(malicious);
  report.commandRedacted = redacted;
  const path = join(directory, `${malicious ? 'malicious' : 'report'}-${redacted}.html`);
  await writeFile(path, renderReportHtml(report), 'utf8');
  await page.goto(pathToFileURL(path).href);
  return report;
}

test('offline matrix directions, statuses, detail selection, translation and failure filter work', async ({ page }) => {
  await openReport(page);
  await expect(page.getByRole('heading', { name: 'Branch comparison', exact: true })).toBeVisible();
  await expect(page.locator('[data-cell-id]')).toHaveCount(10);
  await expect(page.locator('[data-cell-id="single-0"]')).toContainText('Single branch');
  await expect(page.locator('[data-cell-id="pair-0-1"]')).toContainText('Interaction failure');
  await expect(page.locator('[data-cell-id="pair-0-2"]')).toContainText('Timed out');
  await expect(page.locator('[data-cell-id="pair-2-1"]')).toContainText('Not run');
  await expect(page.locator('thead')).toContainText('Merge second');
  await page.locator('[data-cell-id="pair-0-1"]').click();
  await expect(page.locator('#detail-title')).toContainText('feature/lower-quota → feature/docs-update');
  await expect(page.locator('#detail-log')).toContainText('Actual: 8 > 5');
  await expect(page.locator('#detail-shas')).toContainText('b'.repeat(40));
  await expect(page.locator('#detail-shas')).toContainText('c'.repeat(40));
  await expect(page.locator('#detail-meta')).toContainText('8.50 s');
  await expect(page.locator('#detail-meta')).toContainText('1');
  await expect(page.locator('#log-truncated')).toBeVisible();
  await page.locator('[data-cell-id="pair-1-0"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conflict-paths')).toContainText('src/shared config.ts');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.getByRole('heading', { name: '分支组合检查', exact: true })).toBeVisible();
  await expect(page.locator('#detail-title')).toContainText('feature/docs-update → feature/lower-quota');
  await page.locator('#failed-only').check();
  await expect(page.locator('[data-cell-id]:visible')).toHaveCount(6);
  await expect(page.locator('[data-cell-id="pair-2-1"]')).toBeVisible();
  await page.locator('#failed-only').uncheck();
  await expect(page.locator('[data-cell-id]:visible')).toHaveCount(10);
});

test('copy fallback selects text, explains file clipboard limitations and redacted command', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
  await openReport(page, false, true);
  await page.locator('[data-cell-id="pair-0-1"]').click();
  await expect(page.locator('#redacted-notice')).toContainText('--test');
  await page.getByRole('button', { name: 'Copy bash command', exact: true }).click();
  await expect(page.locator('#copy-feedback')).toContainText('Select and copy');
  const selected = await page.locator('#bash-command').evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd));
  expect(selected).toBe('branch-compare reproduce --repo . --report report.json --cell pair-0-1 --out ../replay-pair-0-1');
  await expect(page.locator('#powershell-command')).toHaveValue(selected);
});

test('reproduction help explains source root, report path and a new sibling output directory in both languages', async ({ page }) => {
  await openReport(page);
  await expect(page.locator('#reproduce-help')).toContainText('repository root');
  await expect(page.locator('#reproduce-help')).toContainText('--report');
  await expect(page.locator('#reproduce-help')).toContainText('report.json');
  await expect(page.locator('#reproduce-help')).toContainText('sibling');
  await expect(page.locator('#reproduce-help')).toContainText('--out');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.locator('#reproduce-help')).toContainText('仓库根目录');
  await expect(page.locator('#reproduce-help')).toContainText('--report');
  await expect(page.locator('#reproduce-help')).toContainText('同级');
  await expect(page.locator('#reproduce-help')).toContainText('新目录');
});

test('clipboard API copies the selected command when available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { (window as any).__copied = text; } } }));
  await openReport(page);
  await page.locator('[data-cell-id="pair-1-0"]').click();
  await page.getByRole('button', { name: 'Copy PowerShell command', exact: true }).click();
  await expect(page.locator('#copy-feedback')).toContainText('Copied');
  expect(await page.evaluate(() => (window as any).__copied)).toContain('--cell pair-1-0');
});

test('untrusted text remains inert and opening or using the report requests no external resource', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (!request.url().startsWith('file:')) external.push(request.url()); });
  const report = await openReport(page, true);
  await expect(page.locator('#repo-name')).toHaveText(report.repoName);
  await page.locator('[data-cell-id="pair-0-1"]').click();
  await expect(page.locator('#detail-log')).toHaveText(report.cells[4]!.log);
  await page.locator('[data-cell-id="pair-1-0"]').click();
  await expect(page.locator('#conflict-paths')).toContainText(report.cells[5]!.conflictPaths[0]!);
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  expect(await page.locator('img, iframe, object').count()).toBe(0);
  expect(external).toEqual([]);
});

for (const width of [375, 768, 1440]) {
  test(`layout fits ${width}px with readable wrapped refs and keyboard focus`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1050 });
    await openReport(page);
    await page.locator('[data-cell-id="pair-0-1"]').click();
    await page.getByRole('button', { name: '中文', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const copy = page.getByRole('button', { name: '复制 bash 命令', exact: true });
    const size = await copy.boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    await copy.focus();
    expect(await copy.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
    await page.screenshot({ path: join(test.info().outputDir, `report-${width}-zh.png`), fullPage: true });
  });
}
