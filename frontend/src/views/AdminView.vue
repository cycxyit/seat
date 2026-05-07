<template>
  <div class="admin-view">

    <!-- Login -->
    <div v-if="!adminKey" class="login-wrap fadeInUp">
      <div class="form-card">
        <div class="card-icon">🔒</div>
        <h2>管理员认证</h2>
        <p class="card-desc">请输入管理员密钥以进入后台</p>
        <form @submit.prevent="login">
          <div class="field">
            <label>Admin Key</label>
            <input v-model="inputKey" type="password" placeholder="请输入管理员密钥" required autofocus />
          </div>
          <button type="submit" class="primary btn-full" :disabled="!inputKey.trim() || loading">
            {{ loading ? '验证中...' : '登录管理后台' }}
          </button>
          <div v-if="loginMsg" class="alert" :class="loginMsgType" style="margin-top: 12px; text-align: center;">
            {{ loginMsg }}
          </div>
        </form>
      </div>
    </div>

    <!-- Dashboard -->
    <div v-else class="dashboard fadeInUp">
      <div class="dash-header">
        <div>
          <h2>管理后台</h2>
          <p class="card-desc" style="margin:0">科室座位配置 · 系统设置</p>
        </div>
        <button class="secondary" @click="logout">退出登录</button>
      </div>

      <div class="admin-card sync-card" style="margin-bottom: 24px;">
        <div class="card-section-title">🔄 数据库同步 (Google Sheets → 本地)</div>
        <div class="sync-panel-content">
          <div class="sync-status">
            <div class="sync-info-item">上次同步：<strong>{{ syncStatus.lastSyncAt || '未执行' }}</strong></div>
            <div class="sync-info-item">
              状态：<strong :class="syncStatus.lastSyncResult">{{ syncStatus.lastSyncResult === 'success' ? '已成功' : (syncStatus.lastSyncResult === 'failure' ? '已失败' : '从未执行') }}</strong>
            </div>
            <div class="sync-info-item">数据：新增 <strong>{{ syncStatus.createdRecords }}</strong> 条，失效 <strong>{{ syncStatus.cancelledRecords }}</strong> 条</div>
            <div v-if="syncStatus.message" class="sync-message">{{ syncStatus.message }}</div>
          </div>
          <button class="primary" :disabled="syncing" @click="manualSync" style="margin-top: 16px;">
            <span v-if="syncing" class="btn-loading"><span class="spinner-small"></span> 同步中...</span>
            <span v-else>立即从 Google Sheets 同步最新座位图</span>
          </button>
        </div>
      </div>

      <div class="dash-grid">

        <!-- ── 系统设置 ─────────────────────────────── -->
        <div class="admin-card config-card">
          <div class="card-section-title">⚙️ 系统设置</div>

          <form @submit.prevent="saveConfig" class="config-form">
            <div class="field">
              <label>网站名称</label>
              <input v-model="configForm.site_name" type="text" placeholder="例如：科室座位预订系统" />
            </div>
            <div class="field">
              <label>Logo URL（留空使用默认图标）</label>
              <input v-model="configForm.logo_url" type="url" placeholder="https://example.com/logo.png" />
              <div v-if="configForm.logo_url" class="logo-preview">
                <img :src="configForm.logo_url" alt="logo preview" @error="configForm.logo_url = ''" />
              </div>
            </div>
            <div class="field">
              <label>页脚内容（支持 HTML）</label>
              <textarea v-model="configForm.footer_text" rows="2" placeholder="© 2025 公司名称. All rights reserved."></textarea>
            </div>
            <div class="field">
              <label>最多可补几科（学生可选科目上限）</label>
              <select v-model="configForm.max_subjects">
                <option v-for="n in 10" :key="n" :value="String(n)">最多 {{ n }} 科</option>
              </select>
            </div>
            <button type="submit" class="primary" :disabled="savingConfig">
              {{ savingConfig ? '保存中...' : '💾 保存配置' }}
            </button>
            <div v-if="configMsg" class="alert" :class="configMsgType">{{ configMsg }}</div>
          </form>
        </div>

        <!-- ── 新增科室 ─────────────────────────────── -->
        <div class="admin-card">
          <div class="card-section-title">➕ 新增科室</div>

          <form @submit.prevent="createDepartment" class="config-form">
            <div class="field">
              <label>科室名称 / 编号</label>
              <input v-model="newDept.name" type="text" placeholder="例如：204室 / 内科二室" required />
            </div>
            <div class="two-col">
              <div class="field">
                <label>科目 (Subject)</label>
                <input v-model="newDept.subject" type="text" placeholder="例如：高级数学" required />
              </div>
              <div class="field">
                <label>老师 (Teacher)</label>
                <input v-model="newDept.teacher" type="text" placeholder="例如：张老师" required />
              </div>
            </div>
            <div class="field">
              <label>上课时间 (Class Time)</label>
              <input v-model="newDept.class_time" type="text" placeholder="例如：周六 8AM" required />
            </div>
            <div class="two-col">
              <div class="field">
                <label>座位排数 (行)</label>
                <input v-model.number="newDept.rows" type="number" min="1" max="50" required />
              </div>
              <div class="field">
                <label>每排座位 (列)</label>
                <input v-model.number="newDept.cols" type="number" min="1" max="50" required />
              </div>
            </div>
            <div class="two-col">
              <div class="field">
                <label>过道 (列后添加)</label>
                <input v-model.number="newDept.aisle_after" type="number" min="0" max="50" placeholder="0=无过道" required />
              </div>
              <div class="field">
                <label>🚪 门口 (第几排)</label>
                <input v-model.number="newDept.door_row" type="number" min="0" max="50" placeholder="0=无门口" required />
              </div>
            </div>
            <button type="submit" class="primary" :disabled="isCreating">
              {{ isCreating ? '创建中...' : '确认新增' }}
            </button>
            <div v-if="createMsg" class="alert" :class="createMsgType">{{ createMsg }}</div>
          </form>
        </div>

        <!-- ── 科室列表 ─────────────────────────────── -->
        <div class="admin-card list-card">
          <div class="card-section-title">📋 现有科室列表</div>

          <div v-if="loading" class="loading-spinner"><div class="spinner"></div> 加载中...</div>
          <div v-else-if="departments.length === 0" class="empty-state">
            🏗️ 暂无配置科室，请先新增
          </div>
          <div v-else class="dept-list">
            <!-- Group by subject -->
            <div v-for="(group, subject) in groupedDepts" :key="subject" class="dept-group">
              <div class="group-title">📖 {{ subject }}</div>
              <div
                v-for="dept in group"
                :key="dept.id"
                class="dept-item"
              >
                <div class="dept-info">
                  <div class="dept-top">
                    <span class="dept-name">{{ dept.name }}</span>
                    <span class="badge badge-time">{{ dept.class_time || '时间未定' }}</span>
                    <span class="badge badge-teacher">{{ dept.teacher }}</span>
                  </div>
                  <div class="dept-meta">
                    {{ dept.rows }}排 × {{ dept.cols }}列 ·
                    过道:{{ dept.aisle_after }} ·
                    门口:排{{ dept.door_row }}
                  </div>
                  <div class="dept-tab">Tab: {{ dept.tab_name }}</div>
                </div>
                <button class="danger btn-sm" @click="deleteDept(dept.id, dept.name)">
                  🗑️ 删除
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { theaterAPI, adminAPI, setAdminKey } from '../services/api.js'

