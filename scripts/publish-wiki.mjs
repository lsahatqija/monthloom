import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const wikiPath = resolve(process.env.WIKI_PATH ?? '');
const beforeSha = process.env.BEFORE_SHA ?? '';
const afterSha = process.env.AFTER_SHA ?? '';
const repository = process.env.REPOSITORY ?? '';
const serverUrl = process.env.SERVER_URL ?? 'https://github.com';
const runUrl = process.env.RUN_URL ?? '';
const verificationResult = process.env.VERIFICATION_RESULT || 'unknown';
const pushedAt = process.env.PUSHED_AT || new Date().toISOString();

if (!process.env.WIKI_PATH || !afterSha || !repository) {
  throw new Error('WIKI_PATH, AFTER_SHA, and REPOSITORY are required.');
}

const runGit = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();

const titleCase = (value) =>
  value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const cleanSubject = (subject) => {
  const withoutPrefix = subject
    .replace(
      /^(feat|fix|docs|test|refactor|perf|build|ci|chore|style|revert)(\([^)]+\))?!?:\s*/i,
      '',
    )
    .replace(/^merge pull request #\d+ from \S+\s*/i, '')
    .trim();
  if (!withoutPrefix) return subject.trim();
  return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
};

const categoryFor = (subject) => {
  const conventional = subject.match(/^([a-z]+)(?:\([^)]+\))?!?:/i)?.[1]?.toLowerCase();
  if (conventional === 'feat') return 'New features';
  if (conventional === 'fix' || conventional === 'revert') return 'Fixes';
  if (conventional === 'docs') return 'Documentation';
  if (conventional === 'test') return 'Tests';
  if (['build', 'ci', 'chore', 'style'].includes(conventional)) return 'Maintenance';
  if (['refactor', 'perf'].includes(conventional)) return 'Improvements';
  if (/^(fix|correct|prevent|resolve|repair)\b/i.test(subject)) return 'Fixes';
  if (/^(add|create|implement|introduce|support|enable)\b/i.test(subject)) return 'New features';
  return 'Improvements';
};

const validBefore =
  beforeSha &&
  !/^0+$/.test(beforeSha) &&
  (() => {
    try {
      runGit('cat-file', '-e', `${beforeSha}^{commit}`);
      return true;
    } catch {
      return false;
    }
  })();

const range = validBefore ? `${beforeSha}..${afterSha}` : `${afterSha}^..${afterSha}`;
let log = runGit('log', '--no-merges', '--format=%H%x1f%s', range);
if (!log) log = runGit('log', '--format=%H%x1f%s', range);

const commits = log
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [sha, ...subjectParts] = line.split('\x1f');
    return { sha, subject: subjectParts.join('\x1f') };
  });

