import assert from 'node:assert/strict';
import test from 'node:test';

async function api() {
  try { return await import('../src/redact.ts'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') assert.fail('Credential redaction is not implemented'); throw error; }
}

test('known environment values, credential patterns and private keys are removed', async () => {
  const { redactText } = await api();
  const value = 'fixture-actual-value-012345';
  const input = `token=${value}\nAuthorization: Bearer abcdefghijklmnop\nhttps://person:pw@example.invalid/path\n-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----`;
  const output = redactText(input, { environment: { SERVICE_TOKEN: value } });
  assert.ok(!output.includes(value));
  assert.ok(!output.includes('abcdefghijklmnop'));
  assert.ok(!output.includes('person:pw'));
  assert.ok(!output.includes('BEGIN PRIVATE KEY'));
});

test('ANSI, controls and machine paths are removed without changing relative conflict paths', async () => {
  const { redactText } = await api();
  const output = redactText('\x1b[31mred\x1b[0m\x00 C:\\Users\\fixture\\repo /home/fixture/repo src/module.ts', { paths: ['/home/fixture/repo'] });
  assert.ok(!output.includes('\x1b'));
  assert.ok(!output.includes('\x00'));
  assert.ok(!output.includes('C:\\Users'));
  assert.ok(!output.includes('/home/fixture'));
  assert.ok(output.includes('src/module.ts'));
});

test('command redaction identifies commands that must be supplied again on replay', async () => {
  const { redactCommand } = await api();
  const result = redactCommand({ mode: 'argv', argv: ['node', 'verify.mjs', '--token=fixture-command-secret'] }, { environment: { API_TOKEN: 'fixture-command-secret' } });
  assert.equal(result.commandRedacted, true);
  assert.ok(!JSON.stringify(result.command).includes('fixture-command-secret'));
  assert.deepEqual(redactCommand({ mode: 'shell', text: 'node verify.mjs' }), { command: { mode: 'shell', text: 'node verify.mjs' }, commandRedacted: false });
});

test('common prefixed credential assignments are redacted without relying on environment values', async () => {
  const { redactText } = await api();
  const result = redactText('CLIENT_SECRET=fixture-client-value AWS_SECRET_ACCESS_KEY=fixture-access-value GITHUB_TOKEN=fixture-github-value', { environment: {} });
  assert.ok(!result.includes('fixture-client-value'));
  assert.ok(!result.includes('fixture-access-value'));
  assert.ok(!result.includes('fixture-github-value'));
});

test('separate credential flag values are removed from argv and quoted shell commands', async () => {
  const { redactCommand } = await api();
  for (const flag of ['--password','--token','--api-key','--client-secret']) {
    const argv=redactCommand({mode:'argv',argv:['tool',flag,'fixture-separated-value','--mode','check']},{environment:{}});
    assert.equal(argv.commandRedacted,true);assert.ok(!JSON.stringify(argv.command).includes('fixture-separated-value'));
    assert.ok(JSON.stringify(argv.command).includes('check'));
    for(const value of ['fixture-separated-value','"fixture separated value"',"'fixture separated value'"]) {
      const shell=redactCommand({mode:'shell',text:`tool ${flag} ${value} --mode check`},{environment:{}});
      assert.equal(shell.commandRedacted,true);assert.ok(!JSON.stringify(shell.command).includes('fixture'));
      assert.ok(JSON.stringify(shell.command).includes('--mode check'));
    }
  }
});
