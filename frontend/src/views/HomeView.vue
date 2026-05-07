<template>
  <div class="home-view">

    <!-- ══ STEP 1: Enter ID ══════════════════════════════════════ -->
    <div v-if="currentStep === 1" class="step-wrap fadeInUp">
      <div class="form-card">
        <div class="card-icon">🔖</div>
        <h2>验证身份</h2>
        <p class="card-desc">请输入您的工号/代号以开始选座</p>
        <form @submit.prevent="submitStep1">
          <div class="field">
            <label>工号 / 代号</label>
            <input v-model="userCode" type="text" placeholder="请输入工号或代号" required autofocus />
          </div>
          <div v-if="userCodeNotice" class="alert error mb-16">{{ userCodeNotice }}</div>
          <button type="submit" class="primary btn-full" :disabled="!userCode.trim() || checkingUser">
            <span v-if="checkingUser" class="btn-loading"><span class="spinner-small"></span> 正在校验...</span>
            <span v-else>下一步 →</span>
          </button>
        </form>
      </div>
    </div>

    <!-- ══ STEP 2: Personal Info ═════════════════════════════════ -->
    <div v-else-if="currentStep === 2" class="step-wrap fadeInUp">
      <div class="form-card">
        <div class="card-icon">📋</div>
        <h2>填写个人信息</h2>
        <p class="card-desc">请填写真实信息并上传缴费凭证</p>
        <form @submit.prevent="submitStep2" class="fields-grid">
          <div class="field">
            <label>真实姓名 <span class="req">*</span></label>
            <input v-model="userName" type="text" placeholder="请输入真实姓名" required />
          </div>
          <div class="field">
            <label>Student ID <span class="req">*</span></label>
            <input v-model="studentId" type="text" placeholder="请输入学号" required />
          </div>
          <div class="field">
            <label>家长电话 <span class="req">*</span></label>
            <input v-model="parentPhone" type="tel" placeholder="请输入家长电话" required />
          </div>
          <div class="field">
            <label>手机号码 <span class="req">*</span></label>
            <input v-model="userPhone" type="tel" placeholder="请输入手机号码" required />
          </div>
          <div class="field">
            <label>补几科 <span class="req">*</span></label>
            <select v-model="subjectCount" required>
              <option value="" disabled>请选择补科数量</option>
              <option v-for="n in maxSubjectsOptions" :key="n" :value="n">
                补 {{ n }} 科
              </option>
            </select>
          </div>
          <div class="field full-width">
            <label>缴费截图 / 凭证 <span class="req">*</span></label>
            <div class="file-drop" @click="$refs.fileInput.click()" :class="{ 'has-file': receiptFile }">
              <input ref="fileInput" type="file" @change="onFileChange" accept="image/*" style="display:none" />
              <div v-if="!receiptFile" class="drop-hint">
                <span class="drop-icon">📎</span>
                <span>点击上传图片</span>
              </div>
              <div v-else class="drop-hint file-ready">
                <span class="drop-icon">✅</span>
                <span>{{ receiptFile.name }}</span>
              </div>
            </div>
          </div>
          <div class="form-actions full-width">
            <button type="button" class="secondary" @click="currentStep = 1">← 返回</button>
            <button type="submit" class="primary" :disabled="uploadingReceipt || !subjectCount">
              <span v-if="uploadingReceipt" class="btn-loading"><span class="spinner-small"></span> 上传中...</span>
              <span v-else>下一步 →</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ══ STEP 3: Multi-Subject Selection Loop ══════════════════ -->
    <div v-else-if="currentStep === 3" class="step-wrap fadeInUp">

      <!-- Overall round progress -->
      <div class="round-header">
        <div class="round-title">
          <span class="round-chip">第 {{ currentRound }} 科 / 共 {{ subjectCount }} 科</span>
          <h2>选择科目与座位</h2>
        </div>
        <!-- Already-done bookings summary -->
        <div v-if="completedSelections.length > 0" class="done-summary">
          <div class="done-label">已选完成：</div>
          <div v-for="(sel, i) in completedSelections" :key="i" class="done-item">
            <span class="done-num">{{ i + 1 }}</span>
            <span class="done-subject">{{ sel.theater.subject }}</span>
            <span class="done-seat">{{ formatSeatId(sel.seat) }}</span>
          </div>
        </div>
      </div>

      <!-- Sub-step A: Choose Subject -->
      <div v-if="roundPhase === 'subject'" class="card-panel fadeInUp">
        <h3 class="panel-title">📚 选择科目</h3>
        <p class="panel-desc">请选择本次要补的科目（已完成科目不可重选）</p>
        <div v-if="loadingTheaters" class="loading-spinner">
          <div class="spinner"></div> 加载中...
        </div>
        <div v-else class="subject-grid">
          <button
            v-for="subject in availableSubjects"
            :key="subject"
            type="button"
            class="subject-card"
            :class="{ 'subject-disabled': isSubjectDone(subject) }"
            :disabled="isSubjectDone(subject)"
            @click="selectSubject(subject)"
          >
            <span class="subject-icon">📖</span>
            <span class="subject-name">{{ subject }}</span>
            <span v-if="isSubjectDone(subject)" class="subject-done-badge">已选</span>
            <span class="subject-arrow">→</span>
          </button>
        </div>
        <div class="form-actions mt-20">
          <button class="secondary" @click="goBackFromStep3">← 返回修改信息</button>
        </div>
      </div>

      <!-- Sub-step B: Choose Time Slot (Theater) -->
      <div v-else-if="roundPhase === 'timeslot'" class="card-panel fadeInUp">
        <h3 class="panel-title">🕒 选择时间段 / 科室</h3>
        <p class="panel-desc">
          科目：<strong>{{ currentSubject }}</strong> — 请选择上课时间及所在科室
        </p>
        <div class="timeslot-list">
          <button
            v-for="theater in theatersForCurrentSubject"
            :key="theater.id"
            type="button"
            class="timeslot-card"
            @click="selectTimeslot(theater)"
          >
            <div class="timeslot-main">
              <div class="timeslot-time">{{ theater.class_time || '时间未定' }}</div>
              <div class="timeslot-meta">
                <span class="badge badge-teacher">👨‍🏫 {{ theater.teacher }}</span>
                <span class="badge badge-dept">🏢 {{ theater.name }}</span>
              </div>
            </div>
            <div class="timeslot-arrow">→</div>
          </button>
        </div>
        <div class="form-actions mt-20">
          <button class="secondary" @click="roundPhase = 'subject'">← 重选科目</button>
        </div>
      </div>

      <!-- Sub-step C: Choose Seat -->
      <div v-else-if="roundPhase === 'seat'" class="card-panel fadeInUp">
        <SeatSelection
          :theater="currentTheaterData"
          :booked-seats="currentBookedSeats"
          :total-subjects="subjectCount"
          :current-subject-index="currentRound"
          @confirm="handleSeatConfirm"
        />
        <div v-if="seatError" class="alert error mt-20">{{ seatError }}</div>
        <div class="form-actions mt-20">
          <button class="secondary" @click="roundPhase = 'timeslot'">← 重选时间段</button>
        </div>
      </div>

    </div>

    <!-- ══ STEP 4: Submitting ════════════════════════════════════ -->
    <div v-else-if="currentStep === 4" class="step-wrap fadeInUp">
      <div class="form-card center-content">
        <div class="spinner large-spinner"></div>
        <h3>正在提交预订...</h3>
        <p class="card-desc">请稍候，正在为您锁定座位并同步至 Google Sheets</p>
      </div>
    </div>

    <!-- ══ STEP 5: Success ═══════════════════════════════════════ -->
    <div v-else-if="currentStep === 5" class="step-wrap fadeInUp">
      <div class="success-card">
        <div class="success-icon-wrap">
          <div class="success-icon">🎉</div>
        </div>
        <h2>预订成功！</h2>
        <p class="card-desc">以下是您的座位信息，请妥善保管</p>

        <div class="bookings-summary">
          <div
            v-for="(booking, i) in bookingResult.confirmed"
            :key="booking.booking_id"
            class="booking-row"
          >
            <div class="booking-num">{{ i + 1 }}</div>
            <div class="booking-info">
              <div class="booking-subject">{{ booking.subject }}</div>
              <div class="booking-meta">
                <span class="badge badge-time">{{ booking.class_time }}</span>
                <span class="badge badge-teacher">{{ booking.teacher }}</span>
                <span class="badge badge-dept">{{ booking.theater_name }}</span>
              </div>
            </div>
            <div class="booking-seat">{{ booking.seat_formatted }}</div>
          </div>
        </div>

        <!-- Failed bookings (if any) -->
        <div v-if="bookingResult.failed?.length > 0" class="failed-section">
          <div class="alert warning">
            ⚠️ {{ bookingResult.failed.length }} 个科目预订失败（座位已被抢占）:<br/>
            <span v-for="f in bookingResult.failed" :key="f.seat">
              {{ f.reason }} &nbsp;
            </span>
          </div>
        </div>

        <div class="receipt-meta">
          <div>预订人：<strong>{{ userName }}</strong></div>
          <div>工号：<strong>{{ userCode }}</strong></div>
          <div>学号：<strong>{{ studentId }}</strong></div>
        </div>

        <button class="primary btn-full" @click="resetAllFlow" style="margin-top: 24px;">
          完成并返回首页
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import SeatSelection from '../components/SeatSelection.vue'
import { theaterAPI, bookingAPI, setUserCode } from '../services/api.js'

