import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/infrastructure/database/schema.ts',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://monthloom:monthloom@localhost:5432/monthloom_dev',
  },
});
