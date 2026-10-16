import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  // drizzle-kit 0.24 does not resolve NodeNext `.js` specifiers back to TypeScript sources.
  // db:generate compiles first and reads the equivalent emitted schema graph.
  schema: './dist/infrastructure/database/schema/index.js',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://monthloom:monthloom@localhost:5432/monthloom_dev',
  },
});
