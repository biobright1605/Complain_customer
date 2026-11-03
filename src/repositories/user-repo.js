/**
 * ============================================================
 *  repositories/user-repo.js — SQL ของตาราง users
 *  (ไม่มีกฎธุรกิจในไฟล์นี้ — กฎอยู่ใน services/user-service.js)
 * ============================================================
 */
import { query } from '../db/pool.js';

/** แปลงแถวจาก DB เป็น object ที่ส่งให้หน้าเว็บ (ไม่มี password_hash) */
export const toPublicUser = (row) => ({
  id: row.id,
  username: row.username,
  name: row.name,
  email: row.email,
  role: row.role,
  position: row.position,
  active: !!row.active,
  mustChangePassword: !!row.must_change_password,
});

export async function findByUsername(username) {
  const rows = await query('SELECT * FROM users WHERE username = ?', [username]);
  return rows[0] || null;
}

export async function findById(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function listAll() {
  const rows = await query('SELECT * FROM users ORDER BY role, username');
  return rows.map(toPublicUser);
}

export async function countAll() {
  const [row] = await query('SELECT COUNT(*) AS n FROM users');
  return Number(row.n);
}

export async function create({ username, passwordHash, name, email, role, position, mustChangePassword = true }) {
  const result = await query(
    `INSERT INTO users (username, password_hash, name, email, role, position, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [username, passwordHash, name, email, role, position, mustChangePassword ? 1 : 0],
  );
  return result.insertId;
}

/** อัปเดตเฉพาะ field ที่ส่งมา (role, position, active, name, email) */
export async function update(id, fields) {
  const allowed = { role: 'role', position: 'position', active: 'active', name: 'name', email: 'email' };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(key === 'active' ? (fields[key] ? 1 : 0) : fields[key]);
    }
  }
  if (!sets.length) return;
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
}

export async function setPassword(id, passwordHash, mustChangePassword) {
  await query('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?', [
    passwordHash,
    mustChangePassword ? 1 : 0,
    id,
  ]);
}
