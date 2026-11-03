/**
 * ============================================================
 *  services/file-storage.js — รับไฟล์อัปโหลดและเก็บบน disk ของ server
 *  โครงสร้าง: UPLOAD_DIR/YYYY/MM/<สุ่ม>.<นามสกุล>
 *  (ฐานข้อมูลเก็บเฉพาะ path สัมพัทธ์ ไม่เก็บ base64)
 * ============================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config/env.js';
import { ALLOWED_MIME } from '../../shared/constants.js';
import { badRequest } from '../utils/http-error.js';

const MAX_FILES_PER_REQUEST = 10;

// ---------- กำหนดที่เก็บไฟล์ ----------
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const now = new Date();
    const sub = path.join(String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    const dir = path.join(config.upload.dir, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

/** middleware สำหรับ route ที่รับไฟล์ในช่อง `files` */
export const uploadFiles = multer({
  storage,
  limits: { fileSize: config.upload.maxBytes, files: MAX_FILES_PER_REQUEST },
  fileFilter(req, file, cb) {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(badRequest(`ไม่รองรับไฟล์ชนิดนี้: ${decodeName(file.originalname)} (รองรับเฉพาะรูปภาพและ PDF)`));
  },
}).array('files', MAX_FILES_PER_REQUEST);

/** multer อ่านชื่อไฟล์ภาษาไทยเป็น latin1 — แปลงกลับเป็น UTF-8 */
export const decodeName = (name) => Buffer.from(name, 'latin1').toString('utf8');

/** แปลงไฟล์จาก multer เป็นข้อมูลสำหรับบันทึกลงตาราง attachments */
export const toAttachmentRecord = (file) => ({
  filename: decodeName(file.originalname).slice(0, 255),
  path: path.relative(config.upload.dir, file.path).split(path.sep).join('/'),
  mime: file.mimetype,
  size: file.size,
});

/** path เต็มของไฟล์ (ป้องกัน path traversal) */
export function absolutePath(relativePath) {
  const full = path.resolve(config.upload.dir, relativePath);
  if (!full.startsWith(config.upload.dir)) throw badRequest('path ไม่ถูกต้อง');
  return full;
}

/** ลบไฟล์ (ใช้ตอนลบไฟล์แนบ หรือ rollback เมื่อบันทึก DB ไม่สำเร็จ) */
export function removeFiles(paths) {
  for (const p of paths) {
    fs.promises.unlink(p).catch(() => {});
  }
}
