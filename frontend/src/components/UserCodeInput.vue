<template>
  <div class="user-code-input">
    <div class="card">
      <h2>👤 请输入您的工号/代号</h2>
      <p class="description">输入您的代号以继续预订办公座位</p>

      <form @submit.prevent="submitForm">
        <input
          v-model="inputCode"
          type="text"
          placeholder="请输入工号/代号"
          maxlength="50"
          required
          autofocus
        />
        <button type="submit" class="primary" :disabled="!inputCode.trim()">
          确认
        </button>
      </form>

      <div v-if="error" class="alert error">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const inputCode = ref('')
const error = ref('')

const emit = defineEmits(['submit'])

function submitForm() {
  const code = inputCode.value.trim()
  if (!code) {
    error.value = '请输入有效的工号/代号'
    return
  }
  error.value = ''
  emit('submit', code)
}
</script>

<style scoped>
.user-code-input {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 40px 30px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.card h2 {
  color: #2d3748;
  margin-bottom: 10px;
  font-size: 24px;
}

.description {
  color: #718096;
  margin-bottom: 30px;
  font-size: 14px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

input {
  padding: 12px;
  font-size: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  transition: all 0.3s ease;
}

input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

button {
  padding: 12px;
  font-size: 16px;
  font-weight: 600;
}

.alert {
  margin-top: 15px;
  padding: 12px;
  background: #fed7d7;
  color: #742a2a;
  border: 1px solid #fc8181;
  border-radius: 6px;
  font-size: 14px;
}
</style>
