/**
 * ============================================================
 *  server.js — จุดเริ่มต้นของโปรแกรม
 *  1) รอฐานข้อมูลพร้อม  2) migrate  3) seed ข้อมูลเริ่มต้น  4) เปิด HTTP port
 * ============================================================
 */
import { config } from './config/env.js';
import { pool, waitForDatabase } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { createApp } from './app.js';

async function main() {
  await waitForDatabase();
  if (config.db.autoMigrate) await migrate();
  await seed();

  const server = createApp().listen(config.port, () => {
    console.log(`[server] พร้อมใช้งานที่ ${config.baseUrl} (port ${config.port})`);
  });

  // ---------- ปิดโปรแกรมอย่างนุ่มนวล (docker stop) ----------
  const shutdown = (signal) => {
    console.log(`[server] ได้รับ ${signal} กำลังปิด...`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] เปิดระบบไม่สำเร็จ:', err);
  process.exit(1);
});
