// Auth Types
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
  phone_verified: boolean
  id_verified: boolean
  max_deviation_km: number
  default_address: string | null
  default_address_lat: number | null
  default_address_lng: number | null
  preferred_language: string
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

export interface ForgotPasswordData {
  email: string
}

export interface ResetPasswordData {
  token: string
  new_password: string
}

export interface UserUpdate {
  full_name?: string
  phone_number?: string
  max_deviation_km?: number
  default_address?: string
  default_address_lat?: number
  default_address_lng?: number
}

// Package Types
export type PackageSize = 'small' | 'medium' | 'large' | 'extra_large'

export interface PackageCreate {
  description: string
  size: PackageSize
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
  requires_proof?: boolean
  sender_id?: number // Admin only
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
  status_changed_at: string | null
  matched_at: string | null
  accepted_at: string | null
  picked_up_at: string | null
  in_transit_at: string | null
  sender_accepted: boolean
  courier_accepted: boolean
  sender_accepted_at: string | null
  courier_accepted_at: string | null
  allowed_next_statuses: string[]
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

export interface MatchedCourier {
  courier_id: number
  courier_name: string
  courier_email: string
  average_rating: number | null
  total_ratings: number
  total_deliveries: number
  route_id: number
  route_start_address: string
  route_end_address: string
  max_deviation_km: number
  distance_from_route_km: number
  estimated_detour_km: number
  has_bid: boolean
  bid_status: string | null
  bid_proposed_price: number | null
}

export interface MatchedCouriersResponse {
  package_id: number
  tracking_id: string
  total_matched_couriers: number
  couriers_with_bids: number
  matched_couriers: MatchedCourier[]
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
  | 'new_bid_received'
  | 'bid_selected'
  | 'bid_rejected'
  | 'bid_withdrawn'
  | 'bid_deadline_warning'
  | 'bid_deadline_extended'
  | 'bid_deadline_expired'
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

// Delivery Proof Types
export interface DeliveryProofCreate {
  photo_s3_key?: string
  signature_s3_key?: string
  signature_data?: string
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

// ID Verification Types
export type IDVerificationStatus =
  | 'pending'
  | 'processing'
  | 'verified'
  | 'failed'
  | 'requires_review'
  | 'admin_approved'
  | 'admin_rejected'
  | 'expired'

export interface IDVerificationStatusResponse {
  is_verified: boolean
  status: IDVerificationStatus | null
  can_start_verification: boolean
  verification: {
    id: number
    status: IDVerificationStatus
    created_at: string | null
    completed_at: string | null
    rejection_reason: string | null
    failure_reason: string | null
  } | null
}

export interface StartVerificationResponse {
  session_id: string
  url: string
  verification_id: number
}

export interface VerificationResponse {
  id: number
  user_id: number
  status: IDVerificationStatus
  document_type: string | null
  document_country: string | null
  created_at: string
  submitted_at: string | null
  completed_at: string | null
  rejection_reason: string | null
  failure_reason: string | null
  reviewed_at: string | null
}

export interface AdminVerificationResponse extends VerificationResponse {
  user_email: string | null
  user_full_name: string | null
  failure_code: string | null
  reviewed_by_admin_id: number | null
  admin_notes: string | null
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
  phone_verified: boolean
  id_verified: boolean
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
  pickup_lat: number
  pickup_lng: number
  dropoff_address: string
  dropoff_lat: number
  dropoff_lng: number
  status: string
  price: number
  is_active: boolean
  created_at: string
  bid_count: number
  matched_routes_count: number
  has_selected_bid: boolean
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

export interface AdminRouteCreate {
  courier_id: number
  start_address: string
  start_lat: number
  start_lng: number
  end_address: string
  end_lat: number
  end_lng: number
  max_deviation_km?: number
  departure_time?: string | null
  trip_date?: string | null
}

export interface AdminRoute {
  id: number
  courier_id: number
  courier_name: string
  courier_email: string
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

// Generic message response
export interface GenericMessageResponse {
  message: string
}
