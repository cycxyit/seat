import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let sheetsClient = null;

export async function initializeSheets() {
  try {
    const keyPath = resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './config/service-key.json');
    const key = JSON.parse(readFileSync(keyPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API initialized');
    return sheetsClient;
  } catch (err) {
    console.warn('⚠️ Google Sheets initialization skipped:', err.message);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function colToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID;
}

function getPhysicalPosition(r, c, aisleAfter) {
  const physicalRow = r * 2 + 2;
  let physicalCol = c + 1;
  const aisleThreshold = parseInt(aisleAfter, 10);
  if (aisleThreshold > 0 && c > aisleThreshold) {
    physicalCol += 1;
  }
  return { pRow: physicalRow, pCol: physicalCol };
}

function getLogicalPosition(pRowIndex, pColIndex, maxCols, aisleAfter) {
  const physicalRow = pRowIndex + 1;
  if ((physicalRow - 2) % 2 !== 0) return null;
  const r = Math.floor((physicalRow - 2) / 2);
  if (r < 1) return null;

  const physCol = pColIndex + 1;
  let c;
  if (physCol === 1) return null;

  const aisleThreshold = parseInt(aisleAfter, 10);
  if (aisleThreshold > 0) {
    if (physCol <= aisleThreshold + 1) {
      c = physCol - 1;
    } else if (physCol === aisleThreshold + 2) {
      return null;
    } else {
      c = physCol - 2;
    }
  } else {
    c = physCol - 1;
  }

  if (c > maxCols || c < 1) return null;
  return { r, c };
}

// ─── 1. 获取座位占用状况 ──────────────────────────────────────
export async function getSeatsFromSheet(tabName, maxRow, maxCol, aisleAfter = 5) {
  if (!sheetsClient) return [];
  try {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return [];

    const endColLetter = colToLetter(maxCol + 2); // safety buffer
    const range = `'${tabName}'!A1:${endColLetter}${maxRow * 2 + 5}`;

    const response = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    const occupiedSeats = [];

    for (let rIndex = 0; rIndex < rows.length; rIndex++) {
      const rowData = rows[rIndex];
      for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
        const cellValue = rowData[cIndex];
        if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '') {
          const logical = getLogicalPosition(rIndex, cIndex, maxCol, aisleAfter);
          if (logical) {
            occupiedSeats.push(`${logical.r}-${logical.c}`);
          }
        }
      }
    }
    return occupiedSeats;
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) return [];
    console.error(`❌ Error fetching seats for [${tabName}]:`, err.message);
    throw err;
  }
}

// ─── 2. 更新座位格 ────────────────────────────────────────────
export async function updateSeatInSheet(tabName, row, col, infoString, aisleAfter = 5) {
  if (!sheetsClient) return false;
  try {
    const spreadsheetId = getSpreadsheetId();
    const { pRow, pCol } = getPhysicalPosition(row, col, aisleAfter);
    const cellRef = `${colToLetter(pCol)}${pRow}`;
    const range = `'${tabName}'!${cellRef}`;

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[infoString]] }
    });

    console.log(`✅ Updated cell ${cellRef} in tab '${tabName}'`);
    return true;
  } catch (err) {
    console.error(`❌ Error updating seat for [${tabName}]:`, err.message);
    throw err;
  }
}

// ─── 3. 追加总名单记录（支持多科目）────────────────────────────
// bookingData = { session_id, user_code, name, phone, receipt_url, timestamp,
//                 bookings: [{ subject, teacher, theater_name, seatFormatted }, ...] }
export async function appendBookingRecord(bookingData) {
  if (!sheetsClient) return;
  try {
    const spreadsheetId = getSpreadsheetId();
    const recordsTab = process.env.GOOGLE_SHEETS_RECORDS_TAB || '总名单';

    // Ensure the Records sheet + header exists
    await ensureRecordsTabAndHeader(spreadsheetId, recordsTab, bookingData.bookings?.length || 1);

    const { user_code, name, phone, receipt_url, timestamp, bookings = [] } = bookingData;

    // Build row: Timestamp | 工号 | 姓名 | 电话 | 补几科 | [科目 | 老师 | 科室 | 座位]×N | 凭证链接
    const row = [
      timestamp || new Date().toISOString(),
      user_code || '',
      name || '',
      phone || '',
      bookings.length,
    ];

    for (const b of bookings) {
      row.push(b.subject || '');
      row.push(b.teacher || '');
      row.push(b.theater_name || '');
      row.push(b.seatFormatted || '');
    }

    row.push(receipt_url || '');

    // Append the wider range
    const endCol = colToLetter(5 + bookings.length * 4 + 1);
    const range = `'${recordsTab}'!A:${endCol}`;

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });

    console.log(`✅ Master record appended to '${recordsTab}'`);
  } catch (err) {
    console.error('❌ Error appending master record:', err.message);
  }
}

