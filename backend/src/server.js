import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 第一步：立即加载环境变量 ---
const envPaths = [
  join(__dirname, '../../.env'),
  join(__dirname, '../.env'),
  join(process.cwd(), '.env')
];

let envPathFound = false;
for (const p of envPaths) {
  const result = dotenv.config({ path: p });
  if (!result.error) {
    console.log(`✅ Loaded .env from: ${p}`);
    envPathFound = true;
    break;
  }
}

import express from 'express';
import cors from 'cors';
import { initializeDatabase, allAsync } from './db/init.js';
import theatersRoutes from './routes/theaters.js';
import bookingsRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import { validateUserCode } from './middleware/auth.js';
import { syncDatabaseFromSheet } from './services/dbSyncService.js';

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

if (!process.env.ADMIN_SECRET_KEY) {
  console.error('❌ CRITICAL WARNING: ADMIN_SECRET_KEY is NOT set!');
}

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // 动态允许任何来源（解决 Vercel 上忘记填 https:// 等格式问题）
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-Admin-Key', 'X-User-Code'],
  optionsSuccessStatus: 200 // 为某些旧浏览器处理 OPTIONS 请求
}));
app.use(express.json());

// 数据库初始化
await initializeDatabase();

// ─── 公开配置接口（无需 admin key）─────────────────────────
app.get('/api/config', async (req, res) => {
  try {
    const rows = await allAsync('SELECT key, value FROM config');
    const config = {};
    for (const row of rows) config[row.key] = row.value;
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// ─── 路由 ────────────────────────────────────────────────────
app.use('/api/theaters', theatersRoutes);
app.use('/api/bookings', bookingsRoutes);
// ─── 调试接口：查看请求头 ──────────────────────────────────────
app.get('/api/admin/debug-headers', (req, res) => {
  res.json({
    receivedHeaders: req.headers,
    expectedKeyPresent: !!process.env.ADMIN_SECRET_KEY,
    expectedKeyLength: process.env.ADMIN_SECRET_KEY ? process.env.ADMIN_SECRET_KEY.length : 0,
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
    __dirname: __dirname
  });
});

app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// 根路径服务
app.get('/', (req, res) => {
  res.json({ message: 'Seat Booking Backend API is running.', status: 'ok' });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString()
  });
});

// 先立即同步一次，然后每 60 秒同步一次（Sheet 为主）
try {
  await syncDatabaseFromSheet();
} catch (e) {
  console.warn('首次同步失败（可忽略，稍后会自动重试）', e.message);
}
setInterval(syncDatabaseFromSheet, 60 * 1000);

app.listen(PORT, () => {
  console.log(`🎬 Booking Server running at http://localhost:${PORT}`);
  console.log(`📝 Frontend URL: ${FRONTEND_URL}`);
});
