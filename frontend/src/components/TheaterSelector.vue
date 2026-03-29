<template>
  <div class="theater-selector">
    <h2>🏢 选择科室</h2>

    <div v-if="loading" class="loading">
      加载中...
    </div>

    <div v-else-if="theaters.length === 0" class="empty">
      <p>暂无可用科室</p>
    </div>

    <div v-else class="theaters-grid">
      <div
        v-for="theater in theaters"
        :key="theater.id"
        class="theater-card"
        @click="selectTheater(theater.id)"
      >
        <div class="theater-info">
          <h3>{{ theater.name }}</h3>
          <p class="dimensions">{{ theater.rows }} 行 × {{ theater.cols }} 列</p>
          <p class="total-seats">共 {{ theater.rows * theater.cols }} 个座位</p>
        </div>
        <div class="arrow">→</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  theaters: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

function selectTheater(theaterId) {
  emit('select', theaterId)
}
</script>

<style scoped>
.theater-selector {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h2 {
  color: #2d3748;
  margin-bottom: 30px;
  font-size: 24px;
}

.loading,
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #718096;
  font-size: 16px;
}

.theaters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.theater-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.theater-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.theater-info h3 {
  font-size: 18px;
  margin-bottom: 8px;
}

.dimensions {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.total-seats {
  font-size: 13px;
  opacity: 0.8;
}

.arrow {
  font-size: 24px;
  opacity: 0.8;
}
</style>
