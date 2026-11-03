/**
 * ============================================================
 *  tests/workflow.test.js — Unit test กฎธุรกิจ (shared/workflow.js)
 *  รัน: npm test   (ใช้ node:test ในตัว ไม่ต้องติดตั้งเพิ่ม)
 * ============================================================
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS, allowedActions, canDo, canSeeQaResult, canView, complaintNoPrefix, dueAt, isOverdue,
  mailRecipients, matchFilter, matchSearch, missingForReview, nextStatus, tasksFor,
} from '../shared/workflow.js';
import { MANAGER_POSITIONS } from '../shared/constants.js';

// ---------- ข้อมูลทดสอบ ----------
const NOW = new Date(2026, 10, 3, 10, 0).getTime();
const users = {
  sales: { id: 1, role: 'sales', position: 'ฝ่ายขาย' },
  sales2: { id: 2, role: 'sales', position: 'ฝ่ายขาย' },
  qa: { id: 3, role: 'qa', position: 'QA โรงงาน' },
  mgrProd: { id: 4, role: 'mgr', position: MANAGER_POSITIONS[0] },
  mgrWh: { id: 5, role: 'mgr', position: MANAGER_POSITIONS[1] },
  qmr: { id: 6, role: 'qmr', position: 'QMR' },
  admin: { id: 7, role: 'admin', position: 'IT' },
};
const complaint = (over = {}) => ({
  id: 10, no: 'SC-691103-01', status: 'new', sev: 'normal', createdAt: NOW, salesUserId: 1, salesName: 'สมชาย ใจดี',
  customer: 'บริษัท ขนมไทยสยาม จำกัด', product: 'น้ำตาลทรายขาว', lot: 'RW691022-B3', category: 'สิ่งแปลกปลอม',
  managerPosition: MANAGER_POSITIONS[0], mailSales: 'sales@x.co.th', mailCc: '', ...over,
});

/* ------------------------------------------------------------ */
describe('กำหนดตอบ / เกินกำหนด', () => {
  test('urgent=3 วัน, high=7 วัน, normal=14 วัน', () => {
    assert.equal(dueAt(complaint({ sev: 'urgent' })), NOW + 3 * DAY_MS);
    assert.equal(dueAt(complaint({ sev: 'high' })), NOW + 7 * DAY_MS);
    assert.equal(dueAt(complaint({ sev: 'normal' })), NOW + 14 * DAY_MS);
  });

  test('เลยกำหนดและยังไม่ปิด = เกินกำหนด', () => {
    const c = complaint({ sev: 'urgent', createdAt: NOW - 4 * DAY_MS });
    assert.equal(isOverdue(c, NOW), true);
  });

  test('ปิดเรื่องหรือยกเลิกแล้ว ไม่นับเกินกำหนด', () => {
    const old = { sev: 'urgent', createdAt: NOW - 30 * DAY_MS };
    assert.equal(isOverdue(complaint({ ...old, status: 'done' }), NOW), false);
    assert.equal(isOverdue(complaint({ ...old, status: 'cx' }), NOW), false);
  });
});

/* ------------------------------------------------------------ */
describe('สิทธิ์การมองเห็น', () => {
  test('ฝ่ายขายเห็นเฉพาะเรื่องของตัวเอง', () => {
    assert.equal(canView(users.sales, complaint()), true);
    assert.equal(canView(users.sales2, complaint()), false);
    assert.equal(canView(users.qa, complaint()), true);
  });

  test('ฝ่ายขายเห็นผล QA เฉพาะเมื่อปิดเรื่อง', () => {
    assert.equal(canSeeQaResult(users.sales, complaint({ status: 'apr' })), false);
    assert.equal(canSeeQaResult(users.sales, complaint({ status: 'done' })), true);
    assert.equal(canSeeQaResult(users.qmr, complaint({ status: 'inv' })), true);
  });
});

