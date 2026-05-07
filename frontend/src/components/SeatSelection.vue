<template>
  <div class="seat-selection">
    <!-- Progress Banner (multi-subject) -->
    <div v-if="totalSubjects > 1" class="progress-banner">
      <div class="progress-steps">
        <div
          v-for="n in totalSubjects"
          :key="n"
          class="progress-step"
          :class="{
            'done': n < currentSubjectIndex,
            'active': n === currentSubjectIndex,
            'pending': n > currentSubjectIndex
          }"
        >
          <span class="step-dot">{{ n < currentSubjectIndex ? '✓' : n }}</span>
          <span class="step-label">第 {{ n }} 科</span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: ((currentSubjectIndex - 1) / totalSubjects * 100) + '%' }"></div>
      </div>
    </div>

    <!-- Context info -->
    <div class="context-card">
      <div class="context-left">
        <span class="badge badge-primary">{{ theater.subject || '科目' }}</span>
        <span class="badge badge-time" v-if="theater.class_time">🕒 {{ theater.class_time }}</span>
        <span class="badge badge-teacher">👨‍🏫 {{ theater.teacher }}</span>
        <span class="badge badge-dept">🏢 {{ theater.theater_name }}</span>
      </div>
      <!-- Real-time update indicator -->
      <div class="live-badge" :class="{ 'live-active': isLive }">
        <span class="live-dot"></span>
        {{ isLive ? '实时同步中' : '连接中...' }}
      </div>
    </div>

    <!-- SSE update toast -->
    <Transition name="toast">
      <div v-if="showUpdateToast" class="update-toast">
        {{ toastMsg }}
      </div>
    </Transition>

    <!-- Legend -->
    <div class="legend">
      <div class="legend-item">
        <div class="seat-demo available"></div><span>可选</span>
      </div>
      <div class="legend-item">
        <div class="seat-demo booked"></div><span>已预订</span>
      </div>
      <div class="legend-item">
        <div class="seat-demo selected"></div><span>已选中</span>
      </div>
    </div>

    <!-- Seat Grid -->
    <div class="seats-grid-wrapper">
      <div class="seats-grid">
        <!-- Column headers -->
        <div class="grid-row header-row">
          <div class="row-label-area"></div>
          <div class="seats-row">
            <template v-for="col in theater.cols" :key="'h-'+col">
              <div class="col-label">{{ String.fromCharCode(64 + col) }}</div>
              <div v-if="theater.aisles && theater.aisles.includes(col)" class="aisle-gap"></div>
            </template>
          </div>
        </div>

        <!-- Seat rows -->
        <div v-for="row in theater.rows" :key="row" class="grid-row">
          <div class="row-label-area">
            <span class="row-num">{{ row }}</span>
            <span v-if="theater.door_row == row" class="door-tag">🚪</span>
          </div>
          <div class="seats-row">
            <template v-for="col in theater.cols" :key="`${row}-${col}`">
              <button
                type="button"
                :class="['seat', getSeatClass(`${row}-${col}`)]"
                @click="toggleSeat(`${row}-${col}`)"
                :title="getSeatClass(`${row}-${col}`) === 'booked' ? '已预订' : getSeatName(row, col)"
                :disabled="getSeatClass(`${row}-${col}`) === 'booked'"
              >
                {{ getSeatName(row, col) }}
              </button>
              <div v-if="theater.aisles && theater.aisles.includes(col)" class="aisle-gap"></div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected info -->
    <Transition name="slide-up">
      <div v-if="selectedSeat" class="selected-info">
        <div class="selected-label">已选座位</div>
        <div class="selected-seat-tag">{{ formatSeatId(selectedSeat) }}</div>
      </div>
    </Transition>

    <!-- Confirm button -->
    <button
      class="primary confirm-btn"
      :disabled="!selectedSeat"
      @click="confirmSelection"
    >
      {{ selectedSeat ? `确认选择 ${formatSeatId(selectedSeat)}` : '请选择座位' }}
      <span v-if="totalSubjects > 1 && currentSubjectIndex < totalSubjects"> → 下一科目</span>
      <span v-else-if="totalSubjects > 1"> → 提交所有预订</span>
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { theaterAPI } from '../services/api.js'

const props = defineProps({
  theater: { type: Object, required: true },
  bookedSeats: { type: Array, default: () => [] },
  totalSubjects: { type: Number, default: 1 },
  currentSubjectIndex: { type: Number, default: 1 }
})

const emit = defineEmits(['confirm', 'back'])

const selectedSeat = ref(null)
const localBookedSeats = ref([...props.bookedSeats])
const isLive = ref(false)
const showUpdateToast = ref(false)
const toastMsg = ref('')
let eventSource = null
let toastTimer = null

// Sync bookedSeats prop to local copy
watch(() => props.bookedSeats, (v) => { localBookedSeats.value = [...v] }, { deep: true })

