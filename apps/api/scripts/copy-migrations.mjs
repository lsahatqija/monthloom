import { cp, mkdir } from 'node:fs/promises';

const source = new URL('../src/infrastructure/database/migrations/', import.meta.url);
const destination = new URL('../dist/infrastructure/database/migrations/', import.meta.url);

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
