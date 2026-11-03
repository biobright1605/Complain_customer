/**
 * ============================================================
 *  middleware/auth.js — ตรวจ session / สิทธิ์ / CSRF
 * ============================================================
 */
import { currentUser } from '../services/user-service.js';
import { asyncHandler, forbidden, unauthorized, HttpError } from '../utils/http-error.js';

/** โหลดผู้ใช้จาก session มาไว้ที่ req.user (ทุก request ของ /api) */
export const loadUser = asyncHandler(async (req, res, next) => {
  req.user = await currentUser(req.session?.userId);
  if (!req.user && req.session?.userId) req.session.userId = null; // บัญชีถูกปิด/ลบ -> ออกจากระบบ
  next();
});

/** ต้อง login และเปลี่ยนรหัสผ่านครั้งแรกแล้ว */
export function requireLogin(req, res, next) {
  if (!req.user) return next(unauthorized());
  if (req.user.mustChangePassword) {
    return next(new HttpError(403, 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', { code: 'PASSWORD_CHANGE_REQUIRED' }));
  }
  next();
}

/** จำกัดบทบาท เช่น requireRole('admin', 'qa') */
export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden());

/**
 * ป้องกัน CSRF แบบง่าย: request ที่แก้ข้อมูลต้องมี header X-Requested-With
 * (ฟอร์มจากเว็บอื่นใส่ header นี้เองไม่ได้ + cookie เป็น SameSite=Lax)
 */
export function requireAjaxHeader(req, res, next) {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (safe || req.get('X-Requested-With') === 'fetch') return next();
  next(forbidden('คำขอไม่ถูกต้อง'));
}
