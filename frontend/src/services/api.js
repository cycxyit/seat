import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
})

export function setUserCode(userCode) {
  if (userCode) {
    api.defaults.headers.common['X-User-Code'] = userCode
  } else {
    delete api.defaults.headers.common['X-User-Code']
  }
}

export function setAdminKey(adminKey) {
  if (adminKey) {
    api.defaults.headers.common['X-Admin-Key'] = adminKey
  } else {
    delete api.defaults.headers.common['X-Admin-Key']
  }
}

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
  createMultiBooking: (bookings, name, phone, receiptUrl, sessionId) =>
    api.post('/bookings/multi', {
      bookings,        // [{ theater_id, seat }]
      name,
      phone,
      receipt_url: receiptUrl,
      session_id: sessionId
    }),

  // Single subject (legacy)
  createBooking: (theaterId, seats, userCode, name, phone, receiptUrl) =>
    api.post('/bookings', { theater_id: theaterId, seats, name, phone, receipt_url: receiptUrl }),

  getUserBookings: (userCode) => api.get(`/bookings/user/${userCode}`)
}

// ─── Admin ───────────────────────────────────────────────
export const adminAPI = {
  getConfig:    ()     => api.get('/admin/config'),
  updateConfig: (data) => api.put('/admin/config', data),
  createTheater: (data) => api.post('/admin/theaters', data),
  deleteTheater: (id)   => api.delete(`/admin/theaters/${id}`)
}

export default api
