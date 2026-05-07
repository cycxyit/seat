import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let sheetsClient = null;

export async function initializeSheets() {
  try {
    let key;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } else {
      const keyPath = resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './config/service-key.json');
      key = JSON.parse(readFileSync(keyPath, 'utf8'));
    }
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

function normalizeAisles(aisles) {
  if (Array.isArray(aisles)) {
    return aisles.map(a => parseInt(a, 10)).filter(a => !Number.isNaN(a));
  }
  if (typeof aisles === 'string') {
    try {
      const parsed = JSON.parse(aisles);
      if (Array.isArray(parsed)) {
        return parsed.map(a => parseInt(a, 10)).filter(a => !Number.isNaN(a));
      }
      const num = parseInt(aisles, 10);
      return Number.isNaN(num) ? [5] : [num];
    } catch {
      const num = parseInt(aisles, 10);
      return Number.isNaN(num) ? [5] : [num];
    }
  }
  const num = parseInt(aisles, 10);
  return Number.isNaN(num) ? [5] : [num];
}

function getPhysicalPosition(r, c, aisles) {
  const physicalRow = r * 2 + 2;
  let physicalCol = c + 1;
  const aislePositions = normalizeAisles(aisles);
  for (const aisleNum of aislePositions) {
    if (aisleNum > 0 && c > aisleNum) {
      physicalCol += 1;
    }
  }
  return { physicalRow, physicalCol };
}

function getLogicalPosition(pRowIndex, pColIndex, maxCols, aisles) {
  const physicalRow = pRowIndex + 1;
  if ((physicalRow - 2) % 2 !== 0) return null;
  const r = Math.floor((physicalRow - 2) / 2);
  if (r < 1) return null;

  const physCol = pColIndex + 1;
  if (physCol === 1) return null;

  const aislePositions = normalizeAisles(aisles);
  let c = physCol - 1;

  // If there are multiple aisle columns, shift back for each aisle column before current position
  for (const aisleNum of aislePositions) {
    if (aisleNum > 0 && physCol > aisleNum + 1) {
      c -= 1;
    }
  }

  if (c > maxCols || c < 1) return null;
  return { r, c };
}

// ─── 1. 获取座位占用状况 ──────────────────────────────────────
export async function getSeatMapFromSheet(tabName, maxRow, maxCol, aisleAfter = 5) {
  if (!sheetsClient) return {};
  try {
    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) return {};

    const endColLetter = colToLetter(maxCol + 2); // safety buffer
    const range = `'${tabName}'!A1:${endColLetter}${maxRow * 2 + 5}`;

    const response = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    const seatMap = {};

    for (let rIndex = 0; rIndex < rows.length; rIndex++) {
      const rowData = rows[rIndex];
      for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
        const cellValue = rowData[cIndex];
        if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '') {
          const logical = getLogicalPosition(rIndex, cIndex, maxCol, aisleAfter);
          if (logical) {
            seatMap[`${logical.r}-${logical.c}`] = String(cellValue).trim();
          }
        }
      }
    }
    return seatMap;
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) return {};
    console.error(`❌ Error fetching seat map for [${tabName}]:`, err.message);
    throw err;
  }
}

export async function getSeatsFromSheet(tabName, maxRow, maxCol, aisleAfter = 5) {
  const seatMap = await getSeatMapFromSheet(tabName, maxRow, maxCol, aisleAfter);
  return Object.keys(seatMap);
}

export async function getSeatValueFromSheet(tabName, row, col, aisleAfter = 5) {
  if (!sheetsClient) return '';
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return '';

  const { physicalRow, physicalCol } = getPhysicalPosition(row, col, aisleAfter);
  const cellRef = `${colToLetter(physicalCol)}${physicalRow}`;
  const range = `'${tabName}'!${cellRef}`;

  try {
    const response = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range });
    const value = response.data.values?.[0]?.[0];
    return value ? String(value).trim() : '';
  } catch (err) {
    if (err.message && (err.message.includes('Unable to parse range') || err.message.includes('is not valid'))) {
      return '';
    }
    console.error(`❌ Error fetching seat value for [${tabName} ${cellRef}]:`, err.message);
    throw err;
  }
}

