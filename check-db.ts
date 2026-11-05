// check-db.ts
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('./electron/database.cjs');

async function check() {
  process.env.NODE_ENV = 'test';
  await db.initDb();
  const info = await db.query('PRAGMA table_info(users)');
  console.log('COLUMNS:', info.map((c: any) => c.name));
}

check().catch(console.error);
