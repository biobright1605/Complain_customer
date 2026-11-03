/**
 * ============================================================
 *  app.js — ประกอบ Express app (middleware + routes + static files)
 *  แยกจาก server.js เพื่อให้นำไปทดสอบได้โดยไม่ต้องเปิด port
 * ============================================================
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import helmet from 'helmet';
import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { loadUser, requireAjaxHeader, requireLogin } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './routes/auth-routes.js';
import complaintRoutes from './routes/complaint-routes.js';
import adminRoutes from './routes/admin-routes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // รองรับการวางหลัง reverse proxy (nginx / IIS)

  // ---------- ความปลอดภัยพื้นฐาน (HTTP headers) ----------
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'"],
          upgradeInsecureRequests: null, // ใช้ใน LAN แบบ http ได้
        },
      },
    }),
  );

  // ---------- Health check (ใช้กับ Docker / monitoring) ----------
  app.get('/api/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  // ---------- Session (เก็บในฐานข้อมูล รองรับ restart / หลาย instance) ----------
  const MySQLStore = MySQLStoreFactory(session);
  app.use(
    session({
      name: 'srs.sid',
      secret: config.session.secret,
      store: new MySQLStore({ createDatabaseTable: true, clearExpired: true }, pool),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.session.cookieSecure,
        maxAge: config.session.maxAgeMs,
      },
    }),
  );

  // ---------- API ----------
  app.use('/api', express.json({ limit: '1mb' }), requireAjaxHeader, loadUser);
  app.use('/api/auth', authRoutes);
  app.use('/api', requireLogin, complaintRoutes, adminRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));

  // ---------- ไฟล์หน้าเว็บ ----------
  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.use('/vendor/chart.js', express.static(path.join(ROOT, 'node_modules/chart.js/dist')));
  app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html' }));

  app.use(errorHandler);
  return app;
}
