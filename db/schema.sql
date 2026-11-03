-- =============================================================
--  schema.sql — โครงสร้างฐานข้อมูล (MariaDB 10.6+ / MySQL 8+)
--  รันซ้ำได้ (CREATE TABLE IF NOT EXISTS)
--  เวลาเก็บเป็น UTC ทั้งหมด (DATETIME(3))
-- =============================================================

-- ---------- ผู้ใช้ ----------
CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username             VARCHAR(50)  NOT NULL UNIQUE,
  password_hash        VARCHAR(100) NOT NULL,
  name                 VARCHAR(120) NOT NULL,
  email                VARCHAR(160) NOT NULL,
  role                 ENUM('sales','qa','mgr','qmr','admin') NOT NULL,
  position             VARCHAR(80)  NOT NULL DEFAULT '',   -- ตำแหน่ง (สำคัญสำหรับ role mgr)
  active               TINYINT(1)   NOT NULL DEFAULT 1,
  must_change_password TINYINT(1)   NOT NULL DEFAULT 1,    -- บังคับเปลี่ยนรหัสครั้งแรก
  created_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ข้อร้องเรียน ----------
CREATE TABLE IF NOT EXISTS complaints (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  no               VARCHAR(20)  NOT NULL UNIQUE,            -- SC-YYMMDD-NN (YY = พ.ศ.)
  created_at       DATETIME(3)  NOT NULL,
  status           ENUM('new','ack','inv','rev','apr','done','cx') NOT NULL DEFAULT 'new',
  sev              ENUM('urgent','high','normal') NOT NULL DEFAULT 'normal',
  sales_user_id    INT UNSIGNED NOT NULL,

  -- ข้อมูลจากฝ่ายขาย
  customer         VARCHAR(200) NOT NULL,
  contact          VARCHAR(200) NOT NULL DEFAULT '',
  invoice          VARCHAR(80)  NOT NULL DEFAULT '',
  delivery_date    DATE NULL,
  product          VARCHAR(80)  NOT NULL,
  lot              VARCHAR(80)  NOT NULL,
  production_date  DATE NULL,
  pack             VARCHAR(80)  NOT NULL DEFAULT '',
  qty              VARCHAR(30)  NOT NULL,
  unit             VARCHAR(30)  NOT NULL,
  category         VARCHAR(80)  NOT NULL,
  customer_want    VARCHAR(255) NOT NULL DEFAULT '',
  detail           TEXT         NOT NULL,
  mail_sales       VARCHAR(160) NOT NULL DEFAULT '',
  mail_cc          VARCHAR(500) NOT NULL DEFAULT '',

  -- ผลตรวจสอบจาก QA
  cause            TEXT NULL,
  action           TEXT NULL,
  prevent          TEXT NULL,
  owner            VARCHAR(160) NOT NULL DEFAULT '',
  due_date         DATE NULL,
  verify           TEXT NULL,
  manager_position VARCHAR(80)  NOT NULL DEFAULT '',

  -- ทบทวน / อนุมัติ / ยกเลิก (ชื่อบันทึกจากบัญชีที่ login)
  reviewed_by      VARCHAR(200) NULL,
  reviewed_at      DATETIME(3)  NULL,
  review_note      TEXT NULL,
  approved_by      VARCHAR(200) NULL,
  approved_at      DATETIME(3)  NULL,
  approve_note     TEXT NULL,
  cancel_by        VARCHAR(200) NULL,
  cancel_at        DATETIME(3)  NULL,
  cancel_reason    TEXT NULL,

  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX idx_status (status),
  INDEX idx_created (created_at),
  INDEX idx_sales (sales_user_id),
  CONSTRAINT fk_complaint_sales FOREIGN KEY (sales_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ไฟล์แนบ (ตัวไฟล์อยู่บน disk ของ server) ----------
CREATE TABLE IF NOT EXISTS attachments (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id  INT UNSIGNED NOT NULL,
  kind          ENUM('sales','qa') NOT NULL,
  filename      VARCHAR(255) NOT NULL,       -- ชื่อไฟล์เดิม
  path          VARCHAR(500) NOT NULL,       -- path สัมพัทธ์ภายใต้ UPLOAD_DIR
  mime          VARCHAR(100) NOT NULL,
  size_bytes    INT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by   VARCHAR(200) NOT NULL,
  uploaded_at   DATETIME(3)  NOT NULL,
  INDEX idx_att_complaint (complaint_id),
  CONSTRAINT fk_att_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Timeline / Audit log (เพิ่มอย่างเดียว ไม่แก้ไข ไม่ลบ) ----------
CREATE TABLE IF NOT EXISTS complaint_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  complaint_id  INT UNSIGNED NOT NULL,
  at            DATETIME(3)  NOT NULL,
  by_text       VARCHAR(200) NOT NULL,
  text          TEXT         NOT NULL,
  is_mail       TINYINT(1)   NOT NULL DEFAULT 0,
  INDEX idx_log_complaint (complaint_id, at),
  CONSTRAINT fk_log_complaint FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- ค่าตั้งค่าระบบ (key/value) ----------
-- qa_email, qmr_email, mgr_emails (JSON {ตำแหน่ง: อีเมล}), cc_all
CREATE TABLE IF NOT EXISTS settings (
  `key`       VARCHAR(50) PRIMARY KEY,
  `value`     TEXT        NOT NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
