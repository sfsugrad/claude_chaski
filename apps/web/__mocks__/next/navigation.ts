// Mock for next/navigation
const useRouter = jest.fn(() => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
}))

const usePathname = jest.fn(() => '/en/dashboard')

const useSearchParams = jest.fn(() => ({
  get: jest.fn((key: string) => null),
  getAll: jest.fn((key: string) => []),
  has: jest.fn((key: string) => false),
  keys: jest.fn(() => [].values()),
  values: jest.fn(() => [].values()),
  entries: jest.fn(() => [].entries()),
  forEach: jest.fn(),
  toString: jest.fn(() => ''),
}))

const useParams = jest.fn(() => ({}))

const redirect = jest.fn()
const notFound = jest.fn()
const permanentRedirect = jest.fn()

export {
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
  redirect,
  notFound,
  permanentRedirect,
}
