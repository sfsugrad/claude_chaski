import api, {
  authAPI,
  packagesAPI,
  couriersAPI,
  matchingAPI,
  notificationsAPI,
  ratingsAPI,
  messagesAPI,
} from '../api'

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: {
        use: jest.fn(),
      },
      response: {
        use: jest.fn(),
      },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
  return {
    create: jest.fn(() => mockAxiosInstance),
    ...mockAxiosInstance,
  }
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('authAPI', () => {
    it('has register method', () => {
      expect(authAPI.register).toBeDefined()
      expect(typeof authAPI.register).toBe('function')
    })

    it('has login method', () => {
      expect(authAPI.login).toBeDefined()
      expect(typeof authAPI.login).toBe('function')
    })

    it('has getCurrentUser method', () => {
      expect(authAPI.getCurrentUser).toBeDefined()
      expect(typeof authAPI.getCurrentUser).toBe('function')
    })

    it('register calls api.post with correct endpoint', () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User',
        role: 'sender' as const,
      }
      authAPI.register(registerData)
      expect(api.post).toHaveBeenCalledWith('/auth/register', registerData)
    })

    it('login calls api.post with correct endpoint', () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      }
      authAPI.login(loginData)
      expect(api.post).toHaveBeenCalledWith('/auth/login', loginData)
    })

    it('getCurrentUser calls api.get with correct endpoint', () => {
      authAPI.getCurrentUser()
      expect(api.get).toHaveBeenCalledWith('/auth/me')
    })
  })

  describe('packagesAPI', () => {
    it('create calls api.post with correct endpoint', () => {
      const packageData = {
        description: 'Test package',
        size: 'small' as const,
        weight_kg: 1,
        pickup_address: '123 Pickup St',
        pickup_lat: 37.7749,
        pickup_lng: -122.4194,
        dropoff_address: '456 Dropoff Ave',
        dropoff_lat: 37.7849,
        dropoff_lng: -122.4294,
      }
      packagesAPI.create(packageData)
      expect(api.post).toHaveBeenCalledWith('/packages', packageData)
    })

    it('getAll calls api.get with correct endpoint', () => {
      packagesAPI.getAll()
      expect(api.get).toHaveBeenCalledWith('/packages')
    })

    it('getById calls api.get with correct endpoint', () => {
      packagesAPI.getById(123)
      expect(api.get).toHaveBeenCalledWith('/packages/123')
    })

    it('updateStatus calls api.put with correct endpoint', () => {
      packagesAPI.updateStatus(123, 'in_transit')
      expect(api.put).toHaveBeenCalledWith('/packages/123/status', { status: 'in_transit' })
    })

    it('cancel calls api.put with correct endpoint', () => {
      packagesAPI.cancel(123)
      expect(api.put).toHaveBeenCalledWith('/packages/123/cancel')
    })
  })

  describe('couriersAPI', () => {
    it('createRoute calls api.post with correct endpoint', () => {
      const routeData = {
        start_address: '123 Start St',
        start_lat: 37.7749,
        start_lng: -122.4194,
        end_address: '456 End Ave',
        end_lat: 37.7849,
        end_lng: -122.4294,
        max_deviation_km: 5,
      }
      couriersAPI.createRoute(routeData)
      expect(api.post).toHaveBeenCalledWith('/couriers/routes', routeData)
    })

    it('getRoutes calls api.get with correct endpoint', () => {
      couriersAPI.getRoutes()
      expect(api.get).toHaveBeenCalledWith('/couriers/routes')
    })

    it('getRoute calls api.get with correct endpoint', () => {
      couriersAPI.getRoute(123)
      expect(api.get).toHaveBeenCalledWith('/couriers/routes/123')
    })

    it('deleteRoute calls api.delete with correct endpoint', () => {
      couriersAPI.deleteRoute(123)
      expect(api.delete).toHaveBeenCalledWith('/couriers/routes/123')
    })

    it('activateRoute calls api.put with correct endpoint', () => {
      couriersAPI.activateRoute(123)
      expect(api.put).toHaveBeenCalledWith('/couriers/routes/123/activate')
    })
  })

  describe('matchingAPI', () => {
    it('getPackagesAlongRoute calls api.get with correct endpoint', () => {
      matchingAPI.getPackagesAlongRoute(123)
      expect(api.get).toHaveBeenCalledWith('/matching/packages-along-route/123')
    })

    it('acceptPackage calls api.post with correct endpoint', () => {
      matchingAPI.acceptPackage(123)
      expect(api.post).toHaveBeenCalledWith('/matching/accept-package/123')
    })

    it('declinePackage calls api.post with correct endpoint', () => {
      matchingAPI.declinePackage(123)
      expect(api.post).toHaveBeenCalledWith('/matching/decline-package/123')
    })

    it('getOptimizedRoute calls api.get with correct endpoint', () => {
      matchingAPI.getOptimizedRoute(123)
      expect(api.get).toHaveBeenCalledWith('/matching/optimized-route/123')
    })
  })

  describe('notificationsAPI', () => {
    it('getAll calls api.get with correct endpoint', () => {
      notificationsAPI.getAll()
      expect(api.get).toHaveBeenCalledWith('/notifications/')
    })

    it('getAll with unreadOnly calls api.get with query param', () => {
      notificationsAPI.getAll(true)
      expect(api.get).toHaveBeenCalledWith('/notifications/?unread_only=true')
    })

    it('getUnreadCount calls api.get with correct endpoint', () => {
      notificationsAPI.getUnreadCount()
      expect(api.get).toHaveBeenCalledWith('/notifications/unread-count')
    })

    it('markAsRead calls api.put with correct endpoint', () => {
      notificationsAPI.markAsRead(123)
      expect(api.put).toHaveBeenCalledWith('/notifications/123/read')
    })

    it('markAllAsRead calls api.put with correct endpoint', () => {
      notificationsAPI.markAllAsRead()
      expect(api.put).toHaveBeenCalledWith('/notifications/mark-read', {})
    })

    it('delete calls api.delete with correct endpoint', () => {
      notificationsAPI.delete(123)
      expect(api.delete).toHaveBeenCalledWith('/notifications/123')
    })
  })

  describe('ratingsAPI', () => {
    it('create calls api.post with correct endpoint', () => {
      const ratingData = {
        package_id: 123,
        score: 5,
        comment: 'Great service!',
      }
      ratingsAPI.create(ratingData)
      expect(api.post).toHaveBeenCalledWith('/ratings', ratingData)
    })

    it('getUserRatings calls api.get with correct endpoint', () => {
      ratingsAPI.getUserRatings(123)
      expect(api.get).toHaveBeenCalledWith('/ratings/user/123?skip=0&limit=20')
    })

    it('getUserRatings with pagination calls api.get with query params', () => {
      ratingsAPI.getUserRatings(123, 10, 50)
      expect(api.get).toHaveBeenCalledWith('/ratings/user/123?skip=10&limit=50')
    })

    it('getUserRatingSummary calls api.get with correct endpoint', () => {
      ratingsAPI.getUserRatingSummary(123)
      expect(api.get).toHaveBeenCalledWith('/ratings/user/123/summary')
    })

    it('getPackageRatings calls api.get with correct endpoint', () => {
      ratingsAPI.getPackageRatings(123)
      expect(api.get).toHaveBeenCalledWith('/ratings/package/123')
    })

    it('getMyPendingRatings calls api.get with correct endpoint', () => {
      ratingsAPI.getMyPendingRatings()
      expect(api.get).toHaveBeenCalledWith('/ratings/my-pending')
    })
  })

  describe('messagesAPI', () => {
    it('getConversations calls api.get with correct endpoint', () => {
      messagesAPI.getConversations()
      expect(api.get).toHaveBeenCalledWith('/messages/conversations?skip=0&limit=20')
    })

    it('getConversations with pagination calls api.get with query params', () => {
      messagesAPI.getConversations(10, 50)
      expect(api.get).toHaveBeenCalledWith('/messages/conversations?skip=10&limit=50')
    })

    it('getPackageMessages calls api.get with correct endpoint', () => {
      messagesAPI.getPackageMessages(123)
      expect(api.get).toHaveBeenCalledWith('/messages/package/123?skip=0&limit=50')
    })

    it('sendMessage calls api.post with correct endpoint', () => {
      messagesAPI.sendMessage(123, 'Hello!')
      expect(api.post).toHaveBeenCalledWith('/messages/package/123', { content: 'Hello!' })
    })

    it('markAsRead calls api.put with correct endpoint', () => {
      messagesAPI.markAsRead(123)
      expect(api.put).toHaveBeenCalledWith('/messages/123/read')
    })

    it('markAllAsRead calls api.put with correct endpoint', () => {
      messagesAPI.markAllAsRead(123)
      expect(api.put).toHaveBeenCalledWith('/messages/package/123/read-all')
    })

    it('getUnreadCount calls api.get with correct endpoint', () => {
      messagesAPI.getUnreadCount()
      expect(api.get).toHaveBeenCalledWith('/messages/unread-count')
    })
  })
})
