/**
 * ============================================================
 *  config/env.js — อ่านค่าตั้งค่าจากไฟล์ .env ไว้ที่เดียว
 *  ส่วนอื่นของระบบให้ import `config` จากไฟล์นี้ (ห้ามอ่าน process.env ตรง ๆ)
 * ============================================================
 */
import 'dotenv/config';
import path from 'node:path';

/** แปลงข้อความเป็น boolean ('true' / '1' / 'yes') */
const bool = (value, fallback = false) =>
  value === undefined || value === '' ? fallback : ['true', '1', 'yes'].includes(String(value).toLowerCase());

/** แปลงข้อความเป็นตัวเลข */
const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const env = process.env;

export const config = Object.freeze({
  // ---------- แอป ----------
  isProduction: env.NODE_ENV === 'production',
  port: int(env.PORT, 3000),
  baseUrl: (env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),

  // ---------- session ----------
  session: {
    secret: env.SESSION_SECRET || 'dev-only-secret',
    cookieSecure: bool(env.COOKIE_SECURE),
    maxAgeMs: int(env.SESSION_HOURS, 10) * 60 * 60 * 1000,
  },

  // ---------- ฐานข้อมูล (on-prem หรือ cloud ใช้ค่าชุดเดียวกัน) ----------
  db: {
    host: env.DB_HOST || 'localhost',
    port: int(env.DB_PORT, 3306),
    database: env.DB_NAME || 'sugar_complaint',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    ssl: bool(env.DB_SSL),
    autoMigrate: bool(env.DB_AUTO_MIGRATE, true),
  },

  // ---------- ข้อมูลเริ่มต้น ----------
  seed: {
    demo: bool(env.SEED_DEMO),
    adminPassword: env.ADMIN_INITIAL_PASSWORD || 'ChangeMe!2026',
  },

  // ---------- ไฟล์แนบ ----------
  upload: {
    dir: path.resolve(env.UPLOAD_DIR || './storage/uploads'),
    maxBytes: int(env.UPLOAD_MAX_MB, 10) * 1024 * 1024,
  },

  // ---------- อีเมล ----------
  mail: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 587),
    secure: bool(env.SMTP_SECURE),
    user: env.SMTP_USER || '',
    password: env.SMTP_PASSWORD || '',
    from: env.MAIL_FROM || 'no-reply@localhost',
  },
});

// ป้องกันการลืมเปลี่ยน secret ใน production
if (config.isProduction && config.session.secret === 'dev-only-secret') {
  console.warn('[config] คำเตือน: ยังไม่ได้ตั้งค่า SESSION_SECRET ใน .env');
}
