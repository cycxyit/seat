import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAsync, runAsync, allAsync } from '../db/init.js';
import { getSeatMapFromSheet, updateSeatInSheet, appendBookingRecord, initializeSheets } from '../services/sheetsService.js';
import { broadcastToTheater } from '../sseManager.js';
import { validateUserCode } from '../middleware/auth.js';
import { Mutex } from 'async-mutex';

const router = express.Router();

await initializeSheets();

// ─── 内存锁：防止同一时间的并发冲突 ──────────────────────
const seatLocks = new Map();

function getSeatLock(theater_id, seat) {
  const key = `${theater_id}-${seat}`;
  if (!seatLocks.has(key)) {
    seatLocks.set(key, new Mutex());
  }
  return seatLocks.get(key);
}

// ─── 格式化座位 ID（"2-3" → "C2"）──────────────────────────
function formatSeatId(seatId) {
  if (!seatId) return '';
  const parts = String(seatId).split('-');
  if (parts.length === 2) {
    const r = parseInt(parts[0], 10);
    const c = parseInt(parts[1], 10);
    return `${String.fromCharCode(64 + c)}${r}`;
  }
  return seatId;
}

async function getConfirmedSeatsFromDb(theater_id) {
  const rows = await allAsync('SELECT seats FROM bookings WHERE theater_id = ? AND status = ?', [theater_id, 'confirmed']);
  const seatSet = new Set();
  for (const row of rows) {
    try {
      const seats = JSON.parse(row.seats || '[]');
      seats.forEach((seat) => seatSet.add(seat));
    } catch (_) {
      // skip malformed row
    }
  }
  return Array.from(seatSet);
}

// ─── GET /bookings/check-user/:user_code ───────────────────
router.get('/check-user/:user_code', async (req, res) => {
  try {
    const { user_code } = req.params;
    const booking = await getAsync(
      'SELECT id FROM bookings WHERE user_code = ? AND status = ? LIMIT 1',
      [user_code, 'confirmed']
    );
    res.json({ success: true, exists: !!booking });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check user code', message: err.message });
  }
});