// ─── 2. 更新座位格 ────────────────────────────────────────────
export async function updateSeatInSheet(tabName, row, col, infoString, aisles = [5]) {
  if (!sheetsClient) return false;
  try {
    const spreadsheetId = getSpreadsheetId();
    const { physicalRow, physicalCol } = getPhysicalPosition(row, col, aisles);
    const cellRef = `${colToLetter(physicalCol)}${physicalRow}`;
    console.log(`Updating seat: tabName=${tabName}, row=${row}, col=${col}, aisles=${JSON.stringify(aisles)}, physicalRow=${physicalRow}, physicalCol=${physicalCol}, cellRef=${cellRef}`);
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
export async function appendBookingRecord(bookingData) {
  if (!sheetsClient) return;
  try {
    const spreadsheetId = getSpreadsheetId();
    const recordsTab = process.env.GOOGLE_SHEETS_RECORDS_TAB || '总名单';
    const { session_id, user_code, name, student_id, parent_phone, phone, receipt_url, timestamp, bookings = [] } = bookingData;
    
    const maxSubCols = parseInt(process.env.MAX_SUBJECTS || '10', 10);

    // 确保表头存在且布局一致
    await ensureRecordsTabAndHeader(spreadsheetId, recordsTab, maxSubCols);

    // 构造行数据 (严格按照用户给定的 A-T 规范):
    // A (0): 提交时间
    // B (1): 工号 (user_code)
    // C (2): 姓名 (name)
    // D (3): Student ID (student_id)
    // E (4): Parent's Phone (parent_phone)
    // F (5): 电话 (phone)
    // G (6): 补几科 (bookings.length)
    // H-K (7-10): 科目1 (科目, 老师, 科室, 座位)
    // L-O (11-14): 科目2
    // P-S (15-18): 科目3
    // ... 更多科目
    // 最后: 凭证链接
    const row = new Array(7 + maxSubCols * 4).fill(''); 
    row[0] = timestamp || new Date().toISOString();
    row[1] = user_code || '';
    row[2] = name || '';
    row[3] = student_id || '';
    row[4] = parent_phone || '';
    row[5] = phone || '';
    row[6] = bookings.length;
    
    // 填充科目信息 (H-S)
    for (let i = 0; i < maxSubCols; i++) {
        const startIdx = 7 + (i * 4); // H(7), L(11), P(15)
        if (bookings[i] && startIdx < row.length - 1) {
            row[startIdx] = bookings[i].subject || '';
            row[startIdx + 1] = bookings[i].teacher || '';
            row[startIdx + 2] = bookings[i].theater_name || '';
            row[startIdx + 3] = bookings[i].seatFormatted || '';
        }
    }
    
    row[row.length - 1] = receipt_url || '';

    // --- 查找并更新现有行 (以 工号 UserCode 为唯一基准进行合并) ---
    const fullDataRes = await sheetsClient.spreadsheets.values.get({ spreadsheetId, range: `'${recordsTab}'!B:B` });
    const bColValues = fullDataRes.data.values || [];
    let existingRowIndex = -1;
    
    if (user_code) {
      existingRowIndex = bColValues.findIndex(val => String(val[0]).trim() === String(user_code).trim());
    }

    if (existingRowIndex !== -1) {
      // 覆盖更新
      const range = `'${recordsTab}'!A${existingRowIndex + 1}:${colToLetter(row.length)}${existingRowIndex + 1}`;
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId, range, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] }
      });
      console.log(`✅ Master record updated at row ${existingRowIndex + 1} (User: ${user_code})`);
    } else {
      // 追加新行
      const range = `'${recordsTab}'!A:${colToLetter(row.length)}`;
      await sheetsClient.spreadsheets.values.append({
        spreadsheetId, range, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] }
      });
      console.log(`✅ Master record appended (User: ${user_code})`);
    }
  } catch (err) {
    console.error('❌ Error in master record sync:', err.message);
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
    // A:提交时间, B:工号, C:姓名, D:Student ID, E:Parent's Phone, F:电话, G:补几科
    const header = ['提交时间', '工号', '姓名', 'Student ID', '家长电话', '电话', '补几科'];
    for (let i = 1; i <= subjectCount; i++) {
        header.push(`科目${i}`, `老师${i}`, `科室${i}`, `座位${i}`);
    }
    
    // 确保凭证链接在最后
    header.push('凭证链接');

    // 强力校准：每次同步都检查一次表头，如果不匹配则重写（或至少确保第一次写入是正确的）
    const headerRange = `'${tabName}'!A1:${colToLetter(header.length)}1`;
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: headerRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [header] }
    });
  } catch (err) {
    console.warn('⚠️ Could not ensure Records tab/header:', err.message);
  }
}

// ─── 4. 管理员创建科室时建 Tab 并格式化 ──────────────────────
export async function createTabInSheet(options) {
  if (!sheetsClient) return;
  const { title, theaterName, rows, cols, aisles, doorRow, classTime, subject, teacher } = options;
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
    const aislePositions = Array.isArray(aisles) ? aisles : [aisles || 5];
    const maxPhysCols = cols + aislePositions.length;
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
