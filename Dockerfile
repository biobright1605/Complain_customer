# =============================================================
#  Dockerfile — image ของแอป (multi-stage)
#   stage 1: ติดตั้ง dependency + build Tailwind CSS
#   stage 2: image สำหรับรันจริง (เฉพาะ production dependency)
# =============================================================

# ---------- stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:css

# ---------- stage 2: runtime ----------
FROM node:22-alpine
ENV NODE_ENV=production \
    TZ=Asia/Bangkok \
    UPLOAD_DIR=/app/storage/uploads
RUN apk add --no-cache tzdata
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY shared ./shared
COPY db ./db
COPY --from=build /app/public ./public

# รันด้วย user ที่ไม่ใช่ root + เตรียมโฟลเดอร์ไฟล์แนบ
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
