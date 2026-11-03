/**
 * ============================================================
 *  tailwind.config.js — Design tokens จาก design handoff
 *  แก้สีแบรนด์ / ตัวอักษร ได้ที่นี่ แล้วรัน `npm run build:css`
 * ============================================================
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/**/*.{html,js}', './shared/**/*.js'],
  theme: {
    // จอ < 760px = มือถือ (header บน + bottom nav) ตาม handoff
    screens: { sm: '640px', md: '760px', lg: '1024px', xl: '1280px' },
    extend: {
      colors: {
        // แบรนด์
        brand: {
          DEFAULT: '#D7262E', // primary / active
          dark: '#B01E25', // hover / ลิงก์ / error
          soft: '#FBE8E9', // พื้น active nav / avatar
          ring: '#FBE3E4', // focus ring
          err: '#FBECEC', // พื้นกล่อง error
        },
        // Neutral
        ink: {
          DEFAULT: '#221C1B', // ตัวอักษรหลัก
          2: '#4A4240', // label
          3: '#3B3331', // ตัวอักษรรอง
          muted: '#6E6562',
          faint: '#9C9390', // disabled
        },
        page: '#F6F4F3', // พื้นหลังหน้า
        line: {
          DEFAULT: '#E7E1DE', // เส้นการ์ด
          input: '#DDD5D2',
          soft: '#EFEAE8', // เส้นในการ์ด
          softer: '#F3EFEE',
        },
        sub: '#FAF8F7', // พื้นรอง
        hover: '#FBF7F6',
        info: '#1E5AA0', // จุด timeline อีเมล
        overdue: '#C11F27',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        ctl: '8px',
      },
      boxShadow: {
        pop: '0 8px 24px rgba(34,28,27,.18)',
      },
      maxWidth: {
        content: '1240px',
      },
    },
  },
  plugins: [],
};
