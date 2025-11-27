import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
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
  default_address?: string
  default_address_lat?: number
  default_address_lng?: number
}

export interface LoginData {
  email: string
  password: string
  remember_me?: boolean
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
  default_address: string | null
  default_address_lat: number | null
  default_address_lng: number | null
  created_at: string
  average_rating: number | null
  total_ratings: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface AuthResponse {
  message: string
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
  sender_name: string | null
  courier_name: string | null
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

export interface ForgotPasswordData {
  email: string
}

export interface ResetPasswordData {
  token: string
  new_password: string
}

export interface MessageResponse {
  message: string
}

export interface UserUpdate {
  full_name?: string
  phone_number?: string
  max_deviation_km?: number
  default_address?: string
  default_address_lat?: number
  default_address_lng?: number
}

// Auth API
export const authAPI = {
  register: (data: RegisterData) => api.post<UserResponse>('/auth/register', data),
  login: (data: LoginData) => api.post<AuthResponse>('/auth/login', data),
  logout: () => api.post<AuthResponse>('/auth/logout'),
  getCurrentUser: () => api.get<UserResponse>('/auth/me'),
  updateProfile: (data: UserUpdate) => api.put<UserResponse>('/auth/me', data),
  forgotPassword: (data: ForgotPasswordData) => api.post<MessageResponse>('/auth/forgot-password', data),
  resetPassword: (data: ResetPasswordData) => api.post<MessageResponse>('/auth/reset-password', data),
}

// Packages API
export const packagesAPI = {
  create: (data: PackageCreate) => api.post<PackageResponse>('/packages', data),
  getAll: () => api.get<PackageResponse[]>('/packages'),
  getById: (id: number) => api.get<PackageResponse>(`/packages/${id}`),
  update: (id: number, data: Partial<PackageCreate>) =>
    api.put<PackageResponse>(`/packages/${id}`, data),
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
  activateRoute: (id: number) => api.put<RouteResponse>(`/couriers/routes/${id}/activate`),
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
  | 'route_match_found'
  | 'new_rating'
  | 'package_match_found'
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

export interface NotificationListResponse {
  notifications: NotificationResponse[]
  total: number
  unread_count: number
}

export interface NotificationCountResponse {
  unread_count: number
}

// Notifications API
export const notificationsAPI = {
  getAll: (unreadOnly: boolean = false) =>
    api.get<NotificationListResponse>(`/notifications/${unreadOnly ? '?unread_only=true' : ''}`),
  getUnreadCount: () =>
    api.get<NotificationCountResponse>('/notifications/unread-count'),
  markAsRead: (id: number) =>
    api.put<NotificationResponse>(`/notifications/${id}/read`),
  markAllAsRead: () =>
    api.put('/notifications/mark-read', {}),
  delete: (id: number) =>
    api.delete(`/notifications/${id}`),
}

// Rating Types
export interface RatingCreate {
  package_id: number
  score: number
  comment?: string
}

export interface RatingResponse {
  id: number
  rater_id: number
  rated_user_id: number
  package_id: number
  score: number
  comment: string | null
  created_at: string
  rater_name: string | null
}

export interface RatingListResponse {
  ratings: RatingResponse[]
  total: number
  average_rating: number | null
}

export interface UserRatingSummary {
  user_id: number
  average_rating: number | null
  total_ratings: number
  rating_breakdown: Record<number, number>
}

export interface PendingRating {
  package_id: number
  package_description: string
  delivery_time: string | null
  user_to_rate_id: number
  user_to_rate_name: string
  user_to_rate_role: 'sender' | 'courier'
}

// Ratings API
export const ratingsAPI = {
  create: (data: RatingCreate) =>
    api.post<RatingResponse>('/ratings', data),
  getUserRatings: (userId: number, skip: number = 0, limit: number = 20) =>
    api.get<RatingListResponse>(`/ratings/user/${userId}?skip=${skip}&limit=${limit}`),
  getUserRatingSummary: (userId: number) =>
    api.get<UserRatingSummary>(`/ratings/user/${userId}/summary`),
  getPackageRatings: (packageId: number) =>
    api.get<RatingResponse[]>(`/ratings/package/${packageId}`),
  getMyPendingRatings: () =>
    api.get<PendingRating[]>('/ratings/my-pending'),
}

// Message Types
export interface MessageResponse {
  id: number
  package_id: number
  sender_id: number
  sender_name: string
  content: string
  is_read: boolean
  created_at: string
}

export interface MessageListResponse {
  messages: MessageResponse[]
  total: number
}

export interface ConversationSummary {
  package_id: number
  package_description: string
  other_user_id: number
  other_user_name: string
  last_message: string
  last_message_at: string
  unread_count: number
}

export interface ConversationListResponse {
  conversations: ConversationSummary[]
  total: number
}

export interface MessageUnreadCountResponse {
  unread_count: number
}

// Messages API
export const messagesAPI = {
  getConversations: (skip: number = 0, limit: number = 20) =>
    api.get<ConversationListResponse>(`/messages/conversations?skip=${skip}&limit=${limit}`),
  getPackageMessages: (packageId: number, skip: number = 0, limit: number = 50) =>
    api.get<MessageListResponse>(`/messages/package/${packageId}?skip=${skip}&limit=${limit}`),
  sendMessage: (packageId: number, content: string) =>
    api.post<MessageResponse>(`/messages/package/${packageId}`, { content }),
  markAsRead: (messageId: number) =>
    api.put<MessageResponse>(`/messages/${messageId}/read`),
  markAllAsRead: (packageId: number) =>
    api.put(`/messages/package/${packageId}/read-all`),
  getUnreadCount: () =>
    api.get<MessageUnreadCountResponse>('/messages/unread-count'),
}

// Admin Types
export interface AdminUser {
  id: number
  email: string
  full_name: string
  role: string
  phone_number: string | null
  is_active: boolean
  is_verified: boolean
  max_deviation_km: number
  created_at: string
  updated_at: string | null
}

export interface AdminPackage {
  id: number
  sender_id: number
  courier_id: number | null
  description: string
  size: string
  weight_kg: number
  pickup_address: string
  dropoff_address: string
  status: string
  price: number
  is_active: boolean
  created_at: string
}

export interface AdminStats {
  total_users: number
  total_senders: number
  total_couriers: number
  total_both: number
  total_admins: number
  total_packages: number
  active_packages: number
  completed_packages: number
  pending_packages: number
  total_revenue: number
}

export interface CreateUserData {
  email: string
  password: string
  full_name: string
  role: string
  phone_number?: string
  max_deviation_km?: number
}

export interface MatchingJobResult {
  routes_processed: number
  total_matches_found: number
  notifications_created: number
  notifications_skipped: number
  route_details?: Array<{
    route_id: number
    courier_id: number
    courier_name: string
    route: string
    matches_found: number
    notifications_sent: number
    matched_packages?: Array<{
      package_id: number
      description: string
      distance_km: number
      detour_km: number
      notified: boolean
    }>
  }>
}

// Admin API
export const adminAPI = {
  // Users
  getUsers: () => api.get<AdminUser[]>('/admin/users'),
  getUser: (userId: number) => api.get<AdminUser>(`/admin/users/${userId}`),
  createUser: (data: CreateUserData) => api.post<AdminUser>('/admin/users', data),
  updateUserRole: (userId: number, role: string) =>
    api.put(`/admin/users/${userId}`, { role }),
  toggleUserActive: (userId: number, isActive: boolean) =>
    api.put(`/admin/users/${userId}/toggle-active`, { is_active: isActive }),
  toggleUserVerified: (userId: number, isVerified: boolean) =>
    api.put(`/admin/users/${userId}/toggle-verified`, { is_verified: isVerified }),
  updateUserProfile: (userId: number, data: { full_name?: string; phone_number?: string | null; max_deviation_km?: number }) =>
    api.put(`/admin/users/${userId}/profile`, data),

  // Packages
  getPackages: () => api.get<AdminPackage[]>('/admin/packages'),
  togglePackageActive: (packageId: number, isActive: boolean) =>
    api.put(`/admin/packages/${packageId}/toggle-active`, { is_active: isActive }),

  // Stats
  getStats: () => api.get<AdminStats>('/admin/stats'),

  // Jobs
  runMatchingJob: (dryRun: boolean = false, notifyHoursThreshold: number = 24) =>
    api.post<MatchingJobResult>('/admin/jobs/run-matching', {
      dry_run: dryRun,
      notify_hours_threshold: notifyHoursThreshold
    }),
}

// Auth verification API (public endpoints)
export const verificationAPI = {
  verifyEmail: (token: string) => api.get(`/auth/verify-email/${token}`),
  resendVerification: (email: string) =>
    api.post(`/auth/resend-verification?email=${encodeURIComponent(email)}`),
}
