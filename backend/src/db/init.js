import { createClient } from '@libsql/client';

// The user states they are using Vercel, so local fallback is less relevant, 
// but we provide a default in case it's run locally without env vars just to avoid immediate crash.
const dbUrl = process.env.TURSO_DATABASE_URL || 'libsql://bzb-cycxtit.aws-ap-northeast-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzUwMjUxODEsImlkIjoiMDE5ZDQ3YmQtZmIwMS03Y2IyLWFmYzQtOTJhYTQ2ZjU1OTQ3IiwicmlkIjoiZDVmMDljZjItMzI1Yy00MWFhLWJkODEtZWJkMThiMWU1ZmExIn0.g5GsbyoQe10QmrGWO2bZ-Z8X0MOtPYY1Lmu1Mz6Vgmlhf1Su8lhiuUigex0UVxfhUl4c0faq9o4lntRaLbXfAQ';

let client = null;

export function getDatabase() {
  return client;
}

export async function initializeDatabase() {
  if (!dbUrl) {
    throw new Error('TURSO_DATABASE_URL environment variable is required');
  }
  try {
    client = createClient({
      url: dbUrl,
      authToken: authToken,
    });
    
    console.log('✅ Database connected (Turso/libSQL)');

    await createTheatersTable();
    await createBookingsTable();
    await createConfigTable();
    await migrateSchema();
    await seedDefaultConfig();
    
    console.log('✅ Database schema initialized');
  } catch (err) {
    console.error('❌ Database connection/initialization error:', err);
    throw err;
  }
}

async function createTheatersTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS theaters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rows INTEGER NOT NULL,
      cols INTEGER NOT NULL,
      aisle_after INTEGER DEFAULT 5,
      aisles TEXT DEFAULT '[5]',
      door_row INTEGER DEFAULT 0,
      class_time TEXT,
      subject TEXT,
      teacher TEXT,
      tab_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function createBookingsTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      theater_id TEXT NOT NULL,
      user_code TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      receipt_url TEXT,
      seats TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      submitted_to_sheets BOOLEAN DEFAULT 0,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (theater_id) REFERENCES theaters(id)
    );
  `);
}

async function createConfigTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

async function migrateSchema() {
  const migrations = [
    `ALTER TABLE theaters ADD COLUMN door_row INTEGER DEFAULT 0`,
    `ALTER TABLE theaters ADD COLUMN class_time TEXT`,
    `ALTER TABLE theaters ADD COLUMN tab_name TEXT`,
    `ALTER TABLE bookings ADD COLUMN session_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN student_id TEXT`,
    `ALTER TABLE bookings ADD COLUMN parent_phone TEXT`,
    `ALTER TABLE theaters ADD COLUMN aisles TEXT DEFAULT '[5]'`, // JSON array of aisle positions
  ];
  
  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch (err) {
      if (err.message && !err.message.includes('duplicate column name')) {
        console.warn('Migration warning:', err.message);
      }
    }
  }
}

async function seedDefaultConfig() {
  const defaults = [
    ['max_subjects', '10'],
    ['site_name', '科室座位预订系统'],
    ['logo_url', ''],
    ['footer_text', '© 2025 科室座位预订系统. All rights reserved.'],
  ];
  
  for (const [key, value] of defaults) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`,
      args: [key, value]
    });
  }
}

// ─── 统一封装查询方法，保持向下兼容 ─────────────────────────────

export async function runAsync(sql, params = []) {
  try {
    return await client.execute({ sql, args: params });
  } catch (err) {
    throw err;
  }
}

export async function getAsync(sql, params = []) {
  try {
    const result = await client.execute({ sql, args: params });
    return result.rows[0] || null;
  } catch (err) {
    throw err;
  }
}

export async function allAsync(sql, params = []) {
  try {
    const result = await client.execute({ sql, args: params });
    return result.rows;
  } catch (err) {
    throw err;
  }
}
