import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function schemaKeys(relativePath, exportName) {
  const source = fs.readFileSync(path.resolve(root, relativePath), 'utf8');
  const shape = source.match(new RegExp(`export const ${exportName} = \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!shape) throw new Error(`Could not find ${exportName} in ${relativePath}`);
  return [...shape.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):/gm)].map((match) => match[1]);
}

const example = fs.readFileSync(path.resolve(root, '.env.example'), 'utf8');
const documentedKeys = new Set(
  [...example.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
);
const operationalKeys = [
  // Consumed by the development seed command rather than application startup.
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  'SEED_USER_EMAIL',
  'SEED_USER_PASSWORD',
  // Consumed by Docker Compose rather than application startup.
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
];
const expectedKeys = new Set([
  ...schemaKeys('apps/api/src/config/env.schema.ts', 'apiEnvShape'),
  ...schemaKeys('apps/web/src/lib/config/env.schema.ts', 'webEnvShape'),
  ...operationalKeys,
]);

const missing = [...expectedKeys].filter((key) => !documentedKeys.has(key)).sort();
const unknown = [...documentedKeys].filter((key) => !expectedKeys.has(key)).sort();

if (missing.length || unknown.length) {
  if (missing.length) console.error(`Missing from .env.example: ${missing.join(', ')}`);
  if (unknown.length) console.error(`Not present in a runtime schema: ${unknown.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`.env.example matches ${expectedKeys.size} runtime and operational variables.`);
}
