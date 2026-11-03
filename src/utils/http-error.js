/**
 * ============================================================
 *  utils/http-error.js — error ที่มี HTTP status
 *  throw ใน service ได้เลย แล้ว middleware/error-handler จะแปลงเป็น JSON
 * ============================================================
 */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'กรุณาเข้าสู่ระบบ') => new HttpError(401, msg);
export const forbidden = (msg = 'ไม่มีสิทธิ์ทำรายการนี้') => new HttpError(403, msg);
export const notFound = (msg = 'ไม่พบข้อมูล') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

/** ห่อ async route handler ให้ส่ง error ไป next() อัตโนมัติ */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
