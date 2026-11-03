/**
 * ============================================================
 *  routes/complaint-routes.js — /api/complaints และ /api/attachments
 *    GET    /complaints                    รายการที่ผู้ใช้เห็นได้
 *    POST   /complaints                    แจ้งเรื่องใหม่ (multipart: fields + files[])
 *    GET    /complaints/export?format=     ส่งออก xlsx | csv (&filter=&q=)
 *    GET    /complaints/:id                รายละเอียด + timeline + actions ที่ทำได้
 *    POST   /complaints/:id/actions/:name  ทำ action ของ workflow
 *    POST   /complaints/:id/files          QA แนบหลักฐาน (multipart files[])
 *    GET    /attachments/:id               เปิด/ดาวน์โหลดไฟล์แนบ
 *    DELETE /attachments/:id               QA ลบหลักฐาน
 * ============================================================
 */
import { Router } from 'express';
import * as service from '../services/complaint-service.js';
import { exportCsv, exportXlsx, exportFileName } from '../services/export-service.js';
import { uploadFiles } from '../services/file-storage.js';
import { asyncHandler, badRequest } from '../utils/http-error.js';

const router = Router();

/** อ่าน :id เป็นตัวเลข */
const idParam = (value) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id) || id <= 0) throw badRequest('รหัสไม่ถูกต้อง');
  return id;
};

// ---------- ข้อร้องเรียน ----------
router.get(
  '/complaints',
  asyncHandler(async (req, res) => {
    res.json({ items: await service.listForUser(req.user) });
  }),
);

router.post(
  '/complaints',
  uploadFiles,
  asyncHandler(async (req, res) => {
    const result = await service.create(req.user, req.body, req.files || []);
    res.status(201).json(result);
  }),
);

router.get(
  '/complaints/export',
  asyncHandler(async (req, res) => {
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
    const filter = { filter: String(req.query.filter || 'all'), q: String(req.query.q || '') };
    const buffer = format === 'csv' ? await exportCsv(req.user, filter) : await exportXlsx(req.user, filter);
    const type =
      format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    res.set('Content-Type', type);
    res.attachment(exportFileName(format));
    res.send(Buffer.from(buffer));
  }),
);

router.get(
  '/complaints/:id',
  asyncHandler(async (req, res) => {
    res.json(await service.getDetail(req.user, idParam(req.params.id)));
  }),
);

router.post(
  '/complaints/:id/actions/:name',
  asyncHandler(async (req, res) => {
    res.json(await service.performAction(req.user, idParam(req.params.id), req.params.name, req.body));
  }),
);

router.post(
  '/complaints/:id/files',
  uploadFiles,
  asyncHandler(async (req, res) => {
    await service.addQaFiles(req.user, idParam(req.params.id), req.files || []);
    res.status(201).json({ ok: true, message: 'แนบหลักฐานแล้ว' });
  }),
);

// ---------- ไฟล์แนบ ----------
router.get(
  '/attachments/:id',
  asyncHandler(async (req, res) => {
    const file = await service.getAttachmentFile(req.user, idParam(req.params.id));
    const disposition = req.query.download ? 'attachment' : 'inline';
    res.set('Content-Type', file.mime);
    res.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
    res.set('Cache-Control', 'private, max-age=3600');
    res.sendFile(file.absolutePath);
  }),
);

router.delete(
  '/attachments/:id',
  asyncHandler(async (req, res) => {
    await service.removeQaFile(req.user, idParam(req.params.id));
    res.json({ ok: true, message: 'ลบไฟล์แล้ว' });
  }),
);

export default router;
