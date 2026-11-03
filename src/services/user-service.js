/**
 * ============================================================
 *  services/user-service.js — login, รหัสผ่าน, จัดการผู้ใช้/สิทธิ์
 *  กฎ:
 *   - รหัสผ่าน hash ด้วย bcrypt
 *   - บัญชีที่ถูกปิด (active=false) login ไม่ได้
 *   - แก้สิทธิ์/ปิดบัญชีของตัวเองไม่ได้
 *   - ผู้ใช้ใหม่/รีเซ็ตรหัส ได้รหัสชั่วคราว และต้องเปลี่ยนเมื่อ login ครั้งแรก
 * ============================================================
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/user-repo.js';
import { ROLES, MANAGER_POSITIONS } from '../../shared/constants.js';
import { isEmail } from '../../shared/workflow.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../utils/http-error.js';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

/** รหัสชั่วคราว 10 ตัว (ตัดตัวที่สับสนง่าย เช่น 0/O, 1/l) */
function temporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(10), (b) => chars[b % chars.length]).join('');
}

/** ตำแหน่งเริ่มต้นตามบทบาท (mgr ต้องเลือกจากรายการ) */
function resolvePosition(role, position) {
  if (role === 'mgr') {
    if (!MANAGER_POSITIONS.includes(position)) throw badRequest('กรุณาเลือกตำแหน่งผู้จัดการ');
    return position;
  }
  return ROLES[role];
}

/* ------------------------------------------------------------
 * Login / รหัสผ่าน
 * ---------------------------------------------------------- */

export async function login(username, password) {
  const row = await userRepo.findByUsername(String(username || '').trim().toLowerCase());
  // ใช้ข้อความเดียวกัน ไม่บอกว่าผิดที่ชื่อหรือรหัส
  if (!row || !(await bcrypt.compare(String(password || ''), row.password_hash))) {
    throw unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
  if (!row.active) throw forbidden('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบหรือ QA');
  return userRepo.toPublicUser(row);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const row = await userRepo.findById(userId);
  if (!row || !(await bcrypt.compare(String(currentPassword || ''), row.password_hash))) {
    throw badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  }
  const next = String(newPassword || '');
  if (next.length < MIN_PASSWORD_LENGTH) throw badRequest(`รหัสผ่านใหม่ต้องยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
  if (next === currentPassword) throw badRequest('รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม');
  await userRepo.setPassword(userId, await hashPassword(next), false);
}

/** โหลดผู้ใช้ปัจจุบันจาก session (ตรวจ active ทุก request) */
export async function currentUser(userId) {
  const row = userId ? await userRepo.findById(userId) : null;
  return row && row.active ? userRepo.toPublicUser(row) : null;
}

/* ------------------------------------------------------------
 * จัดการผู้ใช้ (admin / qa)
 * ---------------------------------------------------------- */

export const listUsers = () => userRepo.listAll();

export async function createUser({ username, name, email, role, position }) {
  const u = String(username || '').trim().toLowerCase();
  const n = String(name || '').trim();
  const e = String(email || '').trim();

  if (!u || !n || !e) throw badRequest('กรุณากรอกชื่อผู้ใช้ ชื่อ-นามสกุล และอีเมล');
  if (!/^[a-z0-9._-]{3,50}$/.test(u)) throw badRequest('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - (3–50 ตัว)');
  if (!isEmail(e)) throw badRequest(`รูปแบบอีเมลไม่ถูกต้อง: ${e}`);
  if (!ROLES[role]) throw badRequest('บทบาทไม่ถูกต้อง');
  if (await userRepo.findByUsername(u)) throw conflict(`ชื่อผู้ใช้ ${u} มีอยู่แล้ว`);

  const tempPassword = temporaryPassword();
  const id = await userRepo.create({
    username: u,
    passwordHash: await hashPassword(tempPassword),
    name: n,
    email: e,
    role,
    position: resolvePosition(role, position),
    mustChangePassword: true,
  });
  return { id, tempPassword };
}

export async function updateUser(actor, targetId, { role, position, active }) {
  if (actor.id === targetId) throw forbidden('แก้ไขสิทธิ์บัญชีของตัวเองไม่ได้');
  const target = await userRepo.findById(targetId);
  if (!target) throw notFound('ไม่พบผู้ใช้');

  const fields = {};
  if (role !== undefined) {
    if (!ROLES[role]) throw badRequest('บทบาทไม่ถูกต้อง');
    fields.role = role;
    fields.position = resolvePosition(role, position ?? target.position);
  } else if (position !== undefined && target.role === 'mgr') {
    fields.position = resolvePosition('mgr', position);
  }
  if (active !== undefined) fields.active = !!active;

  await userRepo.update(targetId, fields);
}

export async function resetPassword(actor, targetId) {
  if (actor.id === targetId) throw forbidden('ใช้เมนูเปลี่ยนรหัสผ่านสำหรับบัญชีของตัวเอง');
  if (!(await userRepo.findById(targetId))) throw notFound('ไม่พบผู้ใช้');
  const tempPassword = temporaryPassword();
  await userRepo.setPassword(targetId, await hashPassword(tempPassword), true);
  return { tempPassword };
}
