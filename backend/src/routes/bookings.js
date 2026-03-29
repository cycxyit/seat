import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAsync, runAsync, allAsync } from '../db/init.js';
import { getSeatsFromSheet, updateSeatInSheet, appendBookingRecord, initializeSheets } from '../services/sheetsService.js';
import { broadcastToTheater } from '../sseManager.js';

const router = express.Router();

await initializeSheets();

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

// ─── POST /bookings/multi — 多科目批量预订 ──────────────────
// Body: { bookings: [{theater_id, seat},...], name, phone, receipt_url, session_id }
router.post('/multi', async (req, res) => {
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
      if (!theater_id || !seat) {
        failedBookings.push({ theater_id, seat, reason: '参数无效' });
        continue;
      }

      try {
        const [rowRaw, colRaw] = String(seat).split('-');
        const row = parseInt(rowRaw, 10);
        const col = parseInt(colRaw, 10);

        const theater = await getAsync(
          'SELECT id, name, rows, cols, aisle_after, door_row, class_time, subject, teacher, tab_name FROM theaters WHERE id = ?',
          [theater_id]
        );

        if (!theater) {
          failedBookings.push({ theater_id, seat, reason: '科室不存在' });
          continue;
        }

        const tabName = theater.tab_name || theater.name;
        const occupiedSeats = await getSeatsFromSheet(tabName, theater.rows, theater.cols, theater.aisle_after);

        if (occupiedSeats.includes(seat)) {
          failedBookings.push({ theater_id, seat, reason: `${formatSeatId(seat)} 已被抢先预订，请重选` });
          continue;
        }

        const bookingId = uuidv4();
        await runAsync(
          `INSERT INTO bookings (id, theater_id, user_code, name, phone, receipt_url, seats, status, session_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [bookingId, theater_id, userCode, name, phone, receipt_url || '', JSON.stringify([seat]), 'confirmed', sessionId]
        );

        // Update classroom tab
        try {
          await updateSeatInSheet(tabName, row, col, `${userCode} ${name}`, theater.aisle_after);
        } catch (se) {
          console.warn(`⚠️ Sheet update failed for booking ${bookingId}:`, se.message);
        }

        // Broadcast SSE to all viewers of this theater
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
      } catch (innerErr) {
        console.error(`Error processing booking for theater ${theater_id}:`, innerErr);
        failedBookings.push({ theater_id, seat, reason: innerErr.message });
      }
    }

    // Append one master record row with ALL confirmed subjects
    if (confirmedBookings.length > 0) {
      try {
        await appendBookingRecord({
          session_id: sessionId,
          user_code: userCode,
          name,
          phone,
          receipt_url,
          timestamp: new Date().toISOString(),
          bookings: confirmedBookings.map(b => ({
            subject: b.subject,
            teacher: b.teacher,
            theater_name: b.theater_name,
            seatFormatted: b.seat_formatted
          }))
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
router.post('/', async (req, res) => {
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
    const occupiedSeats = await getSeatsFromSheet(tabName, theater.rows, theater.cols, theater.aisle_after);
    if (occupiedSeats.includes(selectedSeat)) {
      return res.status(409).json({ error: 'Seat occupied', message: '该座位已被抢先预订，请重新选择' });
    }

    const bookingId = uuidv4();
    await runAsync(
      `INSERT INTO bookings (id, theater_id, user_code, name, phone, receipt_url, seats, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, theater_id, userCode, name, phone, receipt_url || '', JSON.stringify(seats), 'confirmed']
    );

    try {
      await updateSeatInSheet(tabName, row, col, `${userCode} ${name}`, theater.aisle_after);
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
      console.error('⚠️ Failed to sync with Google Sheets:', sheetsErr.message);
    }

    broadcastToTheater(theater_id, { type: 'seat_booked', theater_id, seat: selectedSeat, timestamp: new Date().toISOString() });

    res.json({
      success: true,
      message: '选座提交成功！',
      data: { booking_id: bookingId, theater_name: theater.name, seat: selectedSeat, name, user_code: userCode, timestamp: new Date().toISOString() }
    });
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
