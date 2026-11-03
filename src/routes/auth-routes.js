/**
 * ============================================================
 *  routes/auth-routes.js — /api/auth
 *    POST /login            เข้าสู่ระบบ
 *    POST /logout           ออกจากระบบ
 *    GET  /me               ผู้ใช้ปัจจุบัน
 *    POST /change-password  เปลี่ยนรหัสผ่าน (รวมครั้งแรก)
 * ============================================================
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as userService from '../services/user-service.js';
import { asyncHandler, unauthorized } from '../utils/http-error.js';

const router = Router();

// จำกัดการลอง login: 20 ครั้ง / 15 นาที / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาที' },
});

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const user = await userService.login(req.body.username, req.body.password);
    // สร้าง session ใหม่ ป้องกัน session fixation
    await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.userId = user.id;
    res.json({ user });
  }),
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('srs.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

router.post(
  '/change-password',
  asyncHandler(async (req, res) => {
    if (!req.user) throw unauthorized();
    await userService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true, message: 'เปลี่ยนรหัสผ่านแล้ว' });
  }),
);

export default router;
