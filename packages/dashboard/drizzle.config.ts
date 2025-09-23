import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '../database/src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})