// SSE connection
function connectSSE() {
  if (!props.theater?.theater_id) return
  const url = theaterAPI.getStreamUrl(props.theater.theater_id)
  eventSource = new EventSource(url)

  eventSource.onopen = () => { isLive.value = true }
  eventSource.onerror = () => { isLive.value = false }

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.type === 'seat_booked' && data.seat) {
        if (!localBookedSeats.value.includes(data.seat)) {
          localBookedSeats.value = [...localBookedSeats.value, data.seat]
          if (selectedSeat.value === data.seat) selectedSeat.value = null
          showToast('🔄 有新座位被预订，座位图已更新')
        }
      } else if (data.type === 'seat_cancelled' && data.seat) {
        if (localBookedSeats.value.includes(data.seat)) {
          localBookedSeats.value = localBookedSeats.value.filter(s => s !== data.seat)
          showToast('🔄 有座位被释放，现在可以选择了')
        }
      }
    } catch (_) {}
  }
}

function showToast(msg) {
  toastMsg.value = msg
  showUpdateToast.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { showUpdateToast.value = false }, 4000)
}

onMounted(() => connectSSE())
onUnmounted(() => {
  eventSource?.close()
  clearTimeout(toastTimer)
})

// Seat helpers
function getSeatName(row, col) {
  return `${String.fromCharCode(64 + col)}${row}`
}

function formatSeatId(seatId) {
  const parts = String(seatId).split('-')
  if (parts.length === 2) {
    return getSeatName(parseInt(parts[0], 10), parseInt(parts[1], 10))
  }
  return seatId
}

function getSeatClass(seatId) {
  if (selectedSeat.value === seatId) return 'selected'
  if (localBookedSeats.value.includes(seatId)) return 'booked'
  return 'available'
}

function toggleSeat(seatId) {
  if (localBookedSeats.value.includes(seatId)) return
  selectedSeat.value = selectedSeat.value === seatId ? null : seatId
}

function confirmSelection() {
  if (!selectedSeat.value) return
  emit('confirm', selectedSeat.value)
  selectedSeat.value = null
}
</script>

<style scoped>
.seat-selection {
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: fadeInUp 0.35s ease forwards;
}

/* ── Progress Banner ──────────────────── */
.progress-banner {
  background: var(--bg-card);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px 24px;
}

.progress-steps {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  border: 2px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-muted);
  transition: all var(--transition);
}

.progress-step.done .step-dot  { background: #48BB78; border-color: #48BB78; color: white; }
.progress-step.active .step-dot { background: var(--primary); border-color: var(--primary); color: white; box-shadow: 0 0 0 4px var(--primary-glow); }

.step-label { font-size: 11px; color: var(--text-muted); font-weight: 500; }
.progress-step.active .step-label { color: var(--primary-dark); font-weight: 600; }

.progress-bar {
  height: 4px;
  background: var(--bg-subtle);
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-dark));
  border-radius: 99px;
  transition: width 0.5s ease;
}

/* ── Context Card ─────────────────────── */
.context-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--bg-subtle);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  flex-wrap: wrap;
}

.context-left { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1.5px solid var(--border);
}

.live-badge.live-active {
  color: #276749;
  border-color: #9AE6B4;
  background: #F0FFF4;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #CBD5E0;
}

.live-active .live-dot {
  background: #48BB78;
  animation: pulse 1.5s ease-in-out infinite;
}

/* ── Toast ────────────────────────────── */
.update-toast {
  background: #FFFBEB;
  border: 1.5px solid #FCD34D;
  color: #92400E;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  text-align: center;
}

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Legend ───────────────────────────── */
.legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
}

.legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); font-weight: 500; }

.seat-demo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.seat-demo.available { background: #48BB78; }
.seat-demo.booked    { background: #CBD5E0; }
.seat-demo.selected  { background: var(--primary); }

/* ── Seat Grid ────────────────────────── */
.seats-grid-wrapper {
  overflow-x: auto;
  background: var(--bg-subtle);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 24px;
}

.seats-grid {
  display: inline-flex;
  flex-direction: column;
  gap: 10px;
  min-width: max-content;
  margin: 0 auto;
}

.grid-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-label-area {
  width: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.row-num {
  font-weight: 700;
  color: var(--text-secondary);
  font-size: 13px;
}

.door-tag {
  font-size: 14px;
  line-height: 1;
}

.col-label {
  width: 44px;
  text-align: center;
  font-weight: 700;
  color: var(--text-muted);
  font-size: 13px;
}

.seats-row { display: flex; gap: 8px; align-items: center; }

/* ── Individual Seat ──────────────────── */
.seat {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 700;
  font-family: inherit;
  transition: all 0.18s ease;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.seat.available {
  background: #48BB78;
  color: white;
}

.seat.available:hover {
  background: #38A169;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
}

.seat.booked {
  background: #EDF2F7;
  color: #A0AEC0;
  cursor: not-allowed;
  box-shadow: none;
}

.seat.selected {
  background: var(--primary);
  color: white;
  box-shadow: 0 4px 16px var(--primary-glow);
  transform: scale(1.08);
}

.aisle-gap { width: 22px; }

/* ── Selected Info ────────────────────── */
.selected-info {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--primary-ultra-light);
  border: 1.5px solid var(--primary-light);
  border-radius: var(--radius-sm);
  padding: 14px 20px;
}

.selected-label { font-size: 13px; font-weight: 600; color: var(--primary-dark); }

.selected-seat-tag {
  background: var(--primary);
  color: white;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.25s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(8px); }

/* ── Confirm Button ───────────────────── */
.confirm-btn {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  border-radius: var(--radius-md);
  letter-spacing: 0.02em;
}
</style>
