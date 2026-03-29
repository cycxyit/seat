import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeDatabase, allAsync } from './db/init.js';
import theatersRoutes from './routes/theaters.js';
import bookingsRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import { validateUserCode } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
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
app.use('/api/bookings', validateUserCode, bookingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

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

app.listen(PORT, () => {
  console.log(`🎬 Booking Server running at http://localhost:${PORT}`);
  console.log(`📝 Frontend URL: ${FRONTEND_URL}`);
});
