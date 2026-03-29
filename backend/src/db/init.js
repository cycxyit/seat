import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = join(__dirname, '../../data');
const DB_PATH = process.env.DATABASE_PATH || join(DB_DIR, 'cinema.db');

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

let db = null;

export function getDatabase() {
  return db;
}

export async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, async (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }
      console.log('✅ Database connected');

      db.run('PRAGMA foreign_keys = ON', async (err) => {
        if (err) { reject(err); return; }
        try {
          await createTheatersTable();
          await createBookingsTable();
          await createConfigTable();
          await migrateSchema();
          await seedDefaultConfig();
          console.log('✅ Database schema initialized');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

function createTheatersTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS theaters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rows INTEGER NOT NULL,
        cols INTEGER NOT NULL,
        aisle_after INTEGER DEFAULT 5,
        door_row INTEGER DEFAULT 0,
        class_time TEXT,
        subject TEXT,
        teacher TEXT,
        tab_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `, (err) => { if (err) reject(err); else resolve(); });
  });
}

function createBookingsTable() {
  return new Promise((resolve, reject) => {
    db.run(`
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
    `, (err) => { if (err) reject(err); else resolve(); });
  });
}

function createConfigTable() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `, (err) => { if (err) reject(err); else resolve(); });
  });
}

function migrateSchema() {
  const migrations = [
    `ALTER TABLE theaters ADD COLUMN door_row INTEGER DEFAULT 0`,
    `ALTER TABLE theaters ADD COLUMN class_time TEXT`,
    `ALTER TABLE theaters ADD COLUMN tab_name TEXT`,
    `ALTER TABLE bookings ADD COLUMN session_id TEXT`,
  ];
  return migrations.reduce((chain, sql) => {
    return chain.then(() => new Promise((resolve) => {
      db.run(sql, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.warn('Migration warning:', err.message);
        }
        resolve();
      });
    }));
  }, Promise.resolve());
}

function seedDefaultConfig() {
  const defaults = [
    ['max_subjects', '3'],
    ['site_name', '科室座位预订系统'],
    ['logo_url', ''],
    ['footer_text', '© 2025 科室座位预订系统. All rights reserved.'],
  ];
  return defaults.reduce((chain, [key, value]) => {
    return chain.then(() => new Promise((resolve) => {
      db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, [key, value], () => resolve());
    }));
  }, Promise.resolve());
}

export function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

export function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

export function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}
