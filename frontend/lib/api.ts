import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api

// Auth API
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
}

// Packages API
export const packagesAPI = {
  create: (data: any) => api.post('/packages', data),
  getAll: () => api.get('/packages'),
  getById: (id: number) => api.get(`/packages/${id}`),
  updateStatus: (id: number, status: string) =>
    api.put(`/packages/${id}/status`, { status }),
}

// Couriers API
export const couriersAPI = {
  createRoute: (data: any) => api.post('/couriers/routes', data),
  getRoutes: () => api.get('/couriers/routes'),
  getRoute: (id: number) => api.get(`/couriers/routes/${id}`),
  deleteRoute: (id: number) => api.delete(`/couriers/routes/${id}`),
}

// Matching API
export const matchingAPI = {
  getPackagesAlongRoute: (routeId: number) =>
    api.get(`/matching/packages-along-route/${routeId}`),
  acceptPackage: (packageId: number) =>
    api.post(`/matching/accept-package/${packageId}`),
  declinePackage: (packageId: number) =>
    api.post(`/matching/decline-package/${packageId}`),
}
