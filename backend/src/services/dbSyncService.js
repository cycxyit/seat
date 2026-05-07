import { allAsync, runAsync } from '../db/init.js';
import { getSeatMapFromSheet } from './sheetsService.js';
import { broadcastToTheater } from '../sseManager.js';

const syncStatus = {
  lastSyncAt: null,
  lastSyncResult: 'never',
  message: '尚未执行同步',
  createdRecords: 0,
  cancelledRecords: 0,
  errors: []
};

export function getDbSyncStatus() {
  return { ...syncStatus };
}

function setSyncStatus(partial) {
  Object.assign(syncStatus, partial);
}

export async function syncDatabaseFromSheet() {
  const startedAt = new Date();
  let createdRecords = 0;
  let cancelledRecords = 0;
  const errors = [];

  try {
    const theaters = await allAsync('SELECT id, tab_name, name, rows, cols, aisle_after, aisles FROM theaters');
    for (const theater of theaters) {
      try {
        const tabName = theater.tab_name || theater.name;
        const aisleConfig = theater.aisles || theater.aisle_after;
        const seatMap = await getSeatMapFromSheet(tabName, theater.rows, theater.cols, aisleConfig);
        const sheetSeats = Object.keys(seatMap);
        const sheetSeatSet = new Set(sheetSeats);

        const bookings = await allAsync('SELECT id, user_code, name, seats, status FROM bookings WHERE theater_id = ?', [theater.id]);
        const seatToBooking = new Map();
        const bookingById = new Map();

        for (const bk of bookings) {
          bookingById.set(bk.id, bk);
          if (bk.status !== 'confirmed') continue;
          let seats = [];
          try { seats = JSON.parse(bk.seats || '[]'); } catch (_) { seats = []; }
          for (const seat of seats) {
            seatToBooking.set(seat, bk);
          }
        }

        for (const seat of sheetSeatSet) {
          if (!seatToBooking.has(seat)) {
            const rawText = seatMap[seat] || '';
            const tokens = rawText.split(' ').filter(Boolean);
            const user_code = tokens[0] || 'sheet-sync';
            const name = tokens.slice(1).join(' ') || 'Sheet 用户';

            await runAsync(`INSERT OR IGNORE INTO bookings (id, theater_id, user_code, name, phone, receipt_url, seats, status, submitted_to_sheets, session_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `${theater.id}-${seat}-${Date.now()}`,
                theater.id,
                user_code,
                name,
                '',
                '',
                JSON.stringify([seat]),
                'confirmed',
                1,
                'sheet-sync'
              ]);
            createdRecords += 1;
            
            // 通知前端：新增预订
            broadcastToTheater(theater.id, {
              type: 'seat_booked',
              theater_id: theater.id,
              seat: seat,
              timestamp: new Date().toISOString()
            });
          }
        }

        for (const [seat, bk] of seatToBooking.entries()) {
          if (!sheetSeatSet.has(seat)) {
            let seats = [];
            try { seats = JSON.parse(bk.seats || '[]'); } catch (_) { seats = []; }
            const remaining = seats.filter((s) => s !== seat);
            if (remaining.length === 0) {
              await runAsync('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', bk.id]);
              cancelledRecords += 1;
            } else {
              await runAsync('UPDATE bookings SET seats = ? WHERE id = ?', [JSON.stringify(remaining), bk.id]);
            }
            
            // 通知前端：释放座位
            broadcastToTheater(theater.id, {
              type: 'seat_cancelled',
              theater_id: theater.id,
              seat: seat,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (theaterErr) {
        errors.push(`同步科室 ${theater.name} 失败：${theaterErr.message}`);
      }
    }

    setSyncStatus({
      lastSyncAt: startedAt.toISOString(),
      lastSyncResult: 'success',
      message: `同步成功：新增 ${createdRecords} 条，取消 ${cancelledRecords} 条`,
      createdRecords,
      cancelledRecords,
      errors
    });

    console.log(`✅ Sheet->DB 同步完成 (${startedAt.toLocaleTimeString()})`, syncStatus.message);
  } catch (err) {
    errors.push(err.message);
    setSyncStatus({
      lastSyncAt: startedAt.toISOString(),
      lastSyncResult: 'failure',
      message: `同步失败：${err.message}`,
      errors
    });
    console.error('❌ 同步失败', err);
    throw err;
  }

  return getDbSyncStatus();
}
