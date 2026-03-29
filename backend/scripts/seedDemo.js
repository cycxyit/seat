import { allAsync, runAsync } from '../db/init.js';
import { v4 as uuidv4 } from 'uuid';

async function seedDemoData() {
  try {
    // 检查是否已有数据
    const existingTheaters = await allAsync('SELECT COUNT(*) as count FROM theaters');
    if (existingTheaters[0]?.count > 0) {
      console.log('✅ Demo data already exists. Skipping seed.');
      return;
    }

    console.log('🌱 Seeding demo data...');

    // 创建示例影厅
    const theaters = [
      { name: '第一影厅', rows: 8, cols: 10 },
      { name: '第二影厅', rows: 6, cols: 8 },
      { name: '第三影厅', rows: 10, cols: 12 }
    ];

    for (const theater of theaters) {
      const theaterId = uuidv4();
      await runAsync(
        'INSERT INTO theaters (id, name, rows, cols) VALUES (?, ?, ?, ?)',
        [theaterId, theater.name, theater.rows, theater.cols]
      );
      console.log(`  ✓ Created theater: ${theater.name}`);
    }

    console.log('✅ Demo data seeded successfully!');
  } catch (err) {
    console.error('❌ Error seeding demo data:', err);
  }
}

// 从命令行执行时调用
if (import.meta.url === `file://${process.argv[1]}`) {
  const { initializeDatabase } = await import('./init.js');
  await initializeDatabase();
  await seedDemoData();
  process.exit(0);
}

export { seedDemoData };
