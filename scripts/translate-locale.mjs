import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { parse } from '../node_modules/.pnpm/@formatjs+icu-messageformat-parser@3.5.22/node_modules/@formatjs/icu-messageformat-parser/index.js';

const locale = process.argv[2];
if (locale !== 'sq') throw new Error('This reviewed pass is intentionally limited to sq.');

const english = JSON.parse(await readFile(new URL('../apps/web/messages/en.json', import.meta.url)));
const targetUrl = new URL(`../apps/web/messages/${locale}.json`, import.meta.url);
const target = JSON.parse(await readFile(targetUrl));
const separator = 'ZXQMONTHLOOMSEPARATORZXQ';
const execFileAsync = promisify(execFile);

function visitLeaves(source, destination, callback) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') callback(value, destination, key);
    else visitLeaves(value, destination[key], callback);
  }
}

function literalNodes(nodes, output = []) {
  for (const node of nodes) {
    if (node.type === 0) output.push(node);
    if (node.type === 5 || node.type === 6) {
      for (const option of Object.values(node.options)) literalNodes(option.value, output);
    }
    if (node.type === 8) literalNodes(node.children, output);
  }
  return output;
}

function coreText(value) {
  return value.trim();
}

const pending = new Set();
visitLeaves(english, target, (message, destination, key) => {
  for (const node of literalNodes(parse(message, { captureLocation: true }))) {
    const core = coreText(node.value);
    if (/[A-Za-z]/.test(core)) pending.add(core);
  }
});

async function translateBatch(values) {
  const query = values.join(`\n${separator}\n`);
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.search = new URLSearchParams({ client: 'gtx', sl: 'en', tl: locale, dt: 't', q: query });
  let translated;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $r=Invoke-RestMethod -Uri $env:MONTHLOOM_TRANSLATE_URI -Method Get; [Console]::Write(($r[0] | ForEach-Object { $_[0] }) -join '')",
        ],
        {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024,
          env: { ...process.env, MONTHLOOM_TRANSLATE_URI: url.toString() },
        },
      );
      translated = result.stdout;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1_000));
    }
  }
  if (!translated) throw new Error('Google Translate failed after five attempts.');
  const results = translated.split(separator).map((value) => value.trim());
  if (results.length !== values.length) {
    throw new Error(`Translation batch split failed: expected ${values.length}, got ${results.length}.`);
  }
  return results;
}

const translations = new Map();
const values = [...pending];
for (let index = 0; index < values.length; index += 4) {
  const batch = values.slice(index, index + 4);
  const results = await translateBatch(batch);
  batch.forEach((value, offset) => translations.set(value, results[offset]));
  await new Promise((resolve) => setTimeout(resolve, 500));
}

visitLeaves(english, target, (message, destination, key) => {
  const nodes = literalNodes(parse(message, { captureLocation: true }));
  let translated = message;
  for (const node of nodes.sort((left, right) => right.location.start.offset - left.location.start.offset)) {
    const leading = node.value.match(/^\s*/)?.[0] ?? '';
    const trailing = node.value.match(/\s*$/)?.[0] ?? '';
    const core = coreText(node.value);
    const replacement = translations.get(core);
    if (!replacement) continue;
    translated =
      translated.slice(0, node.location.start.offset) +
      leading +
      replacement +
      trailing +
      translated.slice(node.location.end.offset);
  }
  destination[key] = translated;
});

await writeFile(targetUrl, `${JSON.stringify(target, null, 2)}\n`);
console.info(`Translated ${translations.size} unique Albanian text segments.`);