// Inject global config (provided by App.vue)
const siteConfig = inject('siteConfig', ref({ max_subjects: '3' }))

// ─── State ───────────────────────────────────────────────
const currentStep   = ref(1)
const userCode      = ref('')
const userCodeUsed  = ref(false)
const userCodeNotice = ref('')
const userName      = ref('')
const studentId     = ref('')
const parentPhone   = ref('')
const userPhone     = ref('')
const activeSessionId = ref(null)
const receiptFile   = ref(null)
const receiptUrl    = ref('')
const uploadingReceipt = ref(false)
const checkingUser  = ref(false)
const subjectCount  = ref('')   // how many subjects user wants to enroll

const isRetryMode   = ref(false)
const retryQueue    = ref([]) // [{ theater, seat }]
const retryMessage  = ref('')

// Step 3 multi-round state
const currentRound         = ref(1)
const roundPhase           = ref('subject')   // 'subject' | 'timeslot' | 'seat'
const currentSubject       = ref('')
const currentTimeslot      = ref(null)        // selected theater object
const completedSelections  = ref([])          // [{ theater, seat }]
const seatError            = ref('')

const allTheaters          = ref([])
const loadingTheaters      = ref(false)
const currentTheaterData   = ref(null)
const currentBookedSeats   = ref([])