// ─── POST /bookings/multi — 多科目批量预订 ──────────────────
router.post('/multi', validateUserCode, async (req, res) => {
  try {
    const { bookings, name, phone, receipt_url, session_id } = req.body;
    const userCode = req.userCode;

    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      return res.status(400).json({ error: 'Invalid input', message: '请至少提供一个预订' });
    }
    if (!name || !phone) {
      return res.status(400).json({ error: 'Missing personal info', message: '请提供姓名和电话号码' });
    }

    const sessionId = session_id || uuidv4();
    const confirmedBookings = [];
    const failedBookings = [];

    // Process each subject booking independently
    for (const booking of bookings) {
      const { theater_id, seat } = booking;
      try {
        const [rowRaw, colRaw] = String(seat).split('-');
        const row = parseInt(rowRaw, 10);
        const col = parseInt(colRaw, 10);

        const theater = await getAsync(
          'SELECT id, name, rows, cols, aisle_after, door_row, class_time, subject, teacher, tab_name FROM theaters WHERE id = ?',
          [theater_id]
        );

        if (!theater) {
          failedBookings.push({ theater_id, seat, subject: '未知科目', reason: '科室不存在' });
          continue;
        }

        const tabName = theater.tab_name || theater.name;

        // 获取该座位的互斥锁，防止并发执行这段逻辑
        const lock = getSeatLock(theater_id, seat);
        const release = await lock.acquire();

        try {
          // --- 【核心修复】：解决死锁问题 ---
          // 1. 检查数据库中是否已经存在该用户对该座位的“已确认”记录
          const existingBooking = await getAsync(
            'SELECT id FROM bookings WHERE theater_id = ? AND user_code = ? AND seats LIKE ? AND status = ?',
            [theater_id, userCode, `%${seat}%`, 'confirmed']
          );

          if (existingBooking) {
            // 如果已经是自己占领的，直接视为成功，以数据库为唯一准则，避免频繁请求 Google Sheet
            confirmedBookings.push({
              booking_id: existingBooking.id,
              theater_id,
              theater_name: theater.name,
              subject: theater.subject,
              teacher: theater.teacher,
              class_time: theater.class_time,
              seat,
              seat_formatted: formatSeatId(seat)
            });
            continue;
          }

          // 2. 如果不是自己的记录，再检查是否被别人占用
          const currentBooked = await getConfirmedSeatsFromDb(theater_id);
          const occupiedSet = new Set(currentBooked);

          if (occupiedSet.has(seat)) {
            failedBookings.push({ 
              theater_id, 
              seat, 
              subject: theater.subject || '未命名科目',
              reason: `Oops! 你手慢了 你选的${theater.subject || '该'}科目座位被占了，请重选` 
            });
            continue;
          }

          // 3. 只有全新的预订才写入 Google Sheet 和数据库
          try {
            await updateSeatInSheet(tabName, row, col, `${userCode} ${name}`, theater.aisle_after);
          } catch (se) {
            failedBookings.push({ 
              theater_id, 
              seat, 
              subject: theater.subject || '未命名科目',
              reason: `${formatSeatId(seat)} Google Sheet 更新失败，请稍后重试` 
            });
            continue;
          }

          const bookingId = uuidv4();
          await runAsync(
            `INSERT INTO bookings (id, theater_id, user_code, name, phone, receipt_url, seats, status, session_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [bookingId, theater_id, userCode, name, phone, receipt_url || '', JSON.stringify([seat]), 'confirmed', sessionId]
          );

          broadcastToTheater(theater_id, {
            type: 'seat_booked',
            theater_id,
            seat,
            timestamp: new Date().toISOString()
          });

          confirmedBookings.push({
            booking_id: bookingId,
            theater_id,
            theater_name: theater.name,
            subject: theater.subject,
            teacher: theater.teacher,
            class_time: theater.class_time,
            seat,
            seat_formatted: formatSeatId(seat)
          });
        } finally {
          // 无论成功还是失败，都释放锁
          release();
        }
      } catch (innerErr) {
        console.error(`Error processing booking for theater ${theater_id}:`, innerErr);
        failedBookings.push({ theater_id, seat, reason: innerErr.message });
      }
    }

    // Append one master record row with ALL confirmed subjects for this session
    if (confirmedBookings.length > 0) {
      try {
        // Fetch ALL confirmed bookings for this USER (including previous successful rounds)
        const sessionBookings = await allAsync(
          `SELECT b.theater_id, t.subject, t.teacher, t.name as theater_name, b.seats
           FROM bookings b JOIN theaters t ON b.theater_id = t.id
           WHERE b.user_code = ? AND b.status = ?`,
          [userCode, 'confirmed']
        );

        const allConfirmedInSession = sessionBookings.map(sb => {
          const seats = JSON.parse(sb.seats || '[]');
          return {
            subject: sb.subject,
            teacher: sb.teacher,
            theater_name: sb.theater_name,
            seatFormatted: formatSeatId(seats[0])
          };
        });

        await appendBookingRecord({
          session_id: sessionId,
          user_code: userCode,
          name,
          phone,
          receipt_url,
          timestamp: new Date().toISOString(),
          bookings: allConfirmedInSession
        });
        // Mark all as synced
        for (const cb of confirmedBookings) {
          await runAsync('UPDATE bookings SET submitted_to_sheets = 1 WHERE id = ?', [cb.booking_id]);
        }
      } catch (sheetErr) {
        console.error('⚠️ Failed to append master record:', sheetErr.message);
      }
    }

    const hasErrors = failedBookings.length > 0;

    res.status(hasErrors && confirmedBookings.length === 0 ? 409 : 200).json({
      success: confirmedBookings.length > 0,
      message: hasErrors
        ? `${confirmedBookings.length} 个预订成功，${failedBookings.length} 个失败`
        : `全部 ${confirmedBookings.length} 个预订成功！`,
      data: {
        session_id: sessionId,
        name,
        confirmed: confirmedBookings,
        failed: failedBookings
      }
    });
  } catch (err) {
    console.error('Error in multi-booking:', err);
    res.status(500).json({ error: 'Failed to process bookings', message: err.message });
  }
});

// ─── POST /bookings — 单科目预订（向后兼容）─────────────────
router.post('/', validateUserCode, async (req, res) => {
  try {
    const { theater_id, seats, name, phone, receipt_url } = req.body;
    const userCode = req.userCode;

    if (!theater_id || !seats || !Array.isArray(seats) || seats.length !== 1) {
      return res.status(400).json({ error: 'Invalid input', message: '请选择且仅选择一个有效的座位' });
    }
    if (!name || !phone) {
      return res.status(400).json({ error: 'Missing personal info', message: '请提供姓名和电话号码' });
    }

    const selectedSeat = seats[0];
    const [rowRaw, colRaw] = selectedSeat.split('-');
    const row = parseInt(rowRaw, 10);
    const col = parseInt(colRaw, 10);

    const theater = await getAsync(
      'SELECT id, name, rows, cols, aisle_after, door_row, class_time, subject, teacher, tab_name FROM theaters WHERE id = ?',
      [theater_id]
    );

    if (!theater) return res.status(404).json({ error: 'Theater not found', message: '科室不存在' });

    const tabName = theater.tab_name || theater.name;

    // 获取单科目的锁
    const lock = getSeatLock(theater_id, selectedSeat);
    const release = await lock.acquire();

    try {
      const currentBooked = await getConfirmedSeatsFromDb(theater_id);
      if (currentBooked.includes(selectedSeat)) {
        return res.status(409).json({ error: 'Seat occupied', message: '该座位已被抢先预订，请重新选择' });
      }

      // Try to write to Google Sheet first（Sheet为主）
      try {
        await updateSeatInSheet(tabName, row, col, `${userCode} ${name}`, theater.aisle_after);
      } catch (sheetsErr) {
        console.error('⚠️ Failed to write seat to Google Sheets:', sheetsErr.message);
        return res.status(502).json({ error: 'SheetWriteFailed', message: 'Google Sheet 写入失败，请稍后重试' });
      }

      const bookingId = uuidv4();
      await runAsync(
        `INSERT INTO bookings (id, theater_id, user_code, name, phone, receipt_url, seats, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingId, theater_id, userCode, name, phone, receipt_url || '', JSON.stringify(seats), 'confirmed']
      );

      try {
        await appendBookingRecord({
          user_code: userCode, name, phone, receipt_url,
          timestamp: new Date().toISOString(),
          bookings: [{
            subject: theater.subject || '未分类科目',
            teacher: theater.teacher || '未知老师',
            theater_name: theater.name,
            seatFormatted: formatSeatId(selectedSeat)
          }]
        });
        await runAsync('UPDATE bookings SET submitted_to_sheets = 1 WHERE id = ?', [bookingId]);
      } catch (sheetsErr) {
        console.error('⚠️ Failed to sync booking record to Google Sheets:', sheetsErr.message);
      }

      broadcastToTheater(theater_id, { type: 'seat_booked', theater_id, seat: selectedSeat, timestamp: new Date().toISOString() });

      res.json({
        success: true,
        message: '选座提交成功！',
        data: { booking_id: bookingId, theater_name: theater.name, seat: selectedSeat, name, user_code: userCode, timestamp: new Date().toISOString() }
      });
    } finally {
      release();
    }
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking', message: err.message });
  }
});

// ─── GET /bookings/user/:user_code ──────────────────────────
router.get('/user/:user_code', async (req, res) => {
  try {
    const { user_code } = req.params;
    const bookings = await allAsync(
      `SELECT b.id, b.theater_id, t.name as theater_name, b.seats, b.created_at, b.name, b.phone, b.receipt_url
       FROM bookings b JOIN theaters t ON b.theater_id = t.id
       WHERE b.user_code = ? AND b.status = ? ORDER BY b.created_at DESC`,
      [user_code, 'confirmed']
    );
    res.json({ success: true, data: bookings?.map(b => ({ ...b, seats: JSON.parse(b.seats) })) || [] });
  } catch (err) {
    console.error('Error fetching user bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

export default router;