const adminKey  = ref('')
const inputKey  = ref('')
const loading   = ref(false)
const departments = ref([])

const syncStatus = ref({
  lastSyncAt: null,
  lastSyncResult: 'never',
  message: '',
  createdRecords: 0,
  cancelledRecords: 0
})
const syncing = ref(false)

// Config
const configForm = ref({ site_name: '', logo_url: '', footer_text: '', max_subjects: '3' })
const savingConfig = ref(false)
const configMsg    = ref('')
const configMsgType = ref('success')

// Create dept
const isCreating = ref(false)
const createMsg  = ref('')
const createMsgType = ref('success')
const newDept = ref({ name: '', rows: 5, cols: 6, aisle_after: 3, door_row: 0, class_time: '', subject: '', teacher: '' })

// Login msg
const loginMsg = ref('')
const loginMsgType = ref('error')

onMounted(() => {
  const saved = sessionStorage.getItem('adminKey')
  if (saved) {
    adminKey.value = saved
    setAdminKey(saved)
    loadAll()
  }
})

async function login() {
  const key = inputKey.value.trim()
  if (!key) return
  
  loginMsg.value = ''
  setAdminKey(key)
  
  const success = await loadAll(true)
  if (success) {
    sessionStorage.setItem('adminKey', key)
    adminKey.value = key
  } else {
    loginMsg.value = '❌ 管理员密钥错误，请检查后重试'
    setAdminKey('') // 清除错误的 key
  }
}

function logout() {
  sessionStorage.removeItem('adminKey')
  adminKey.value = ''
  setAdminKey('')
  inputKey.value = ''
  departments.value = []
}

async function loadAll(isLogin = false) {
  loading.value = true
  try {
    const [deptRes, cfgRes] = await Promise.all([
      theaterAPI.getTheaters(),
      adminAPI.getConfig()
    ])
    departments.value = deptRes.data.data || []
    if (cfgRes.data.success) {
      configForm.value = { ...configForm.value, ...cfgRes.data.data }
    }

    await loadSyncStatus()
    return true
  } catch (err) {
    console.error('Load error:', err)
    if (isLogin) return false
    
    // 如果是自动加载且遇到 403，说明 session 中的 key 失效了
    if (err.response?.status === 403) {
      logout()
    }
    return false
  } finally {
    loading.value = false
  }
}

