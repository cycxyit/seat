import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
})

let _userCode = '';
let _adminKey = '';

export function setUserCode(userCode) {
  _userCode = userCode || '';
}

export function setAdminKey(adminKey) {
  _adminKey = adminKey || '';
}

// 使用拦截器动态注入请求头，这比修改 defaults 更可靠
api.interceptors.request.use(config => {
  if (_userCode) config.headers['X-User-Code'] = _userCode;
  if (_adminKey) config.headers['X-Admin-Key'] = _adminKey;
  return config;
}, error => {
  return Promise.reject(error);
});

// ─── Public Config ──────────────────────────────────────
export const configAPI = {
  getPublicConfig: () => api.get('/config')
}

// ─── Theaters ───────────────────────────────────────────
export const theaterAPI = {
  getTheaters: ()   => api.get('/theaters'),
  getTheater:  (id) => api.get(`/theaters/${id}`),
  getSeats:    (id) => api.get(`/theaters/${id}/seats`),
  // SSE stream URL (used with EventSource, not axios)
  getStreamUrl: (id) => `${API_BASE_URL}/theaters/${id}/stream`
}

// ─── Bookings ────────────────────────────────────────────
export const bookingAPI = {
  uploadReceipt: (file) => {
    const formData = new FormData()
    formData.append('receipt', file)
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Multi-subject batch booking (new)
  createMultiBooking(data) {
    // data = { bookings, userCode, name, phone, receipt_url, session_id }
    return api.post('/bookings/multi', data)
  },

  // Single subject (legacy)
  createBooking: (theaterId, seats, userCode, name, phone, receiptUrl) =>
    api.post('/bookings', { theater_id: theaterId, seats, name, phone, receipt_url: receiptUrl }),

  getUserBookings: (userCode) => api.get(`/bookings/user/${userCode}`),
  checkUserCode: (userCode) => api.get(`/bookings/check-user/${userCode}`)
}

// ─── Admin ───────────────────────────────────────────────
export const adminAPI = {
  getConfig:    ()     => api.get('/admin/config'),
  updateConfig: (data) => api.put('/admin/config', data),
  createTheater: (data) => api.post('/admin/theaters', data),
  deleteTheater: (id)   => api.delete(`/admin/theaters/${id}`),
  getSyncStatus: () => api.get('/admin/sync-status'),
  triggerSync: () => api.post('/admin/sync')
}

export default api