// Step 5 result
const bookingResult = ref(null)

// ─── Computed ─────────────────────────────────────────────
const maxSubjectsOptions = computed(() => {
  const max = parseInt(siteConfig.value?.max_subjects || '3', 10)
  return Array.from({ length: max }, (_, i) => i + 1)
})

// All subjects distinct from theaters, excluding already-completed ones
const doneSubjects = computed(() =>
  completedSelections.value.map(s => s.theater.subject)
)

const availableSubjects = computed(() => {
  if (isRetryMode.value && retryQueue.value.length > 0) {
    // 兼容处理：后端返回的失败列表可能直接包含 subject 而不是嵌套在 theater 对象中
    const set = new Set(retryQueue.value.map(s => s.subject || s.theater?.subject).filter(Boolean))
    return [...set]
  }
  const seen = new Set()
  for (const t of allTheaters.value) {
    if (t.subject) seen.add(t.subject)
  }
  return [...seen]
})

function isSubjectDone(subject) {
  return doneSubjects.value.includes(subject)
}

const theatersForCurrentSubject = computed(() => {
  if (isRetryMode.value) {
    // 兼容处理：后端返回的失败项可能直接包含 subject/theater_id
    const targetTheaters = new Set(
      retryQueue.value
        .filter(r => (r.subject || r.theater?.subject) === currentSubject.value)
        .map(r => r.theater_id || r.theater?.id)
        .filter(Boolean)
    )
    return allTheaters.value.filter(t => t.subject === currentSubject.value && targetTheaters.has(t.id))
  }
  return allTheaters.value.filter(t => t.subject === currentSubject.value)
})

