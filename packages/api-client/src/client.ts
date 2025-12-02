// Platform-agnostic API client
import type {
  RegisterData,
  LoginData,
  UserResponse,
  AuthResponse,
  MessageResponse as GenericMessageResponse,
  UserUpdate,
  ForgotPasswordData,
  ResetPasswordData,
  PackageCreate,
  PackageResponse,
  AcceptanceStatus,
  RouteCreate,
  RouteResponse,
  MatchedPackage,
  MatchedCouriersResponse,
  NotificationListResponse,
  NotificationCountResponse,
  NotificationResponse,
  RatingCreate,
  RatingResponse,
  RatingListResponse,
  UserRatingSummary,
  PendingRating,
  MessageResponse,
  MessageListResponse,
  ConversationListResponse,
  MessageUnreadCountResponse,
  DeliveryProofCreate,
  DeliveryProofResponse,
  UploadUrlResponse,
  PaymentMethod,
  Transaction,
  SetupIntentResponse,
  ConnectAccount,
  CourierBalance,
  EarningsSummary,
  Payout,
  TrackingSession,
  LocationUpdate,
  LocationHistory,
  TrackingEvent,
  LocationUpdateRequest,
  StartTrackingRequest,
  ReportDelayRequest,
  BidCreate,
  BidResponse,
  BidStatus,
  PackageBidsResponse,
  PackageNoteResponse,
  IDVerificationStatusResponse,
  StartVerificationResponse,
  VerificationResponse,
  SenderStatsResponse,
  CourierStatsResponse,
  CourierPerformance,
} from '@chaski/shared-types'
import type { HttpClient } from './types'

