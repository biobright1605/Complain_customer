/**
 * ============================================================
 *  db/migrate.js — สร้างตารางจาก db/schema.sql
 *  ใช้ได้ 2 แบบ:
 *    1) import { migrate } แล้วเรียกตอนเปิดแอป (DB_AUTO_MIGRATE=true)
 *    2) รันตรง: npm run db:migrate
 * ============================================================
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const SCHEMA_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/schema.sql');

/** แยกไฟล์ SQL เป็นทีละคำสั่ง (ตัด comment `--` ออก) */
function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function migrate() {
  const sql = await fs.readFile(SCHEMA_FILE, 'utf8');
  for (const statement of splitStatements(sql)) {
    await pool.query(statement);
  }
  console.log('[db] migrate เสร็จ');
}

// ---------- รันจาก command line ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[db] migrate ล้มเหลว:', err.message);
      process.exit(1);
    });
}