// ─── Step 1 ───────────────────────────────────────────────
async function submitStep1() {
  const code = userCode.value.trim()
  if (!code) return
  
  if (isRetryMode.value) {
    // If already in retry mode, just proceed
    setUserCode(code)
    currentStep.value = 2
    return
  }

  checkingUser.value = true
  userCodeNotice.value = ''
  try {
    const res = await bookingAPI.checkUserCode(code)
    if (res.data.success && res.data.exists) {
      userCodeNotice.value = '该工号已有预约记录，请勿重复预约'
      return
    }
    
    // 初始化 Session ID，在整个重选周期内保持不变
    if (!activeSessionId.value) {
      activeSessionId.value = Date.now().toString(36) + Math.random().toString(36).substring(2)
    }
    
    setUserCode(code)
    currentStep.value = 2
  } catch (err) {
    userCodeNotice.value = '校验工号失败，请稍后重试'
  } finally {
    checkingUser.value = false
  }
}

// ─── Step 2 ───────────────────────────────────────────────
function onFileChange(e) {
  const file = e.target.files[0]
  if (file) receiptFile.value = file
}

async function submitStep2() {
  if (!userName.value || !studentId.value || !parentPhone.value || !userPhone.value || !receiptFile.value || !subjectCount.value) {
    alert('请填写所有信息并上传凭证')
    return
  }
  uploadingReceipt.value = true
  try {
    const res = await bookingAPI.uploadReceipt(receiptFile.value)
    if (res.data.success) {
      receiptUrl.value = res.data.data.url
      await loadTheaters()
      currentStep.value = 3
      currentRound.value = 1
      roundPhase.value = 'subject'
      completedSelections.value = []
    } else {
      throw new Error('上传失败')
    }
  } catch (err) {
    alert('图片上传失败，请检查网络或重试。')
    console.error(err)
  } finally {
    uploadingReceipt.value = false
  }
}

// ─── Step 3 helpers ───────────────────────────────────────
async function loadTheaters() {
  loadingTheaters.value = true
  try {
    const result = await theaterAPI.getTheaters()
    allTheaters.value = result.data.data || []
  } catch (err) {
    console.error('Failed to load theaters:', err)
    alert('加载科目列表失败')
  } finally {
    loadingTheaters.value = false
  }
}

function selectSubject(subject) {
  currentSubject.value = subject
  roundPhase.value = 'timeslot'
}

async function selectTimeslot(theater) {
  currentTimeslot.value = theater
  try {
    const result = await theaterAPI.getSeats(theater.id)
    currentTheaterData.value = result.data.data
    currentBookedSeats.value = result.data.data.booked_seats || []
    roundPhase.value = 'seat'
    seatError.value = ''
  } catch (err) {
    alert('加载座位信息失败')
  }
}

async function handleSeatConfirm(seat) {
  // Store selection for this round
  completedSelections.value.push({
    theater: {
      id: currentTimeslot.value.id,
      subject: currentTimeslot.value.subject,
      teacher: currentTimeslot.value.teacher,
      class_time: currentTimeslot.value.class_time,
      name: currentTimeslot.value.name,
      tab_name: currentTimeslot.value.tab_name,
      theater_name: currentTimeslot.value.name,
      aisle_after: currentTimeslot.value.aisle_after
    },
    seat
  })

  if (currentRound.value < Number(subjectCount.value)) {
    // More rounds needed
    currentRound.value++
    roundPhase.value = 'subject'
    currentSubject.value = ''
    currentTimeslot.value = null
    currentTheaterData.value = null
    currentBookedSeats.value = []
  } else {
    // All subjects selected — submit
    await submitAllBookings()
  }
}

async function submitAllBookings() {
  currentStep.value = 4  // "Submitting" screen
  try {
    const bookingsPayload = completedSelections.value.map(s => ({
      theater_id: s.theater.id,
      seat: s.seat
    }))

    const res = await bookingAPI.createMultiBooking({
      bookings: bookingsPayload,
      userCode: userCode.value,
      name: userName.value,
      student_id: studentId.value,
      parent_phone: parentPhone.value,
      phone: userPhone.value,
      receipt_url: receiptUrl.value,
      session_id: activeSessionId.value
    })

    handleSyncResult(res.data)
  } catch (err) {
    console.error('Multi-booking error:', err)
    
    // 强制尝试跳转回步骤 3，防止页面锁死在“正在提交”状态
    try {
      if (err.response?.status === 409 && err.response.data?.data) {
        handleSyncResult(err.response.data)
      } else {
        alert(err.response?.data?.message || '提交失败，请重试')
        currentStep.value = 3
      }
    } catch (innerErr) {
      console.error('Inner error handling failed:', innerErr)
      currentStep.value = 3 // 兜底：无论如何都要回去
    }
  }
}

