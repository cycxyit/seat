#!/usr/bin/env node

/**
 * API 测试脚本
 * 用法: node test-api.js
 * 
 * 注意：确保后端已启动（npm run dev）
 */

import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const ADMIN_KEY = process.env.ADMIN_SECRET_KEY || 'my-secret-admin-key-2024';

const api = axios.create({
  baseURL: API_URL,
  timeout: 5000
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'blue') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealth() {
  log('🔍 测试健康检查...', 'blue');
  try {
    const res = await api.get('/health');
    log('✅ 健康检查通过', 'green');
    return true;
  } catch (err) {
    log(`❌ 健康检查失败: ${err.message}`, 'red');
    return false;
  }
}

async function testGetTheaters() {
  log('🔍 测试获取影厅列表...', 'blue');
  try {
    const res = await api.get('/theaters');
    if (res.data.success && res.data.data) {
      log(`✅ 获取到 ${res.data.data.length} 个影厅`, 'green');
      res.data.data.forEach(t => {
        log(`   - ${t.name} (${t.rows} 行 × ${t.cols} 列)`, 'yellow');
      });
      return res.data.data;
    }
  } catch (err) {
    log(`❌ 获取影厅失败: ${err.message}`, 'red');
  }
  return [];
}

async function testGetSeats(theaterId) {
  log(`🔍 测试获取影厅座位...`, 'blue');
  try {
    const res = await api.get(`/theaters/${theaterId}/seats`);
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      log(`✅ 获取座位成功 (已预订: ${data.booked_seats.length} 个)`, 'green');
      return data;
    }
  } catch (err) {
    log(`❌ 获取座位失败: ${err.message}`, 'red');
  }
  return null;
}

async function testCreateTheater() {
  log('🔍 测试创建新影厅 (管理员)...', 'blue');
  try {
    const res = await api.post('/admin/theaters', 
      {
        name: '测试影厅',
        rows: 5,
        cols: 8
      },
      {
        headers: { 'X-Admin-Key': ADMIN_KEY }
      }
    );
    if (res.data.success) {
      log(`✅ 创建影厅成功: ${res.data.data.id}`, 'green');
      return res.data.data.id;
    }
  } catch (err) {
    log(`❌ 创建影厅失败: ${err.response?.data?.error || err.message}`, 'red');
  }
  return null;
}

async function testCreateBooking(theaterId) {
  log('🔍 测试创建预订...', 'blue');
  try {
    const res = await api.post('/bookings',
      {
        theater_id: theaterId,
        seats: ['1-1', '1-2'],
        user_code: 'test-user-123'
      },
      {
        headers: { 'X-User-Code': 'test-user-123' }
      }
    );
    if (res.data.success) {
      log(`✅ 创建预订成功: ${res.data.data.booking_id}`, 'green');
      return true;
    }
  } catch (err) {
    log(`❌ 创建预订失败: ${err.response?.data?.message || err.message}`, 'red');
  }
  return false;
}

async function runTests() {
  console.log('\n');
  log('🎬 启动 API 测试...', 'blue');
  log('═══════════════════════════════════════\n', 'blue');

  // 1. 健康检查
  const healthy = await testHealth();
  if (!healthy) {
    log('\n❌ 后端不可用，请确保已启动 (npm run dev)\n', 'red');
    process.exit(1);
  }

  console.log();

  // 2. 获取影厅
  const theaters = await testGetTheaters();
  if (theaters.length === 0) {
    log('\n⚠️  没有影厅数据，请运行: npm run seed:demo\n', 'yellow');
    process.exit(0);
  }

  console.log();

  // 3. 获取座位
  const seats = await testGetSeats(theaters[0].id);

  console.log();

  // 4. 创建新影厅
  const newTheaterId = await testCreateTheater();

  console.log();

  // 5. 如果创建了新影厅，测试创建预订
  if (newTheaterId) {
    await testCreateBooking(newTheaterId);
  } else if (theaters.length > 0) {
    await testCreateBooking(theaters[0].id);
  }

  console.log();
  log('═══════════════════════════════════════', 'blue');
  log('✅ API 测试完成！', 'green');
  console.log('\n');
}

runTests().catch(err => {
  log(`\n❌ 测试出错: ${err.message}`, 'red');
  process.exit(1);
});
