#!/bin/sh
# =============================================================
#  scripts/backup.sh — สำรองฐานข้อมูล + ไฟล์แนบ (สำหรับ docker compose บน Linux)
#  ตั้ง cron ทุกคืน 01:00:
#    0 1 * * * cd /opt/sugar-complaint-app && ./scripts/backup.sh >> backups/backup.log 2>&1
#  เก็บย้อนหลัง KEEP_DAYS วัน (ค่าเริ่มต้น 30)
# =============================================================
set -eu

cd "$(dirname "$0")/.."
. ./.env

KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups"
mkdir -p "$OUT"

# ---------- 1) ฐานข้อมูล ----------
docker compose exec -T db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" \
  --single-transaction --routines "$DB_NAME" | gzip > "$OUT/db-$STAMP.sql.gz"

# ---------- 2) ไฟล์แนบ ----------
docker compose exec -T app tar -czf - -C /app/storage uploads > "$OUT/uploads-$STAMP.tar.gz"

# ---------- 3) ลบไฟล์เก่า ----------
find "$OUT" -name '*.gz' -mtime +"$KEEP_DAYS" -delete

echo "[backup] เสร็จ $STAMP"