function handleSyncResult(resultWrapper) {
  if (!resultWrapper) {
    currentStep.value = 3
    return
  }
  
  const result = resultWrapper.data || {}
  bookingResult.value = result

  if (result.failed && result.failed.length > 0) {
    // 发生了撞座冲突
    const failedSubjectsNames = result.failed.map(f => f.subject || '未知科目').join('、')
    
    // 初始化/更新重试状态
    isRetryMode.value = true
    retryQueue.value = result.failed
    
    // 从已完成列表中移除那些失败的记录（使用可选链防止 c.theater_id 缺失）
    const confirmedIds = new Set((result.confirmed || []).map(c => `${c.theater_id}-${c.seat}`))
    completedSelections.value = completedSelections.value.filter(s => 
      s.theater && confirmedIds.has(`${s.theater.id}-${s.seat}`)
    )
    
    // 立即跳转回第 3 步（选座步）
    currentStep.value = 3
    currentRound.value = (result.confirmed?.length || 0) + 1
    roundPhase.value = 'subject'
    currentSubject.value = ''
    currentTimeslot.value = null
    
    // 延迟显示提示框，确保 DOM 已经更新
    setTimeout(() => {
      alert(`Oops! 你手慢了，以下科目座位已被占领：\n${failedSubjectsNames}\n\n请重新选择座位。`)
    }, 100)
  } else {
    // 全部成功
    currentStep.value = 5
  }
}

function goBackFromStep3() {
  completedSelections.value = []
  currentRound.value = 1
  roundPhase.value = 'subject'
  currentStep.value = 2
}

// ─── Utilities ────────────────────────────────────────────
function formatSeatId(seatId) {
  if (!seatId) return ''
  const parts = String(seatId).split('-')
  if (parts.length === 2) {
    return `${String.fromCharCode(64 + parseInt(parts[1], 10))}${parts[0]}`
  }
  return seatId
}

function resetAllFlow() {
  activeSessionId.value = null
  userCode.value = ''
  userName.value = ''
  studentId.value = ''
  parentPhone.value = ''
  userPhone.value = ''
  receiptFile.value = null
  receiptUrl.value = ''
  subjectCount.value = ''
  allTheaters.value = []
  currentRound.value = 1
  roundPhase.value = 'subject'
  currentSubject.value = ''
  currentTimeslot.value = null
  currentTheaterData.value = null
  currentBookedSeats.value = []
  completedSelections.value = []
  bookingResult.value = null
  seatError.value = ''
  currentStep.value = 1
  setUserCode('')
}
</script>

<style scoped>
.home-view {
  max-width: 860px;
  margin: 0 auto;
}

.step-wrap {
  width: 100%;
}

/* ── Form Card ─────────────────────────────────────────── */
.form-card {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-lg);
  padding: 48px 40px;
  max-width: 480px;
  margin: 0 auto;
}

.card-icon {
  font-size: 40px;
  margin-bottom: 16px;
  text-align: center;
}

h2 {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  text-align: center;
  margin-bottom: 8px;
}

.card-desc {
  color: var(--text-muted);
  text-align: center;
  font-size: 14px;
  margin-bottom: 32px;
  line-height: 1.5;
}

.fields-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.req { color: var(--primary); }

.full-width { grid-column: 1 / -1; }

.file-drop {
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition);
  background: var(--bg-subtle);
}

.file-drop:hover {
  border-color: var(--primary);
  background: var(--primary-ultra-light);
}

.file-drop.has-file {
  border-color: #48BB78;
  background: #F0FFF4;
  border-style: solid;
}

.drop-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 14px;
}

