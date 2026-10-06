import { StringDecoder } from 'node:string_decoder';
import type { TestCommand } from './types.ts';

export interface RedactionOptions {
  environment?: NodeJS.ProcessEnv;
  paths?: readonly string[];
}

export function secretValues(environment: NodeJS.ProcessEnv = process.env): string[] {
  return [...new Set(Object.entries(environment)
    .filter(([key, value]) => /(?:TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIAL|API_KEY|ACCESS_KEY|AUTH)/i.test(key) && !!value)
    .map(([, value]) => value!))].sort((a, b) => b.length - a.length);
}

export function redactText(input: string, options: RedactionOptions = {}): string {
  let text = input
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '');
  for (const value of secretValues(options.environment)) text = text.split(value).join('[REDACTED]');
  text = text
    .replace(/-----BEGIN (?:[A-Z ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[REDACTED PRIVATE KEY]')
    .replace(/(\bAuthorization\s*:\s*(?:Bearer|Basic)\s+)[^\s"'<>]+/gi, '$1[REDACTED]')
    .replace(/(\b(?:[a-z0-9]+[_-])*(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|credential)(?:[_-][a-z0-9]+)*\b["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;<>]+)/gi, '$1[REDACTED]')
    .replace(/(--(?:[a-z0-9]+[_-])*(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|credential|authorization|auth)(?:[_-][a-z0-9]+)*\s+)(?:"[^"\n]*"|'[^'\n]*'|[^\s;&|<>]+)/gi, '$1[REDACTED]')
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{16,})\b/g, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]');
  for (const path of [...(options.paths ?? [])].sort((a, b) => b.length - a.length)) {
    if (!path) continue;
    for (const variant of new Set([path, path.replaceAll('\\', '/'), path.replaceAll('/', '\\')])) text = text.split(variant).join('[PATH]');
  }
  return text
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>|]*/g, '[PATH]')
    .replace(/(?<![\w:/])\/[^\s"'<>|]+/g, '[PATH]');
}

export function redactCommand(command: TestCommand, options: RedactionOptions = {}): { command: TestCommand; commandRedacted: boolean } {
  const clean: TestCommand = command.mode === 'shell'
    ? { mode: 'shell', text: redactText(command.text, options) }
    : { mode: 'argv', argv: command.argv.map(value => redactText(value, options)) };
  if (command.mode === 'argv' && clean.mode === 'argv') {
    for (let index=0;index<command.argv.length-1;index++) {
      if (/^--(?:[a-z0-9]+[_-])*(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|credential|authorization|auth)(?:[_-][a-z0-9]+)*$/i.test(command.argv[index]!)) {
        clean.argv[index+1]='[REDACTED]';index++;
      }
    }
  }
  return { command: clean, commandRedacted: JSON.stringify(clean) !== JSON.stringify(command) };
}

/** Truncate at a complete UTF-8 boundary, counting stdout and stderr together. */
export function limitLog(text: string, maxBytes = 256 * 1024): { log: string; logTruncated: boolean } {
  const bytes = Buffer.from(text);
  if (bytes.length <= maxBytes) return { log: text, logTruncated: false };
  const decoder = new StringDecoder('utf8');
  return { log: decoder.write(bytes.subarray(0, maxBytes)), logTruncated: true };
}
