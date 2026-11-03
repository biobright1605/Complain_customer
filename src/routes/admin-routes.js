/**
 * ============================================================
 *  routes/admin-routes.js — หน้าตั้งค่า
 *    GET   /settings/mail          อ่านอีเมลผู้รับแต่ละขั้น   (admin, qa, qmr)
 *    PUT   /settings/mail          บันทึกอีเมลผู้รับ          (admin, qa, qmr)
 *    GET   /users                  รายชื่อผู้ใช้               (admin, qa, qmr)
 *    POST  /users                  เพิ่มผู้ใช้                 (admin, qa)
 *    PATCH /users/:id              เปลี่ยน role/ตำแหน่ง/เปิด-ปิด (admin, qa)
 *    POST  /users/:id/reset-password  รีเซ็ตรหัสผ่าน          (admin, qa)
 * ============================================================
 */
import { Router } from 'express';
import * as settingsRepo from '../repositories/settings-repo.js';
import * as userService from '../services/user-service.js';
import { requireRole } from '../middleware/auth.js';
import { MANAGER_POSITIONS } from '../../shared/constants.js';
import { isEmail, splitEmails } from '../../shared/workflow.js';
import { asyncHandler, badRequest } from '../utils/http-error.js';

const router = Router();
const settingsRoles = requireRole('admin', 'qa', 'qmr');
const userAdminRoles = requireRole('admin', 'qa');

// ---------- อีเมลแจ้งเตือน ----------
router.get(
  '/settings/mail',
  settingsRoles,
  asyncHandler(async (req, res) => {
    res.json(await settingsRepo.getMailSettings());
  }),
);

router.put(
  '/settings/mail',
  settingsRoles,
  asyncHandler(async (req, res) => {
    const clean = (v) => String(v || '').trim();
    const body = {
      qaEmail: clean(req.body.qaEmail),
      qmrEmail: clean(req.body.qmrEmail),
      mgrEmails: Object.fromEntries(MANAGER_POSITIONS.map((p) => [p, clean(req.body.mgrEmails?.[p])])),
      ccAll: splitEmails(req.body.ccAll).join(', '),
    };
    const all = [body.qaEmail, body.qmrEmail, ...Object.values(body.mgrEmails), ...splitEmails(body.ccAll)];
    const bad = all.filter((e) => e && !isEmail(e));
    if (bad.length) throw badRequest(`รูปแบบอีเมลไม่ถูกต้อง: ${bad.join(', ')}`);

    await settingsRepo.saveMailSettings(body);
    res.json({ ok: true, message: 'บันทึกการตั้งค่าอีเมลแล้ว' });
  }),
);

// ---------- ผู้ใช้และสิทธิ์ ----------
router.get(
  '/users',
  settingsRoles,
  asyncHandler(async (req, res) => {
    res.json({ items: await userService.listUsers() });
  }),
);

router.post(
  '/users',
  userAdminRoles,
  asyncHandler(async (req, res) => {
    res.status(201).json(await userService.createUser(req.body));
  }),
);

router.patch(
  '/users/:id',
  userAdminRoles,
  asyncHandler(async (req, res) => {
    await userService.updateUser(req.user, Number(req.params.id), req.body);
    res.json({ ok: true });
  }),
);

router.post(
  '/users/:id/reset-password',
  userAdminRoles,
  asyncHandler(async (req, res) => {
    res.json(await userService.resetPassword(req.user, Number(req.params.id)));
  }),
);

export default router;
