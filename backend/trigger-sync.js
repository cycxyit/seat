import { syncDatabaseFromSheet } from './src/services/dbSyncService.js';
import { initializeDatabase } from './src/db/init.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

async function run() {
  try {
    console.log('🔄 Initializing database for sync...');
    await initializeDatabase();
    console.log('🔄 Triggering manual sync from Google Sheets...');
    const status = await syncDatabaseFromSheet();
    console.log('✅ Sync completed:', status.message);
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

run();