const highlights = runGit('log', '--merges', '--format=%B%x1e', range)
  .split('\x1e')
  .map((message) =>
    message
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  )
  .filter((lines) => /^merge pull request #\d+/i.test(lines[0] ?? '') && lines.length > 1)
  .map((lines) => ({
    number: lines[0].match(/#(\d+)/)?.[1],
    title: cleanSubject(lines[1]),
  }));

const grouped = new Map();
for (const commit of commits) {
  if (highlights.some(({ title }) => title === cleanSubject(commit.subject))) continue;
  const category = categoryFor(commit.subject);
  const items = grouped.get(category) ?? [];
  items.push(commit);
  grouped.set(category, items);
}

const numstat = runGit('diff', '--numstat', range);
let insertions = 0;
let deletions = 0;
let binaryFiles = 0;
for (const line of numstat.split('\n').filter(Boolean)) {
  const [added, removed] = line.split('\t');
  if (added === '-' || removed === '-') binaryFiles += 1;
  else {
    insertions += Number(added);
    deletions += Number(removed);
  }
}

const changedFiles = runGit('diff', '--name-only', range).split('\n').filter(Boolean);
const areas = new Map([
  ['Web application', changedFiles.filter((path) => path.startsWith('apps/web/')).length],
  ['API', changedFiles.filter((path) => path.startsWith('apps/api/')).length],
  [
    'Shared contracts',
    changedFiles.filter((path) => path.startsWith('packages/contracts/')).length,
  ],
  [
    'Infrastructure',
    changedFiles.filter((path) => /^(infrastructure\/|compose(?:\.|-))/.test(path)).length,
  ],
  ['Documentation', changedFiles.filter((path) => /^(docs\/|README\.md|wiki\/)/.test(path)).length],
  ['Automation', changedFiles.filter((path) => /^(\.github\/|scripts\/)/.test(path)).length],
]);

mkdirSync(wikiPath, { recursive: true });
rmSync(join(wikiPath, 'Security.md'), { force: true });

for (const file of readdirSync(join(root, 'wiki')).filter((name) => name.endsWith('.md'))) {
  const content = readFileSync(join(root, 'wiki', file), 'utf8').replaceAll(
    '{{REPOSITORY}}',
    repository,
  );
  writeFileSync(join(wikiPath, file), content);
}

const documentation = new Map([
  ['architecture.md', 'Architecture.md'],
  ['deployment-hetzner.md', 'Deployment.md'],
  ['github-wiki.md', 'Wiki-Maintenance.md'],
  ['production-concerns.md', 'Production-Concerns.md'],
  ['runtime-configuration.md', 'Runtime-Configuration.md'],
  ['testing.md', 'Testing.md'],
]);

for (const [source, target] of documentation) {
  const sourcePath = join(root, 'docs', source);
  if (existsSync(sourcePath)) {
    const content = readFileSync(sourcePath, 'utf8')
      .replace(/\]\(\.\/adr\/\)/g, '](Architecture-Decisions)')
      .replace(/\]\((?:\.\/)?([a-z-]+)\.md(#[^)]+)?\)/g, (match, file, anchor = '') => {
        const wikiTarget = documentation.get(`${file}.md`);
        return wikiTarget ? `](${basename(wikiTarget, '.md')}${anchor})` : match;
      });
    writeFileSync(join(wikiPath, target), content);
  }
}

const adrPath = join(wikiPath, 'Architecture-Decisions.md');
const adrFiles = readdirSync(join(root, 'docs', 'adr'))
  .filter((name) => name.endsWith('.md'))
  .sort();
const adrLinks = [];
for (const file of adrFiles) {
  const target = `ADR-${basename(file, '.md')}.md`;
  cpSync(join(root, 'docs', 'adr', file), join(wikiPath, target));
  adrLinks.push(`- [${titleCase(basename(file, '.md'))}](${basename(target, '.md')})`);
}
writeFileSync(
  adrPath,
  `# Architecture decisions\n\nThese records explain the important technical choices behind Monthloom.\n\n${adrLinks.join('\n')}\n`,
);

const date = new Date(pushedAt);
const safeDate = Number.isNaN(date.valueOf()) ? new Date() : date;
const timestamp = safeDate
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const shortSha = afterSha.slice(0, 7);
const pageName = `Patch-${timestamp}-${shortSha}`;
const commitBase = `${serverUrl}/${repository}/commit`;
const compareUrl = `${serverUrl}/${repository}/compare/${validBefore ? beforeSha : `${afterSha}^`}...${afterSha}`;
const categories = [
  'New features',
  'Improvements',
  'Fixes',
  'Documentation',
  'Tests',
  'Maintenance',
];
const sections = categories
  .filter((category) => grouped.has(category))
  .map((category) => {
    const bullets = grouped
      .get(category)
      .map(
        ({ sha, subject }) =>
          `- ${cleanSubject(subject)} ([${sha.slice(0, 7)}](${commitBase}/${sha}))`,
      )
      .join('\n');
    return `## ${category}\n\n${bullets}`;
  });

const areaSummary = [...areas]
  .filter(([, count]) => count > 0)
  .map(([area, count]) => `${area} (${count})`)
  .join(', ');
const stats = `${changedFiles.length} file${changedFiles.length === 1 ? '' : 's'} changed, ${insertions} insertion${insertions === 1 ? '' : 's'}, ${deletions} deletion${deletions === 1 ? '' : 's'}${binaryFiles ? `, ${binaryFiles} binary file${binaryFiles === 1 ? '' : 's'}` : ''}`;

const verificationLabel = titleCase(verificationResult);
const patchPage = `# Patch ${safeDate.toISOString().slice(0, 10)} · ${shortSha}

Published after the project's automated checks completed with status **${verificationLabel}**.

${highlights.length ? `## Highlights\n\n${highlights.map(({ number, title }) => `- [${title}](${serverUrl}/${repository}/pull/${number})`).join('\n')}\n\n` : ''}${
  sections.join('\n\n') || '## Changes\n\n- Repository update.'
}

## Change summary

- **Scope:** ${areaSummary || 'Repository'}
- **Diff:** ${stats}
- **Compare:** [View the complete diff](${compareUrl})
- **Verification:** [${verificationLabel}](${runUrl})

_Generated automatically from the commits included in this push._
`;
writeFileSync(join(wikiPath, `${pageName}.md`), patchPage);

const patchPages = readdirSync(wikiPath)
  .filter((name) => /^Patch-\d{8}T\d{6}Z-[0-9a-f]{7,}\.md$/.test(name))
  .sort()
  .reverse();
const patchIndex = patchPages
  .map((name) => {
    const match = name.match(/^Patch-(\d{4})(\d{2})(\d{2})T\d{6}Z-([0-9a-f]+)\.md$/);
    return `- [${match[1]}-${match[2]}-${match[3]} · ${match[4]}](${basename(name, '.md')})`;
  })
  .join('\n');
writeFileSync(
  join(wikiPath, 'Patch-Notes.md'),
  `# Patch notes\n\nEvery push to \`main\` is recorded here after its automated checks finish, newest first.\n\n${patchIndex}\n`,
);

console.log(`Generated ${pageName}.md from ${commits.length} commit(s).`);
