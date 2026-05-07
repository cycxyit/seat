import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../db/init.js';
import { validateAdminKey } from '../middleware/auth.js';
import { createTabInSheet } from '../services/sheetsService.js';
import { syncDatabaseFromSheet, getDbSyncStatus } from '../services/dbSyncService.js';

const router = express.Router();

router.use(validateAdminKey);

// ─── 获取全局配置 ───────────────────────────────────────────
router.get('/config', async (req, res) => {
  try {
    const rows = await allAsync('SELECT key, value FROM config');
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch config', message: err.message });
  }
});

// ─── 更新全局配置 ───────────────────────────────────────────
router.put('/config', async (req, res) => {
  try {
    const allowed = ['max_subjects', 'site_name', 'logo_url', 'footer_text'];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid config keys provided' });
    }

    for (const [key, value] of updates) {
      await runAsync(
        `INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, String(value)]
      );
    }

    res.json({ success: true, message: '配置已更新' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update config', message: err.message });
  }
});

// ─── 创建新科室 ─────────────────────────────────────────────
router.post('/theaters', async (req, res) => {
  try {
    const { name, rows, cols, subject, teacher, aisle_after, aisles, class_time, door_row } = req.body;

    if (!name || !rows || !cols) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: '请提供科室名称、行数和列数'
      });
    }

    if (rows < 1 || cols < 1 || rows > 50 || cols > 50) {
      return res.status(400).json({
        error: 'Invalid dimensions',
        message: '行数和列数必须在 1-50 之间'
      });
    }

    const theaterId = uuidv4();
    const finalAisleAfter = aisle_after !== undefined ? parseInt(aisle_after, 10) : 5;
    const finalAisles = aisles ? JSON.stringify(aisles) : JSON.stringify([finalAisleAfter]);
    const finalDoorRow = door_row !== undefined ? parseInt(door_row, 10) : 0;
    const tabName = [class_time, subject, teacher, name].filter(Boolean).join(' ');

    await runAsync(
      `INSERT INTO theaters (id, name, rows, cols, aisle_after, aisles, door_row, class_time, subject, teacher, tab_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [theaterId, name, rows, cols, finalAisleAfter, finalAisles, finalDoorRow, class_time || '', subject || '', teacher || '', tabName]
    );

    try {
      await createTabInSheet({
        title: tabName,
        theaterName: name,
        rows,
        cols,
        aisles: JSON.parse(finalAisles),
        doorRow: finalDoorRow,
        classTime: class_time,
        subject,
        teacher
      });
    } catch (sheetErr) {
      console.warn('⚠️ Failed to create sheet tab automatically:', sheetErr.message);
    }

    res.json({
      success: true,
      message: '科室创建成功！',
      data: { id: theaterId, name, rows, cols, aisle_after: finalAisleAfter, aisles: JSON.parse(finalAisles), door_row: finalDoorRow, class_time, subject, teacher, tab_name: tabName }
    });
  } catch (err) {
    console.error('Error creating theater:', err);
    res.status(500).json({ error: 'Failed to create theater', message: err.message });
  }
});

// ─── 删除科室 ───────────────────────────────────────────────
router.delete('/theaters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const theater = await getAsync('SELECT id FROM theaters WHERE id = ?', [id]);
    if (!theater) {
      return res.status(404).json({ error: 'Theater not found' });
    }
    await runAsync('DELETE FROM bookings WHERE theater_id = ?', [id]);
    await runAsync('DELETE FROM theaters WHERE id = ?', [id]);
    res.json({ success: true, message: '科室删除成功' });
  } catch (err) {
    console.error('Error deleting theater:', err);
    res.status(500).json({ error: 'Failed to delete theater' });
  }
});

// ─── 同步状态查询 ───────────────────────────────────────────
router.get('/sync-status', async (req, res) => {
  try {
    res.json({ success: true, data: getDbSyncStatus() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sync status', message: err.message });
  }
});

// ─── 手动触发一次同步 ───────────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    const status = await syncDatabaseFromSheet();
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', message: err.message });
  }
});

export default router;