async function loadSyncStatus() {
  try {
    const res = await adminAPI.getSyncStatus()
    if (res.data.success) {
      syncStatus.value = res.data.data
    }
  } catch (err) {
    console.warn('获取同步状态失败', err)
  }
}

async function manualSync() {
  syncing.value = true
  try {
    const res = await adminAPI.triggerSync()
    if (res.data.success) {
      syncStatus.value = res.data.data
    }
  } catch (err) {
    syncStatus.value.message = '手动同步出错，请查看控制台' + (err.message ? `：${err.message}` : '')
    console.warn(err)
  } finally {
    syncing.value = false
  }
}


async function saveConfig() {
  savingConfig.value = true
  configMsg.value = ''
  try {
    await adminAPI.updateConfig({ ...configForm.value })
    configMsg.value = '✅ 配置已保存，刷新页面后生效'
    configMsgType.value = 'success'
  } catch (err) {
    configMsg.value = `❌ 保存失败：${err.response?.data?.message || err.message}`
    configMsgType.value = 'error'
  } finally {
    savingConfig.value = false
    setTimeout(() => { configMsg.value = '' }, 4000)
  }
}

async function createDepartment() {
  isCreating.value = true
  createMsg.value = ''
  try {
    await adminAPI.createTheater({ ...newDept.value })
    createMsg.value = `✅ 科室 ${newDept.value.name} 创建成功！`
    createMsgType.value = 'success'
    newDept.value = { name: '', rows: 5, cols: 6, aisle_after: 3, door_row: 0, class_time: '', subject: '', teacher: '' }
    await loadAll()
  } catch (err) {
    createMsg.value = `❌ ${err.response?.data?.message || err.message || '创建失败'}`
    createMsgType.value = 'error'
  } finally {
    isCreating.value = false
    setTimeout(() => { createMsg.value = '' }, 5000)
  }
}

async function deleteDept(id, name) {
  if (!confirm(`警告：删除 "${name}" 会同时删除所有相关预订记录。确认删除？`)) return
  try {
    await adminAPI.deleteTheater(id)
    await loadAll()
  } catch (err) {
    alert(err.response?.data?.message || err.message || '删除失败')
  }
}

const groupedDepts = computed(() => {
  const groups = {}
  for (const dept of departments.value) {
    const key = dept.subject || '未分类'
    if (!groups[key]) groups[key] = []
    groups[key].push(dept)
  }
  return groups
})
</script>

<style scoped>
.admin-view { max-width: 1200px; margin: 0 auto; }

/* Login */
.login-wrap { display: flex; justify-content: center; }

.form-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  padding: 44px 36px;
  max-width: 420px;
  width: 100%;
}

.card-icon { font-size: 36px; text-align: center; margin-bottom: 14px; }

h2 {
  font-size: 24px;
  font-weight: 800;
  text-align: center;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.card-desc {
  color: var(--text-muted);
  font-size: 13.5px;
  text-align: center;
  margin-bottom: 28px;
}

.btn-full { width: 100%; padding: 13px; font-size: 15px; margin-top: 8px; }

/* Dashboard */
.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 28px;
  box-shadow: var(--shadow-sm);
}

.dash-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.list-card { grid-column: 1 / -1; }

@media (max-width: 768px) {
  .dash-grid { grid-template-columns: 1fr; }
  .list-card { grid-column: 1; }
}

.admin-card {
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 28px;
}

.card-section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1.5px solid var(--border);
}

/* Config Form */
.config-form { display: flex; flex-direction: column; gap: 16px; }

.field { display: flex; flex-direction: column; gap: 7px; }
.field label { font-size: 12.5px; font-weight: 600; color: var(--text-secondary); }

textarea { resize: vertical; min-height: 60px; }

.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.logo-preview {
  margin-top: 8px;
  padding: 10px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}
.logo-preview img { max-height: 50px; max-width: 100%; object-fit: contain; }

.alert { margin-top: 4px; }

/* Dept List */
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 15px;
}

.dept-list { display: flex; flex-direction: column; gap: 20px; }

.dept-group {}

.group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--primary-dark);
  background: var(--primary-ultra-light);
  border: 1px solid var(--primary-light);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  margin-bottom: 10px;
  display: inline-block;
}

.dept-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--bg-subtle);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  transition: border-color var(--transition);
}

.dept-item:hover { border-color: var(--primary-light); }

.dept-info { flex: 1; }

.dept-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.dept-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }

.dept-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 3px;
}

.dept-tab {
  font-size: 11px;
  color: #A0AEC0;
  font-family: monospace;
}

.btn-sm { padding: 7px 14px; font-size: 12px; flex-shrink: 0; }

.sync-panel {
  margin-bottom: 16px;
  padding: 12px 14px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sync-status {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, max-content));
  gap: 8px;
  align-items: center;
}

.sync-status strong.success { color: #38a169; }
.sync-status strong.failure { color: #e53e3e; }
.sync-status strong.never { color: #718096; }
</style>
