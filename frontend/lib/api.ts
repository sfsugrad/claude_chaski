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
  requires_proof?: boolean  // Whether delivery proof is required (default: true)
  sender_id?: number  // Admin only: specify sender user
}

export interface PackageResponse {
  id: number
  tracking_id: string
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
  requires_proof: boolean
  created_at: string
  updated_at: string | null
  // Status transition timestamps
  status_changed_at: string | null
  matched_at: string | null
  accepted_at: string | null
  picked_up_at: string | null
  in_transit_at: string | null
  // Acceptance tracking - both parties must accept for MATCHED → ACCEPTED
  sender_accepted: boolean
  courier_accepted: boolean
  sender_accepted_at: string | null
  courier_accepted_at: string | null
  // Allowed next statuses for UI
  allowed_next_statuses: string[]
  // Bidding fields
  bid_deadline: string | null
  bid_count: number
  selected_bid_id: number | null
  deadline_extensions: number
}

export interface AcceptanceStatus {
  sender_accepted: boolean
  courier_accepted: boolean
  sender_accepted_at: string | null
  courier_accepted_at: string | null
  both_accepted: boolean
  awaiting_sender: boolean
  awaiting_courier: boolean
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
  getByTrackingId: (trackingId: string) => api.get<PackageResponse>(`/packages/${trackingId}`),
  update: (trackingId: string, data: Partial<PackageCreate>) =>
    api.put<PackageResponse>(`/packages/${trackingId}`, data),
  updateStatus: (trackingId: string, status: string) =>
    api.put(`/packages/${trackingId}/status`, { status }),
  cancel: (trackingId: string) => api.put<PackageResponse>(`/packages/${trackingId}/cancel`),
  // Acceptance for matched packages - both sender and courier must accept
  accept: (trackingId: string) => api.post<PackageResponse>(`/packages/${trackingId}/accept`),
  getAcceptanceStatus: (trackingId: string) => api.get<AcceptanceStatus>(`/packages/${trackingId}/acceptance-status`),
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
  trip_date?: string
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
  trip_date: string | null
  is_active: boolean
  created_at: string
}

export interface MatchedPackage {
  package_id: number
  tracking_id: string
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
  | 'package_accepted'
  | 'package_picked_up'
  | 'package_in_transit'
  | 'package_delivered'
  | 'package_cancelled'
  | 'new_match_available'
  | 'route_match_found'
  | 'new_rating'
  | 'package_match_found'
  // Bidding notifications
  | 'new_bid_received'
  | 'bid_selected'
  | 'bid_rejected'
  | 'bid_withdrawn'
  | 'bid_deadline_warning'
  | 'bid_deadline_extended'
  | 'bid_deadline_expired'
  // Package notes
  | 'new_note_added'
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
  tracking_id: string
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
  getPackageRatings: (trackingId: string) =>
    api.get<RatingResponse[]>(`/ratings/package/${trackingId}`),
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
  tracking_id: string
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
  getPackageMessages: (trackingId: string, skip: number = 0, limit: number = 50) =>
    api.get<MessageListResponse>(`/messages/package/${trackingId}?skip=${skip}&limit=${limit}`),
  sendMessage: (trackingId: string, content: string) =>
    api.post<MessageResponse>(`/messages/package/${trackingId}`, { content }),
  markAsRead: (messageId: number) =>
    api.put<MessageResponse>(`/messages/${messageId}/read`),
  markAllAsRead: (trackingId: string) =>
    api.put(`/messages/package/${trackingId}/read-all`),
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
  tracking_id: string
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

// Delivery Proof Types
export interface DeliveryProofCreate {
  photo_s3_key?: string
  signature_s3_key?: string
  signature_data?: string  // Base64 encoded signature from canvas
  recipient_name?: string
  recipient_relationship?: string
  notes?: string
  latitude?: number
  longitude?: number
  location_accuracy_meters?: number
  captured_at: string
}

export interface DeliveryProofResponse {
  id: number
  package_id: number
  courier_id: number
  photo_url: string | null
  signature_url: string | null
  recipient_name: string | null
  recipient_relationship: string | null
  notes: string | null
  latitude: number | null
  longitude: number | null
  distance_from_dropoff_meters: number | null
  is_verified: boolean
  proof_type: 'photo' | 'signature' | 'both' | 'none'
  captured_at: string
  created_at: string
}

export interface UploadUrlResponse {
  upload_url: string
  key: string
  fields: Record<string, string>
}

// Delivery Proof API
export const proofAPI = {
  getUploadUrl: (trackingId: string, fileType: 'photo' | 'signature', contentType: string = 'image/jpeg') =>
    api.post<UploadUrlResponse>(`/proof/upload-url/${trackingId}`, {
      file_type: fileType,
      content_type: contentType,
    }),

  create: (trackingId: string, data: DeliveryProofCreate) =>
    api.post<DeliveryProofResponse>(`/proof/${trackingId}`, data),

  get: (trackingId: string) =>
    api.get<DeliveryProofResponse>(`/proof/${trackingId}`),

  getPhotoUrl: (trackingId: string) =>
    api.get<{ url: string; expires_in: number }>(`/proof/${trackingId}/photo`),

  getSignatureUrl: (trackingId: string) =>
    api.get<{ url: string; expires_in: number }>(`/proof/${trackingId}/signature`),

  uploadToS3: async (uploadUrl: string, fields: Record<string, string>, file: File): Promise<void> => {
    const formData = new FormData()
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value)
    })
    formData.append('file', file)

    await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })
  },
}

