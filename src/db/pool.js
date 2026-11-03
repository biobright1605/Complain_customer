/**
 * ============================================================
 *  db/pool.js — connection pool ของ MariaDB / MySQL
 *  ใช้ได้ทั้ง server ภายในบริษัท และ Cloud (ตั้ง DB_SSL=true)
 * ============================================================
 */
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  charset: 'utf8mb4',
  timezone: 'Z', // เก็บ/อ่านเวลาเป็น UTC
  dateStrings: ['DATE'], // คอลัมน์ DATE คืนเป็น 'YYYY-MM-DD' (ไม่แปลง timezone)
  waitForConnections: true,
  connectionLimit: 10,
  // Cloud MySQL ส่วนใหญ่บังคับ TLS
  ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
});

/** query สั้น ๆ คืนเฉพาะแถว */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * รันหลายคำสั่งใน transaction เดียว
 * ถ้า callback throw -> rollback อัตโนมัติ
 */
export async function withTransaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** รอจนฐานข้อมูลพร้อม (ใช้ตอนเปิด container ที่ DB ยังบูตไม่เสร็จ) */
export async function waitForDatabase({ retries = 30, delayMs = 2000 } = {}) {
  for (let i = 1; i <= retries; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`[db] รอฐานข้อมูล (${i}/${retries}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('เชื่อมต่อฐานข้อมูลไม่ได้');
}
