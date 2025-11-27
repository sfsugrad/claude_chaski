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

// Types
export interface RegisterData {
  email: string
  password: string
  full_name: string
  role: 'sender' | 'courier' | 'both'
  phone_number?: string
  max_deviation_km?: number
}

export interface LoginData {
  email: string
  password: string
}

export interface UserResponse {
  id: number
  email: string
  full_name: string
  role: string
  phone_number: string | null
  is_active: boolean
  is_verified: boolean
  max_deviation_km: number
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface PackageCreate {
  description: string
  size: 'small' | 'medium' | 'large' | 'extra_large'
  weight_kg: number
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  pickup_contact_name?: string
  pickup_contact_phone?: string
  dropoff_contact_name?: string
  dropoff_contact_phone?: string
  price?: number
  sender_id?: number  // Admin only: specify sender user
}

export interface PackageResponse {
  id: number
  sender_id: number
  courier_id: number | null
  description: string
  size: string
  weight_kg: number
  status: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  pickup_contact_name: string | null
  pickup_contact_phone: string | null
  dropoff_contact_name: string | null
  dropoff_contact_phone: string | null
  price: number | null
  created_at: string
  updated_at: string | null
}

// Auth API
export const authAPI = {
  register: (data: RegisterData) => api.post<UserResponse>('/auth/register', data),
  login: (data: LoginData) => api.post<TokenResponse>('/auth/login', data),
  getCurrentUser: () => api.get<UserResponse>('/auth/me'),
}

// Packages API
export const packagesAPI = {
  create: (data: PackageCreate) => api.post<PackageResponse>('/packages', data),
  getAll: () => api.get<PackageResponse[]>('/packages'),
  getById: (id: number) => api.get<PackageResponse>(`/packages/${id}`),
  updateStatus: (id: number, status: string) =>
    api.put(`/packages/${id}/status`, { status }),
  cancel: (id: number) => api.put<PackageResponse>(`/packages/${id}/cancel`),
}

// Route Types
export interface RouteCreate {
  start_address: string
  start_lat: number
  start_lng: number
  end_address: string
  end_lat: number
  end_lng: number
  max_deviation_km: number
  departure_time?: string
}

export interface RouteResponse {
  id: number
  courier_id: number
  start_address: string
  start_lat: number
  start_lng: number
  end_address: string
  end_lat: number
  end_lng: number
  max_deviation_km: number
  departure_time: string | null
  is_active: boolean
  created_at: string
}

export interface MatchedPackage {
  package_id: number
  sender_id: number
  description: string
  size: string
  weight_kg: number
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  price: number | null
  distance_from_route_km: number
  estimated_detour_km: number
  pickup_contact_name: string | null
  pickup_contact_phone: string | null
  dropoff_contact_name: string | null
  dropoff_contact_phone: string | null
}

// Couriers API
export const couriersAPI = {
  createRoute: (data: RouteCreate) => api.post<RouteResponse>('/couriers/routes', data),
  getRoutes: () => api.get<RouteResponse[]>('/couriers/routes'),
  getRoute: (id: number) => api.get<RouteResponse>(`/couriers/routes/${id}`),
  deleteRoute: (id: number) => api.delete(`/couriers/routes/${id}`),
}

// Matching API
export const matchingAPI = {
  getPackagesAlongRoute: (routeId: number) =>
    api.get<MatchedPackage[]>(`/matching/packages-along-route/${routeId}`),
  acceptPackage: (packageId: number) =>
    api.post(`/matching/accept-package/${packageId}`),
  declinePackage: (packageId: number) =>
    api.post(`/matching/decline-package/${packageId}`),
  getOptimizedRoute: (routeId: number) =>
    api.get(`/matching/optimized-route/${routeId}`),
}

// Notification Types
export type NotificationType =
  | 'package_matched'
  | 'package_picked_up'
  | 'package_in_transit'
  | 'package_delivered'
  | 'package_cancelled'
  | 'new_match_available'
  | 'system'

export interface NotificationResponse {
  id: number
  user_id: number
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  package_id: number | null
  created_at: string
}

export interface NotificationCountResponse {
  unread_count: number
}

// Notifications API
export const notificationsAPI = {
  getAll: (unreadOnly: boolean = false) =>
    api.get<NotificationResponse[]>(`/notifications${unreadOnly ? '?unread_only=true' : ''}`),
  getUnreadCount: () =>
    api.get<NotificationCountResponse>('/notifications/unread-count'),
  markAsRead: (id: number) =>
    api.put<NotificationResponse>(`/notifications/${id}/read`),
  markAllAsRead: () =>
    api.put('/notifications/read-all'),
  delete: (id: number) =>
    api.delete(`/notifications/${id}`),
}