// Payment Types
export interface PaymentMethod {
  id: number
  stripe_payment_method_id: string
  card_brand: string | null
  card_last_four: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  is_default: boolean
  created_at: string
}

export interface Transaction {
  id: number
  package_id: number
  sender_id: number
  courier_id: number | null
  amount_cents: number
  platform_fee_cents: number
  courier_payout_cents: number
  currency: string
  status: 'pending' | 'requires_payment' | 'processing' | 'succeeded' | 'failed' | 'refunded'
  refund_amount_cents: number
  created_at: string
  completed_at: string | null
}

export interface SetupIntentResponse {
  client_secret: string
  setup_intent_id: string
}

export interface ConnectAccount {
  id: number
  stripe_account_id: string
  onboarding_complete: boolean
  details_submitted: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  created_at: string
}

export interface CourierBalance {
  pending_cents: number
  available_cents: number
  pending_dollars: number
  available_dollars: number
}

export interface EarningsSummary {
  total_earnings_cents: number
  total_deliveries: number
  pending_payout_cents: number
  last_payout_at: string | null
}

export interface Payout {
  id: number
  courier_id: number
  amount_cents: number
  currency: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  transaction_ids: number[]
  created_at: string
  completed_at: string | null
}

// Payments API
export const paymentsAPI = {
  // Setup Intent for saving cards
  createSetupIntent: () =>
    api.post<SetupIntentResponse>('/payments/setup-intent'),

  // Payment Methods
  addPaymentMethod: (paymentMethodId: string, setAsDefault: boolean = true) =>
    api.post<PaymentMethod>('/payments/methods', {
      payment_method_id: paymentMethodId,
      set_as_default: setAsDefault,
    }),

  listPaymentMethods: () =>
    api.get<PaymentMethod[]>('/payments/methods'),

  deletePaymentMethod: (methodId: number) =>
    api.delete(`/payments/methods/${methodId}`),

  setDefaultPaymentMethod: (methodId: number) =>
    api.put(`/payments/methods/${methodId}/default`),

  // Transactions
  chargeForDelivery: (packageId: number, paymentMethodId?: string) =>
    api.post<Transaction>(`/payments/charge/${packageId}`, {
      payment_method_id: paymentMethodId,
    }),

  listTransactions: (skip: number = 0, limit: number = 20) =>
    api.get<Transaction[]>(`/payments/transactions?skip=${skip}&limit=${limit}`),

  getTransaction: (transactionId: number) =>
    api.get<Transaction>(`/payments/transactions/${transactionId}`),

  refundTransaction: (transactionId: number, amountCents?: number, reason?: string) =>
    api.post<Transaction>(`/payments/transactions/${transactionId}/refund`, {
      amount_cents: amountCents,
      reason: reason || '',
    }),
}

// Payouts API (for couriers)
export const payoutsAPI = {
  // Connect Account
  createConnectAccount: () =>
    api.post<ConnectAccount>('/payouts/connect-account'),

  getConnectAccount: () =>
    api.get<ConnectAccount | null>('/payouts/connect-account'),

  refreshConnectAccount: () =>
    api.post<ConnectAccount>('/payouts/connect-account/refresh'),

  getOnboardingLink: (returnUrl: string, refreshUrl: string) =>
    api.post<{ url: string }>('/payouts/connect-onboarding', {
      return_url: returnUrl,
      refresh_url: refreshUrl,
    }),

  getDashboardLink: () =>
    api.get<{ url: string }>('/payouts/connect-dashboard'),

  // Balance & Earnings
  getBalance: () =>
    api.get<CourierBalance>('/payouts/balance'),

  getEarnings: () =>
    api.get<EarningsSummary>('/payouts/earnings'),

  // Payouts
  requestPayout: (transactionIds?: number[]) =>
    api.post<Payout>('/payouts/request', {
      transaction_ids: transactionIds,
    }),

  getPayoutHistory: (skip: number = 0, limit: number = 20) =>
    api.get<Payout[]>(`/payouts/history?skip=${skip}&limit=${limit}`),

  getPayout: (payoutId: number) =>
    api.get<Payout>(`/payouts/history/${payoutId}`),
}