/* ------------------------------------------------------------ */
describe('Workflow actions', () => {
  test('QA รับเรื่องได้เฉพาะสถานะ new', () => {
    assert.equal(canDo(users.qa, complaint({ status: 'new' }), 'ack'), true);
    assert.equal(canDo(users.qa, complaint({ status: 'inv' }), 'ack'), false);
    assert.equal(canDo(users.sales, complaint({ status: 'new' }), 'ack'), false);
  });

  test('ผู้จัดการทบทวนได้เฉพาะเรื่องที่ระบุตำแหน่งตน', () => {
    const c = complaint({ status: 'rev', managerPosition: MANAGER_POSITIONS[0] });
    assert.equal(canDo(users.mgrProd, c, 'review'), true);
    assert.equal(canDo(users.mgrWh, c, 'review'), false);
    assert.equal(canDo(users.mgrWh, c, 'sendBack'), false);
  });

  test('QMR อนุมัติได้เฉพาะสถานะ apr', () => {
    assert.equal(canDo(users.qmr, complaint({ status: 'apr' }), 'approve'), true);
    assert.equal(canDo(users.qmr, complaint({ status: 'rev' }), 'approve'), false);
    assert.equal(canDo(users.admin, complaint({ status: 'apr' }), 'approve'), false);
  });

  test('ฝ่ายขายยกเลิกได้เฉพาะเรื่องของตัวเองที่ยังไม่ปิด', () => {
    assert.equal(canDo(users.sales, complaint({ status: 'inv' }), 'cancel'), true);
    assert.equal(canDo(users.sales, complaint({ status: 'done' }), 'cancel'), false);
    assert.equal(canDo(users.sales2, complaint({ status: 'inv' }), 'cancel'), false);
  });

  test('การเปลี่ยนสถานะ', () => {
    assert.equal(nextStatus(complaint({ status: 'new' }), 'ack'), 'ack');
    assert.equal(nextStatus(complaint({ status: 'ack' }), 'saveQa'), 'inv');
    assert.equal(nextStatus(complaint({ status: 'inv' }), 'submitReview'), 'rev');
    assert.equal(nextStatus(complaint({ status: 'rev' }), 'review'), 'apr');
    assert.equal(nextStatus(complaint({ status: 'rev' }), 'sendBack'), 'inv');
    assert.equal(nextStatus(complaint({ status: 'apr' }), 'approve'), 'done');
    assert.equal(nextStatus(complaint({ status: 'apr' }), 'reject'), 'inv');
    assert.equal(nextStatus(complaint({ status: 'inv' }), 'cancel'), 'cx');
    assert.equal(nextStatus(complaint({ status: 'inv' }), 'note'), 'inv');
  });

  test('QA แก้ผลตรวจสอบไม่ได้หลังส่งทบทวน', () => {
    const actions = allowedActions(users.qa, complaint({ status: 'rev' }));
    assert.ok(!actions.includes('saveQa'));
    assert.ok(!actions.includes('qaFile'));
    assert.ok(actions.includes('note'));
  });
});

/* ------------------------------------------------------------ */
describe('ตรวจข้อมูลก่อนส่งทบทวน', () => {
  test('ขาดข้อมูล -> แจ้งครบทุกช่อง', () => {
    const missing = missingForReview({ managerPosition: '', cause: ' ', action: '', prevent: '' }, 0);
    assert.equal(missing.length, 5);
  });

  test('ครบ + มีหลักฐาน 1 ไฟล์ -> ผ่าน', () => {
    const qa = { managerPosition: MANAGER_POSITIONS[2], cause: 'ก', action: 'ข', prevent: 'ค' };
    assert.deepEqual(missingForReview(qa, 1), []);
  });
});

/* ------------------------------------------------------------ */
describe('ผู้รับอีเมล', () => {
  const settings = {
    qaEmail: 'qa@x.co.th',
    qmrEmail: 'qmr@x.co.th',
    mgrEmails: { [MANAGER_POSITIONS[0]]: 'prod@x.co.th' },
    ccAll: 'boss@x.co.th',
  };

  test('new -> QA + CC รวม', () => {
    assert.deepEqual(mailRecipients('new', complaint(), settings), ['qa@x.co.th', 'boss@x.co.th']);
  });

  test('rev -> ผู้จัดการตามตำแหน่ง', () => {
    assert.ok(mailRecipients('rev', complaint(), settings).includes('prod@x.co.th'));
  });

  test('done -> ฝ่ายขาย + QA + ผู้จัดการ, ตัดอีเมลซ้ำ', () => {
    const c = complaint({ mailCc: 'QA@x.co.th, extra@x.co.th' });
    const to = mailRecipients('done', c, settings);
    assert.deepEqual(to, ['sales@x.co.th', 'qa@x.co.th', 'prod@x.co.th', 'boss@x.co.th', 'extra@x.co.th']);
  });
});

/* ------------------------------------------------------------ */
describe('ค้นหา / filter / งานของฉัน', () => {
  const list = [
    complaint({ id: 1, status: 'new' }),
    complaint({ id: 2, status: 'inv', lot: 'ABC-99' }),
    complaint({ id: 3, status: 'rev', managerPosition: MANAGER_POSITIONS[1] }),
    complaint({ id: 4, status: 'apr', salesUserId: 2 }),
    complaint({ id: 5, status: 'done' }),
  ];

  test('filter prog/wait', () => {
    assert.deepEqual(list.filter((c) => matchFilter(c, 'prog', NOW)).map((c) => c.id), [2]);
    assert.deepEqual(list.filter((c) => matchFilter(c, 'wait', NOW)).map((c) => c.id), [3, 4]);
  });

  test('ค้นหาจาก Lot ไม่สนตัวพิมพ์', () => {
    assert.equal(matchSearch(list[1], 'abc-99'), true);
    assert.equal(matchSearch(list[0], 'abc-99'), false);
  });

  test('งานของฉันตามบทบาท', () => {
    assert.deepEqual(tasksFor(users.qa, list, NOW).map((c) => c.id), [1, 2]);
    assert.deepEqual(tasksFor(users.mgrWh, list, NOW).map((c) => c.id), [3]);
    assert.deepEqual(tasksFor(users.qmr, list, NOW).map((c) => c.id), [4]);
    assert.deepEqual(tasksFor(users.sales, list, NOW).map((c) => c.id), [1, 2, 3]);
  });
});

/* ------------------------------------------------------------ */
test('เลขที่ใช้ปี พ.ศ. 2 หลัก: 3 พ.ย. 2026 -> SC-691103', () => {
  assert.equal(complaintNoPrefix(new Date(2026, 10, 3)), 'SC-691103');
});
