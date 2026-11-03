/**
 * ============================================================
 *  middleware/error-handler.js — แปลง error ทุกชนิดเป็น JSON
 *  รูปแบบ: { error: "ข้อความภาษาไทย", code?: "..." }
 * ============================================================
 */
import multer from 'multer';
import { config } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // ---------- error จากการอัปโหลดไฟล์ ----------
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `ไฟล์ใหญ่เกิน ${Math.round(config.upload.maxBytes / 1024 / 1024)} MB`
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'แนบไฟล์ได้ครั้งละไม่เกิน 10 ไฟล์'
          : 'อัปโหลดไฟล์ไม่สำเร็จ';
    return res.status(400).json({ error: message });
  }

  // ---------- error ที่ตั้งใจ throw (HttpError) ----------
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  }

  // ---------- error ที่ไม่คาดคิด: log ไว้ ไม่ส่งรายละเอียดให้ผู้ใช้ ----------
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ' });
}