// Tracking Types
export interface TrackingSession {
  id: number
  package_id: number
  courier_id: number
  is_active: boolean
  started_at: string
  ended_at: string | null
  last_latitude: number | null
  last_longitude: number | null
  last_location_at: string | null
  estimated_arrival: string | null
  distance_remaining_meters: number | null
  share_live_location: boolean
}

export interface LocationUpdate {
  latitude: number
  longitude: number
  heading: number | null
  speed_mps: number | null
  timestamp: string
  estimated_arrival: string | null
  distance_remaining_meters: number | null
}

export interface LocationHistory {
  id: number
  latitude: number
  longitude: number
  accuracy_meters: number | null
  heading: number | null
  speed_mps: number | null
  timestamp: string
  source: string
}

export interface TrackingEvent {
  id: number
  event_type: string
  description: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  extra_data: string | null
}

export interface LocationUpdateRequest {
  latitude: number
  longitude: number
  accuracy_meters?: number
  altitude_meters?: number
  heading?: number
  speed_mps?: number
  battery_level?: number
  source?: string
}

export interface StartTrackingRequest {
  initial_latitude?: number
  initial_longitude?: number
  share_live_location?: boolean
}

export interface ReportDelayRequest {
  reason: string
  estimated_delay_minutes: number
  latitude?: number
  longitude?: number
}

// Tracking API
export const trackingAPI = {
  // Courier endpoints
  startTracking: (trackingId: string, data?: StartTrackingRequest) =>
    api.post<TrackingSession>(`/tracking/sessions/${trackingId}/start`, data || {}),

  endTracking: (sessionId: number) =>
    api.post<TrackingSession>(`/tracking/sessions/${sessionId}/end`),

  updateLocation: (sessionId: number, data: LocationUpdateRequest) =>
    api.post<LocationUpdate>(`/tracking/sessions/${sessionId}/location`, data),

  reportDelay: (sessionId: number, data: ReportDelayRequest) =>
    api.post<TrackingEvent>(`/tracking/sessions/${sessionId}/delay`, data),

  // Public/sender endpoints
  getCurrentLocation: (trackingId: string) =>
    api.get<LocationUpdate>(`/tracking/packages/${trackingId}/location`),

  getActiveSession: (trackingId: string) =>
    api.get<TrackingSession>(`/tracking/packages/${trackingId}/session`),

  getLocationHistory: (sessionId: number, limit: number = 100, since?: string) =>
    api.get<LocationHistory[]>(
      `/tracking/sessions/${sessionId}/history?limit=${limit}${since ? `&since=${since}` : ''}`
    ),

  getTrackingEvents: (sessionId: number) =>
    api.get<TrackingEvent[]>(`/tracking/sessions/${sessionId}/events`),
}

// Analytics Types
export interface PlatformOverview {
  total_users: number
  total_senders: number
  total_couriers: number
  total_packages: number
  packages_delivered: number
  packages_in_transit: number
  total_revenue_cents: number
  platform_fees_cents: number
  average_rating: number | null
}

export interface DailyMetrics {
  date: string
  packages_created: number
  packages_matched: number
  packages_delivered: number
  packages_cancelled: number
  new_users: number
  active_senders: number
  active_couriers: number
  total_transaction_amount: number
  total_platform_fees: number
  average_delivery_time_minutes: number | null
  average_rating: number | null
  successful_delivery_rate: number | null
}

export interface RevenueBreakdown {
  total_cents: number
  platform_fees_cents: number
  courier_payouts_cents: number
  refunds_cents: number
  net_revenue_cents: number
}

export interface TopCourier {
  courier_id: number
  name: string
  deliveries: number
  rating: number | null
  earnings_cents: number
}

export interface HourlyActivity {
  hour: number
  packages_created: number
  packages_delivered: number
  active_couriers: number
}

export interface CourierPerformance {
  courier_id: number
  courier_name: string | null
  total_deliveries: number
  successful_deliveries: number
  on_time_deliveries: number
  average_delivery_time: number | null
  average_rating: number | null
  total_earnings: number
  earnings_this_month: number
  current_streak: number
  last_delivery_at: string | null
}

export interface TimeSeriesPoint {
  date: string
  value: number
}

export interface MonthlyPackageCount {
  month: string
  count: number
}

export interface SenderStatsResponse {
  total_packages: number
  packages_this_month: number
  status_breakdown: Record<string, number>
  delivery_rate: number
  total_spent: number
  average_delivery_time_hours: number | null
  packages_by_month: MonthlyPackageCount[]
}

