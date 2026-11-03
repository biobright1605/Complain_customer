# Agent 5 — DevOps Engineer : คู่มือติดตั้งและดูแลระบบ

## 1. สิ่งที่ต้องมีบน server
- Docker Engine + Docker Compose v2 (Linux) หรือ Docker Desktop (Windows Server)
- เปิด port 3000 (หรือ port ที่ตั้งใน `.env`) ให้เครื่องในบริษัทเข้าถึงได้

## 2. ติดตั้งแบบ server ภายในบริษัท (แนะนำ)
```bash
# 1) คัดลอกโฟลเดอร์ sugar-complaint-app ไปที่ server เช่น /opt/sugar-complaint-app
cd /opt/sugar-complaint-app

# 2) สร้างไฟล์ตั้งค่า แล้วแก้: SESSION_SECRET, DB_PASSWORD, DB_ROOT_PASSWORD,
#    APP_BASE_URL, ADMIN_INITIAL_PASSWORD, SMTP_*  (SEED_DEMO=false สำหรับใช้งานจริง)
cp .env.example .env

# 3) build + เปิดระบบ
docker compose up -d --build

# 4) ตรวจสถานะ
curl http://localhost:3000/api/health      # {"ok":true,"db":"up"}
docker compose logs -f app
```
เข้าระบบครั้งแรกด้วย `admin` / ค่า `ADMIN_INITIAL_PASSWORD` → ระบบบังคับเปลี่ยนรหัส → ไปที่ **ตั้งค่า** เพื่อตั้งอีเมลแจ้งเตือนและเพิ่มผู้ใช้

## 3. ติดตั้งแบบ Cloud database
ใช้ Azure Database for MySQL / AWS RDS / Google Cloud SQL (MySQL 8)
1. สร้างฐานข้อมูล `sugar_complaint` + user ที่มีสิทธิ์ CREATE/ALTER/SELECT/INSERT/UPDATE/DELETE
2. อนุญาต IP ของ server ที่รันแอปใน firewall ของ cloud
3. ใน `.env`: `DB_HOST=<host ของ cloud>`, `DB_SSL=true`, `DB_USER`, `DB_PASSWORD`
4. `docker compose -f docker-compose.cloud.yml up -d --build`

> ไฟล์แนบยังเก็บบน disk ของ server ที่รันแอป (volume `uploads`) — ต้อง backup ด้วย

## 4. เชื่อมจากเว็บบริษัท
เพิ่มลิงก์ในหน้า `http://192.168.20.254/surinsugar/index.php`:
```html
<a href="http://192.168.20.254:3000" target="_blank">ระบบข้อร้องเรียนสินค้า</a>
```
ถ้าต้องการ URL แบบ path เดียวกับเว็บเดิม ให้ตั้ง reverse proxy (Apache/nginx/IIS) ส่งต่อไปที่ port 3000
และตั้ง `APP_BASE_URL` ให้ตรงกับ URL ที่ผู้ใช้เปิด

## 5. HTTPS (แนะนำ)
วาง nginx / IIS เป็น reverse proxy พร้อมใบรับรองของบริษัท แล้วตั้ง `COOKIE_SECURE=true`

## 6. Backup / Restore
| OS | คำสั่ง | ตั้งเวลา |
|---|---|---|
| Linux | `./scripts/backup.sh` | cron `0 1 * * *` |
| Windows | `scripts\backup.ps1` | Task Scheduler ทุกคืน |

ไฟล์ backup อยู่ใน `backups/` (เก็บ 30 วัน) — **ควรคัดลอกออกไปเก็บนอก server ด้วย**

Restore ฐานข้อมูล:
```bash
gunzip -c backups/db-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db mariadb -u root -p"$DB_ROOT_PASSWORD" sugar_complaint
```

## 7. อัปเดตเวอร์ชัน
```bash
docker compose up -d --build     # ตารางใหม่จะถูกสร้างอัตโนมัติ (DB_AUTO_MIGRATE=true)
```

## 8. เฝ้าระวัง
- Health check: `GET /api/health` (Docker ตรวจทุก 30 วินาทีอยู่แล้ว)
- พื้นที่ disk: `docker system df` และขนาด volume `uploads`
- Log: `docker compose logs --since 24h app`

## 9. รันบนเครื่อง developer (ไม่ใช้ Docker สำหรับแอป)
```bash
npm install
npm run build:css
# เปิด MariaDB เอง หรือ: docker compose up -d db  (แล้วตั้ง DB_HOST=localhost และเปิด port 3306 ใน compose)
npm run dev
```