// ─── Ensure Records tab and header row exist ──────────────────
async function ensureRecordsTabAndHeader(spreadsheetId, tabName, subjectCount) {
  try {
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets.some(s => s.properties.title === tabName);

    if (!exists) {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] }
      });
    }

    // Build header row
    const header = ['提交时间', '工号', '姓名', '电话', '补几科'];
    for (let i = 1; i <= subjectCount; i++) {
      header.push(`科目${i}`, `老师${i}`, `科室${i}`, `座位${i}`);
    }
    header.push('凭证链接');

    // Write header to row 1 only if it's empty
    const checkRange = `'${tabName}'!A1`;
    const checkRes = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range: checkRange });
    const existing = checkRes.data.values?.[0]?.[0];

    if (!existing) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tabName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [header] }
      });
    }
  } catch (err) {
    console.warn('⚠️ Could not ensure Records tab/header:', err.message);
  }
}

// ─── 4. 管理员创建科室时建 Tab 并格式化 ──────────────────────
export async function createTabInSheet(options) {
  if (!sheetsClient) return;
  const { title, theaterName, rows, cols, aisleAfter, doorRow, classTime, subject, teacher } = options;
  try {
    const spreadsheetId = getSpreadsheetId();
    const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const exists = meta.data.sheets.some(s => s.properties.title === title);
    if (exists) {
      console.log(`ℹ️ Sheet tab '${title}' already exists.`);
      return;
    }

    const addSheetResponse = await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] }
    });

    const sheetId = addSheetResponse.data.replies[0].addSheet.properties.sheetId;
    const maxPhysCols = aisleAfter > 0 && aisleAfter < cols ? cols + 1 : cols;
    const endColIndex = maxPhysCols + 1;
    const requests = [];

    // Cell A1: Theater name (yellow bg)
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
        rows: [{
          values: [{
            userEnteredValue: { stringValue: theaterName || 'BLK' },
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 1, blue: 0.8 },
              textFormat: { bold: true, fontSize: 14 },
              horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE'
            }
          }]
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
        mergeType: 'MERGE_ALL'
      }
    });

    // Top title: subject + time + teacher
    const topTitle = `${subject || ''} ${classTime || ''} ${teacher || ''}`.trim() || 'Class Info';
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 3, endColumnIndex: Math.max(endColIndex, 5) },
        rows: [{
          values: [{
            userEnteredValue: { stringValue: topTitle },
            userEnteredFormat: { textFormat: { bold: true, fontSize: 16 }, horizontalAlignment: 'CENTER' }
          }]
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 3, endColumnIndex: Math.max(endColIndex, 5) },
        mergeType: 'MERGE_ALL'
      }
    });

    // Whiteboard at Row 2
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: Math.max(endColIndex - 1, 4) },
        rows: [{
          values: [{
            userEnteredValue: { stringValue: 'Whiteboard / 白板' },
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              borders: {
                top: { style: 'SOLID' }, bottom: { style: 'SOLID' },
                left: { style: 'SOLID' }, right: { style: 'SOLID' }
              }
            }
          }]
        }],
        fields: 'userEnteredValue,userEnteredFormat'
      }
    });
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: Math.max(endColIndex - 1, 4) },
        mergeType: 'MERGE_ALL'
      }
    });

    await sheetsClient.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    await drawGridElements(spreadsheetId, title, rows, cols, rows * 2 + 2, aisleAfter, doorRow, maxPhysCols);

    console.log(`✅ Created and formatted new sheet tab '${title}'`);
  } catch (err) {
    console.error(`❌ Error creating tab in Google Sheets:`, err.message);
  }
}

async function drawGridElements(spreadsheetId, tabName, rows, cols, maxPhysRows, aisleAfter, doorRow, maxPhysCols) {
  const headerArr = [''];
  let colCounter = 1;
  const aisleThreshold = parseInt(aisleAfter, 10);

  for (let c = 1; c <= maxPhysCols; c++) {
    if (aisleThreshold > 0 && c === aisleThreshold + 1) {
      headerArr.push('');
    } else {
      headerArr.push(String.fromCharCode(64 + colCounter));
      colCounter++;
    }
  }

  await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A3:${colToLetter(maxPhysCols + 1)}3`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headerArr] }
  });

  const rowUpdates = [];
  for (let r = 1; r <= rows; r++) {
    const pRow = r * 2 + 2;
    const cellValue = parseInt(doorRow) === r ? `${r} 🚪门口` : `${r}`;
    rowUpdates.push({ range: `'${tabName}'!A${pRow}`, values: [[cellValue]] });
  }

  if (rowUpdates.length > 0) {
    await sheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: rowUpdates }
    });
  }
}