export interface CourierStatsResponse {
  total_deliveries: number
  deliveries_this_month: number
  total_bids_placed: number
  bids_won: number
  bid_win_rate: number
  status_breakdown: Record<string, number>
  delivery_rate: number
  total_earnings: number
  earnings_this_month: number
  average_rating: number | null
  average_delivery_time_hours: number | null
  deliveries_by_month: MonthlyPackageCount[]
}

// Analytics API
export const analyticsAPI = {
  // Admin endpoints
  getOverview: () =>
    api.get<PlatformOverview>('/analytics/overview'),

  getDailyMetrics: (startDate?: string, endDate?: string, days: number = 30) =>
    api.get<DailyMetrics[]>(
      `/analytics/daily-metrics?days=${days}${startDate ? `&start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`
    ),

  getRevenue: (startDate?: string, endDate?: string) =>
    api.get<RevenueBreakdown>(
      `/analytics/revenue${startDate ? `?start_date=${startDate}` : ''}${endDate ? `${startDate ? '&' : '?'}end_date=${endDate}` : ''}`
    ),

  getTopCouriers: (limit: number = 10, periodDays: number = 30) =>
    api.get<TopCourier[]>(`/analytics/top-couriers?limit=${limit}&period_days=${periodDays}`),

  getHourlyActivity: (date?: string) =>
    api.get<HourlyActivity[]>(`/analytics/hourly-activity${date ? `?date_str=${date}` : ''}`),

  getPackagesTrend: (days: number = 30) =>
    api.get<TimeSeriesPoint[]>(`/analytics/packages-trend?days=${days}`),

  getRevenueTrend: (days: number = 30) =>
    api.get<TimeSeriesPoint[]>(`/analytics/revenue-trend?days=${days}`),

  // Courier endpoints
  getMyPerformance: () =>
    api.get<CourierPerformance>('/analytics/my-performance'),

  getCourierLeaderboard: (metric: 'deliveries' | 'rating' | 'earnings' = 'deliveries', limit: number = 10) =>
    api.get<CourierPerformance[]>(`/analytics/courier-leaderboard?metric=${metric}&limit=${limit}`),

  // Sender endpoints
  getSenderStats: () =>
    api.get<SenderStatsResponse>('/analytics/sender-stats'),

  // Courier endpoints (stats)
  getCourierStats: () =>
    api.get<CourierStatsResponse>('/analytics/courier-stats'),
}

// Bid Types
export type BidStatus = 'pending' | 'selected' | 'rejected' | 'withdrawn' | 'expired'

export interface BidCreate {
  tracking_id: string
  proposed_price: number
  estimated_delivery_hours?: number
  estimated_pickup_time?: string
  message?: string
  route_id?: number
}

export interface BidResponse {
  id: number
  package_id: number
  courier_id: number
  courier_name: string
  courier_rating: number | null
  courier_total_ratings: number
  proposed_price: number
  estimated_delivery_hours: number | null
  estimated_pickup_time: string | null
  message: string | null
  status: BidStatus
  created_at: string
  selected_at: string | null
}

export interface PackageBidsResponse {
  bids: BidResponse[]
  bid_deadline: string | null
  bid_count: number
}

// Bids API
export const bidsAPI = {
  // Create a bid on a package
  create: (data: BidCreate) =>
    api.post<BidResponse>('/bids', data),

  // Withdraw a pending bid
  withdraw: (bidId: number) =>
    api.delete(`/bids/${bidId}`),

  // Select a bid (sender only)
  select: (bidId: number) =>
    api.post<BidResponse>(`/bids/${bidId}/select`),

  // Get courier's bids with optional status filter
  getMyBids: (status?: BidStatus) =>
    api.get<BidResponse[]>(`/bids/my-bids${status ? `?status_filter=${status}` : ''}`),

  // Get all bids for a package
  getPackageBids: (trackingId: string) =>
    api.get<PackageBidsResponse>(`/bids/package/${trackingId}`),

  // Courier confirms pickup (transitions package to PENDING_PICKUP)
  confirmPickup: (bidId: number) =>
    api.post(`/bids/${bidId}/confirm-pickup`),
}

// Package Note Types
export type NoteAuthorType = 'SENDER' | 'COURIER' | 'SYSTEM'

export interface NoteCreate {
  content: string
}

export interface PackageNoteResponse {
  id: number
  package_id: number
  author_id: number | null
  author_type: NoteAuthorType
  author_name: string | null
  content: string
  created_at: string
}

// Notes API
export const notesAPI = {
  // Get all notes for a package
  getPackageNotes: (trackingId: string) =>
    api.get<PackageNoteResponse[]>(`/packages/${trackingId}/notes`),

  // Add a note to a package
  addNote: (trackingId: string, content: string) =>
    api.post<PackageNoteResponse>(`/packages/${trackingId}/notes`, { content }),
}
