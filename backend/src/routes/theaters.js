import express from 'express';
import { allAsync, getAsync } from '../db/init.js';
import { addClient, removeClient } from '../sseManager.js';

const router = express.Router();

// ─── 获取所有科室 ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const theaters = await allAsync(
      'SELECT id, name, rows, cols, aisle_after, aisles, door_row, class_time, subject, teacher, tab_name FROM theaters ORDER BY subject, class_time ASC'
    );
    // Parse aisles JSON
    const processed = theaters.map(t => ({ ...t, aisles: JSON.parse(t.aisles || '[5]') }));
    res.json({ success: true, data: processed || [], count: processed?.length || 0 });
  } catch (err) {
    console.error('Error fetching theaters:', err);
    res.status(500).json({ error: 'Failed to fetch theaters' });
  }
});

// ─── 获取单个科室信息 ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const theater = await getAsync(
      'SELECT id, name, rows, cols, aisle_after, aisles, door_row, class_time, subject, teacher, tab_name FROM theaters WHERE id = ?',
      [req.params.id]
    );
    if (!theater) return res.status(404).json({ error: 'Theater not found' });
    theater.aisles = JSON.parse(theater.aisles || '[5]');
    res.json({ success: true, data: theater });
  } catch (err) {
    console.error('Error fetching theater:', err);
    res.status(500).json({ error: 'Failed to fetch theater' });
  }
});

// ─── 获取科室座位状态 ────────────────────────────────────────
router.get('/:id/seats', async (req, res) => {
  try {
    const theater = await getAsync(
      'SELECT id, name, rows, cols, aisle_after, aisles, door_row, class_time, subject, teacher, tab_name FROM theaters WHERE id = ?',
      [req.params.id]
    );
    if (!theater) return res.status(404).json({ error: 'Theater not found' });
    theater.aisles = JSON.parse(theater.aisles || '[5]');

    const bookings = await allAsync(
      'SELECT seats FROM bookings WHERE theater_id = ? AND status = ?',
      [theater.id, 'confirmed']
    );

    const bookedSet = new Set();
    for (const row of bookings) {
      try {
        const seats = JSON.parse(row.seats || '[]');
        seats.forEach((seat) => bookedSet.add(seat));
      } catch (_) {}
    }

    const bookedSeats = Array.from(bookedSet);

    res.json({
      success: true,
      data: {
        theater_id: theater.id,
        theater_name: theater.name,
        rows: theater.rows,
        cols: theater.cols,
        aisle_after: theater.aisle_after,
        door_row: theater.door_row,
        class_time: theater.class_time,
        subject: theater.subject,
        teacher: theater.teacher,
        tab_name: theater.tab_name,
        booked_seats: bookedSeats,
        available_seats: generateAvailableSeats(theater.rows, theater.cols, bookedSeats)
      }
    });
  } catch (err) {
    console.error('Error fetching seats:', err);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// ─── SSE: 实时座位更新流 ──────────────────────────────────────
router.get('/:id/stream', async (req, res) => {
  const theaterId = req.params.id;

  // SSE 必需的响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // 注册客户端
  addClient(theaterId, res);

  // 发送心跳（每 25 秒一次，防止代理超时断开）
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { /* ignore */ }
  }, 25000);

  // 客户端断开时清理
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(theaterId, res);
  });
});

// ─── 辅助函数：生成可用座位列表 ──────────────────────────────
function generateAvailableSeats(rows, cols, bookedSeats) {
  const seats = [];
  const bookedSet = new Set(bookedSeats);
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const seatId = `${r}-${c}`;
      if (!bookedSet.has(seatId)) seats.push(seatId);
    }
  }
  return seats;
}

export default router;