export function createApiClient(httpClient: HttpClient) {
  // Auth API
  const authAPI = {
    register: (data: RegisterData) =>
      httpClient.post<UserResponse>('/auth/register', data),
    login: (data: LoginData) =>
      httpClient.post<AuthResponse>('/auth/login', data),
    logout: () =>
      httpClient.post<AuthResponse>('/auth/logout'),
    getCurrentUser: () =>
      httpClient.get<UserResponse>('/auth/me'),
    updateProfile: (data: UserUpdate) =>
      httpClient.put<UserResponse>('/auth/me', data),
    forgotPassword: (data: ForgotPasswordData) =>
      httpClient.post<GenericMessageResponse>('/auth/forgot-password', data),
    resetPassword: (data: ResetPasswordData) =>
      httpClient.post<GenericMessageResponse>('/auth/reset-password', data),
    // Phone verification
    sendPhoneCode: () =>
      httpClient.post<GenericMessageResponse>('/auth/phone/send-code'),
    verifyPhoneCode: (code: string) =>
      httpClient.post<GenericMessageResponse>('/auth/phone/verify', { code }),
    resendPhoneCode: () =>
      httpClient.post<GenericMessageResponse>('/auth/phone/resend-code'),
  }

  // Verification API (public endpoints)
  const verificationAPI = {
    verifyEmail: (token: string) =>
      httpClient.get(`/auth/verify-email/${token}`),
    resendVerification: (email: string) =>
      httpClient.post(`/auth/resend-verification?email=${encodeURIComponent(email)}`),
  }

  // Packages API
  const packagesAPI = {
    create: (data: PackageCreate) =>
      httpClient.post<PackageResponse>('/packages', data),
    getAll: () =>
      httpClient.get<PackageResponse[]>('/packages'),
    getByTrackingId: (trackingId: string) =>
      httpClient.get<PackageResponse>(`/packages/${trackingId}`),
    update: (trackingId: string, data: Partial<PackageCreate>) =>
      httpClient.put<PackageResponse>(`/packages/${trackingId}`, data),
    updateStatus: (trackingId: string, status: string) =>
      httpClient.put(`/packages/${trackingId}/status`, { status }),
    cancel: (trackingId: string) =>
      httpClient.put<PackageResponse>(`/packages/${trackingId}/cancel`),
    accept: (trackingId: string) =>
      httpClient.post<PackageResponse>(`/packages/${trackingId}/accept`),
    getAcceptanceStatus: (trackingId: string) =>
      httpClient.get<AcceptanceStatus>(`/packages/${trackingId}/acceptance-status`),
  }

  // Couriers API
  const couriersAPI = {
    createRoute: (data: RouteCreate) =>
      httpClient.post<RouteResponse>('/couriers/routes', data),
    getRoutes: () =>
      httpClient.get<RouteResponse[]>('/couriers/routes'),
    getRoute: (id: number) =>
      httpClient.get<RouteResponse>(`/couriers/routes/${id}`),
    deleteRoute: (id: number) =>
      httpClient.delete(`/couriers/routes/${id}`),
    activateRoute: (id: number) =>
      httpClient.put<RouteResponse>(`/couriers/routes/${id}/activate`),
  }

  // Matching API
  const matchingAPI = {
    getPackagesAlongRoute: (routeId: number) =>
      httpClient.get<MatchedPackage[]>(`/matching/packages-along-route/${routeId}`),
    acceptPackage: (packageId: number) =>
      httpClient.post(`/matching/accept-package/${packageId}`),
    declinePackage: (packageId: number) =>
      httpClient.post(`/matching/decline-package/${packageId}`),
    getOptimizedRoute: (routeId: number) =>
      httpClient.get(`/matching/optimized-route/${routeId}`),
    getMatchedCouriers: (trackingId: string) =>
      httpClient.get<MatchedCouriersResponse>(`/matching/matched-couriers/${trackingId}`),
  }

  // Notifications API
  const notificationsAPI = {
    getAll: (unreadOnly: boolean = false) =>
      httpClient.get<NotificationListResponse>(`/notifications/${unreadOnly ? '?unread_only=true' : ''}`),
    getUnreadCount: () =>
      httpClient.get<NotificationCountResponse>('/notifications/unread-count'),
    markAsRead: (id: number) =>
      httpClient.put<NotificationResponse>(`/notifications/${id}/read`),
    markAllAsRead: () =>
      httpClient.put('/notifications/mark-read', {}),
    delete: (id: number) =>
      httpClient.delete(`/notifications/${id}`),
  }

  // Ratings API
  const ratingsAPI = {
    create: (data: RatingCreate) =>
      httpClient.post<RatingResponse>('/ratings', data),
    getUserRatings: (userId: number, skip: number = 0, limit: number = 20) =>
      httpClient.get<RatingListResponse>(`/ratings/user/${userId}?skip=${skip}&limit=${limit}`),
    getUserRatingSummary: (userId: number) =>
      httpClient.get<UserRatingSummary>(`/ratings/user/${userId}/summary`),
    getPackageRatings: (trackingId: string) =>
      httpClient.get<RatingResponse[]>(`/ratings/package/${trackingId}`),
    getMyPendingRatings: () =>
      httpClient.get<PendingRating[]>('/ratings/my-pending'),
  }

  // Messages API
  const messagesAPI = {
    getConversations: (skip: number = 0, limit: number = 20) =>
      httpClient.get<ConversationListResponse>(`/messages/conversations?skip=${skip}&limit=${limit}`),
    getPackageMessages: (trackingId: string, skip: number = 0, limit: number = 50) =>
      httpClient.get<MessageListResponse>(`/messages/package/${trackingId}?skip=${skip}&limit=${limit}`),
    sendMessage: (trackingId: string, content: string) =>
      httpClient.post<MessageResponse>(`/messages/package/${trackingId}`, { content }),
    markAsRead: (messageId: number) =>
      httpClient.put<MessageResponse>(`/messages/${messageId}/read`),
    markAllAsRead: (trackingId: string) =>
      httpClient.put(`/messages/package/${trackingId}/read-all`),
    getUnreadCount: () =>
      httpClient.get<MessageUnreadCountResponse>('/messages/unread-count'),
  }

  // Delivery Proof API
  const proofAPI = {
    getUploadUrl: (trackingId: string, fileType: 'photo' | 'signature', contentType: string = 'image/jpeg') =>
      httpClient.post<UploadUrlResponse>(`/proof/upload-url/${trackingId}`, {
        file_type: fileType,
        content_type: contentType,
      }),
    create: (trackingId: string, data: DeliveryProofCreate) =>
      httpClient.post<DeliveryProofResponse>(`/proof/${trackingId}`, data),
    get: (trackingId: string) =>
      httpClient.get<DeliveryProofResponse>(`/proof/${trackingId}`),
    getPhotoUrl: (trackingId: string) =>
      httpClient.get<{ url: string; expires_in: number }>(`/proof/${trackingId}/photo`),
    getSignatureUrl: (trackingId: string) =>
      httpClient.get<{ url: string; expires_in: number }>(`/proof/${trackingId}/signature`),
  }

  // Payments API
  const paymentsAPI = {
    createSetupIntent: () =>
      httpClient.post<SetupIntentResponse>('/payments/setup-intent'),
    addPaymentMethod: (paymentMethodId: string, setAsDefault: boolean = true) =>
      httpClient.post<PaymentMethod>('/payments/methods', {
        payment_method_id: paymentMethodId,
        set_as_default: setAsDefault,
      }),
    listPaymentMethods: () =>
      httpClient.get<PaymentMethod[]>('/payments/methods'),
    deletePaymentMethod: (methodId: number) =>
      httpClient.delete(`/payments/methods/${methodId}`),
    setDefaultPaymentMethod: (methodId: number) =>
      httpClient.put(`/payments/methods/${methodId}/default`),
    chargeForDelivery: (packageId: number, paymentMethodId?: string) =>
      httpClient.post<Transaction>(`/payments/charge/${packageId}`, {
        payment_method_id: paymentMethodId,
      }),
    listTransactions: (skip: number = 0, limit: number = 20) =>
      httpClient.get<Transaction[]>(`/payments/transactions?skip=${skip}&limit=${limit}`),
    getTransaction: (transactionId: number) =>
      httpClient.get<Transaction>(`/payments/transactions/${transactionId}`),
    refundTransaction: (transactionId: number, amountCents?: number, reason?: string) =>
      httpClient.post<Transaction>(`/payments/transactions/${transactionId}/refund`, {
        amount_cents: amountCents,
        reason: reason || '',
      }),
  }

  // Payouts API (for couriers)
  const payoutsAPI = {
    createConnectAccount: () =>
      httpClient.post<ConnectAccount>('/payouts/connect-account'),
    getConnectAccount: () =>
      httpClient.get<ConnectAccount | null>('/payouts/connect-account'),
    refreshConnectAccount: () =>
      httpClient.post<ConnectAccount>('/payouts/connect-account/refresh'),
    getOnboardingLink: (returnUrl: string, refreshUrl: string) =>
      httpClient.post<{ url: string }>('/payouts/connect-onboarding', {
        return_url: returnUrl,
        refresh_url: refreshUrl,
      }),
    getDashboardLink: () =>
      httpClient.get<{ url: string }>('/payouts/connect-dashboard'),
    getBalance: () =>
      httpClient.get<CourierBalance>('/payouts/balance'),
    getEarnings: () =>
      httpClient.get<EarningsSummary>('/payouts/earnings'),
    requestPayout: (transactionIds?: number[]) =>
      httpClient.post<Payout>('/payouts/request', {
        transaction_ids: transactionIds,
      }),
    getPayoutHistory: (skip: number = 0, limit: number = 20) =>
      httpClient.get<Payout[]>(`/payouts/history?skip=${skip}&limit=${limit}`),
    getPayout: (payoutId: number) =>
      httpClient.get<Payout>(`/payouts/history/${payoutId}`),
  }

  // Tracking API
  const trackingAPI = {
    startTracking: (trackingId: string, data?: StartTrackingRequest) =>
      httpClient.post<TrackingSession>(`/tracking/sessions/${trackingId}/start`, data || {}),
    endTracking: (sessionId: number) =>
      httpClient.post<TrackingSession>(`/tracking/sessions/${sessionId}/end`),
    updateLocation: (sessionId: number, data: LocationUpdateRequest) =>
      httpClient.post<LocationUpdate>(`/tracking/sessions/${sessionId}/location`, data),
    reportDelay: (sessionId: number, data: ReportDelayRequest) =>
      httpClient.post<TrackingEvent>(`/tracking/sessions/${sessionId}/delay`, data),
    getCurrentLocation: (trackingId: string) =>
      httpClient.get<LocationUpdate>(`/tracking/packages/${trackingId}/location`),
    getActiveSession: (trackingId: string) =>
      httpClient.get<TrackingSession>(`/tracking/packages/${trackingId}/session`),
    getLocationHistory: (sessionId: number, limit: number = 100, since?: string) =>
      httpClient.get<LocationHistory[]>(
        `/tracking/sessions/${sessionId}/history?limit=${limit}${since ? `&since=${since}` : ''}`
      ),
    getTrackingEvents: (sessionId: number) =>
      httpClient.get<TrackingEvent[]>(`/tracking/sessions/${sessionId}/events`),
  }

  // Bids API
  const bidsAPI = {
    create: (data: BidCreate) =>
      httpClient.post<BidResponse>('/bids', data),
    withdraw: (bidId: number) =>
      httpClient.delete(`/bids/${bidId}`),
    select: (bidId: number) =>
      httpClient.post<BidResponse>(`/bids/${bidId}/select`),
    getMyBids: (status?: BidStatus) =>
      httpClient.get<BidResponse[]>(`/bids/my-bids${status ? `?status_filter=${status}` : ''}`),
    getPackageBids: (trackingId: string) =>
      httpClient.get<PackageBidsResponse>(`/bids/package/${trackingId}`),
    confirmPickup: (bidId: number) =>
      httpClient.post(`/bids/${bidId}/confirm-pickup`),
  }

  // Notes API
  const notesAPI = {
    getPackageNotes: (trackingId: string) =>
      httpClient.get<PackageNoteResponse[]>(`/packages/${trackingId}/notes`),
    addNote: (trackingId: string, content: string) =>
      httpClient.post<PackageNoteResponse>(`/packages/${trackingId}/notes`, { content }),
  }

  // ID Verification API
  const idVerificationAPI = {
    getStatus: () =>
      httpClient.get<IDVerificationStatusResponse>('/id-verification/status'),
    startVerification: (returnUrl: string) =>
      httpClient.post<StartVerificationResponse>('/id-verification/start', { return_url: returnUrl }),
    getHistory: () =>
      httpClient.get<VerificationResponse[]>('/id-verification/history'),
    cancelVerification: () =>
      httpClient.post('/id-verification/cancel'),
  }

  // Analytics API (non-admin endpoints)
  const analyticsAPI = {
    getMyPerformance: () =>
      httpClient.get<CourierPerformance>('/analytics/my-performance'),
    getCourierLeaderboard: (metric: 'deliveries' | 'rating' | 'earnings' = 'deliveries', limit: number = 10) =>
      httpClient.get<CourierPerformance[]>(`/analytics/courier-leaderboard?metric=${metric}&limit=${limit}`),
    getSenderStats: () =>
      httpClient.get<SenderStatsResponse>('/analytics/sender-stats'),
    getCourierStats: () =>
      httpClient.get<CourierStatsResponse>('/analytics/courier-stats'),
  }

  return {
    authAPI,
    verificationAPI,
    packagesAPI,
    couriersAPI,
    matchingAPI,
    notificationsAPI,
    ratingsAPI,
    messagesAPI,
    proofAPI,
    paymentsAPI,
    payoutsAPI,
    trackingAPI,
    bidsAPI,
    notesAPI,
    idVerificationAPI,
    analyticsAPI,
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