.drop-icon { font-size: 24px; }
.file-ready { color: #276749; }

.form-actions {
  display: flex;
  gap: 12px;
}
.form-actions button { flex: 1; padding: 13px; font-size: 15px; }

.btn-full { width: 100%; padding: 14px; font-size: 15px; margin-top: 12px; }

.btn-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  display: inline-block;
  animation: spin 0.7s linear infinite;
}

/* ── Round Header ──────────────────────────────────────── */
.round-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.round-chip {
  display: inline-block;
  background: var(--primary-ultra-light);
  color: var(--primary-dark);
  border: 1.5px solid var(--primary-light);
  border-radius: 999px;
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 8px;
}

.round-header h2 {
  text-align: left;
  font-size: 22px;
}

.done-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.done-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }

.done-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #F0FFF4;
  border: 1px solid #9AE6B4;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
}

.done-num {
  width: 20px;
  height: 20px;
  background: #48BB78;
  color: white;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.done-subject { font-size: 12px; font-weight: 600; color: #276749; }
.done-seat { font-size: 13px; font-weight: 800; color: var(--primary-dark); background: var(--primary-ultra-light); padding: 1px 8px; border-radius: 4px; }

/* ── Card Panel ─────────────────────────────────────────── */
.card-panel {
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 32px;
}

.panel-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.panel-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }

/* ── Subject Grid ─────────────────────────────────────────── */
.subject-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}

.subject-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: var(--bg-subtle);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
  text-align: left;
  position: relative;
}

.subject-card:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-ultra-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-primary);
}

.subject-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.subject-icon { font-size: 20px; flex-shrink: 0; }
.subject-name { flex: 1; font-size: 15px; font-weight: 600; color: var(--text-primary); }
.subject-arrow { color: var(--text-muted); font-size: 18px; }

.subject-done-badge {
  position: absolute;
  top: 6px;
  right: 8px;
  background: #48BB78;
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
}

/* ── Timeslot List ───────────────────────────────────────── */
.timeslot-list { display: flex; flex-direction: column; gap: 12px; }

.timeslot-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  background: var(--bg-subtle);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition);
  font-family: inherit;
  text-align: left;
}

.timeslot-card:hover {
  border-color: var(--primary);
  background: var(--primary-ultra-light);
  transform: translateX(4px);
  box-shadow: var(--shadow-primary);
}

.timeslot-main { flex: 1; }
.timeslot-time { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
.timeslot-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.timeslot-arrow { font-size: 20px; color: var(--text-muted); }

.mt-20 { margin-top: 20px; }

/* ── Submitting ──────────────────────────────────────────── */
.center-content {
  max-width: 400px;
  margin: 0 auto;
  text-align: center;
  padding: 60px 40px;
}

.large-spinner {
  width: 48px;
  height: 48px;
  border-width: 4px;
  margin: 0 auto 24px;
}

/* ── Success Card ─────────────────────────────────────────── */
.success-card {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1.5px solid #9AE6B4;
  box-shadow: 0 12px 40px rgba(72, 187, 120, 0.12);
  padding: 48px 40px;
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.success-icon-wrap {
  width: 80px;
  height: 80px;
  background: #F0FFF4;
  border: 2px solid #9AE6B4;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.success-icon { font-size: 40px; }

/* ── Bookings Summary ─────────────────────────────────────── */
.bookings-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 28px 0;
  text-align: left;
}

.booking-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--bg-subtle);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
}

.booking-num {
  width: 28px;
  height: 28px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.booking-info { flex: 1; }
.booking-subject { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.booking-meta { display: flex; gap: 6px; flex-wrap: wrap; }

.booking-seat {
  font-size: 22px;
  font-weight: 800;
  color: var(--primary-dark);
  background: var(--primary-ultra-light);
  border: 1.5px solid var(--primary-light);
  border-radius: var(--radius-sm);
  padding: 4px 14px;
  flex-shrink: 0;
}

.failed-section { text-align: left; margin-bottom: 16px; }

.receipt-meta {
  display: flex;
  justify-content: center;
  gap: 24px;
  font-size: 14px;
  color: var(--text-secondary);
  padding: 16px;
  background: var(--bg-subtle);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

@media (max-width: 640px) {
  .form-card, .success-card { padding: 28px 20px; }
  .round-header { flex-direction: column; }
  h2 { font-size: 20px; }
}
</style>
