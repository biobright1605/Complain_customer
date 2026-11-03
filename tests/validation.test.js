/**
 * ============================================================
 *  tests/validation.test.js — ตรวจการ validate ฟอร์มแจ้งเรื่องฝั่ง server
 *  (ไม่ต้องต่อฐานข้อมูล — pool ของ mysql2 ยังไม่เชื่อมต่อจนกว่าจะ query)
 * ============================================================
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { validateNewComplaint } from '../src/services/complaint-service.js';
import { pool } from '../src/db/pool.js';

after(() => pool.end());

const valid = {
  customer: 'บริษัท ทดสอบ จำกัด',
  product: 'น้ำตาลทรายขาว',
  lot: 'L-001',
  qty: '5',
  unit: 'กระสอบ',
  category: 'สิ่งแปลกปลอม',
  sev: 'urgent',
  detail: 'พบสิ่งแปลกปลอม',
  mailSales: 'sales@surinsugar.co.th',
  mailCc: 'a@x.co.th; b@x.co.th',
};

describe('validateNewComplaint', () => {
  test('ข้อมูลครบ -> ผ่าน และจัดรูปแบบ CC', () => {
    const f = validateNewComplaint(valid);
    assert.equal(f.mailCc, 'a@x.co.th, b@x.co.th');
  });

  test('ขาดช่องบังคับ -> แจ้งชื่อช่องภาษาไทย', () => {
    assert.throws(() => validateNewComplaint({ ...valid, customer: ' ', lot: '' }), /ชื่อลูกค้า.*Lot/);
  });

  test('สินค้านอกรายการ -> ไม่ผ่าน', () => {
    assert.throws(() => validateNewComplaint({ ...valid, product: 'น้ำผึ้ง' }), /ชนิดสินค้า/);
  });

  test('อีเมลผิดรูปแบบ -> ไม่ผ่าน', () => {
    assert.throws(() => validateNewComplaint({ ...valid, mailCc: 'not-an-email' }), /รูปแบบอีเมลไม่ถูกต้อง/);
  });

  test('วันที่ผิดรูปแบบ -> ไม่ผ่าน', () => {
    assert.throws(() => validateNewComplaint({ ...valid, deliveryDate: '03/11/2026' }), /วันที่/);
  });
});
