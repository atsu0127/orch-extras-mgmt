import { defineConfig } from 'drizzle-kit'

// 生成された SQL の適用は wrangler が行うため、drizzle-kit には接続情報を持たせない。
// out は wrangler.jsonc の migrations_dir と同じ場所を指す
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
})
