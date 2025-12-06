// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Google Maps API
global.window = global.window || {}

// Mock Touch API for mobile gesture tests (SignaturePad, etc.)
global.Touch = class Touch {
  constructor(init) {
    this.identifier = init.identifier
    this.target = init.target
    this.clientX = init.clientX || 0
    this.clientY = init.clientY || 0
    this.pageX = init.pageX || 0
    this.pageY = init.pageY || 0
    this.screenX = init.screenX || 0
    this.screenY = init.screenY || 0
    this.radiusX = init.radiusX || 0
    this.radiusY = init.radiusY || 0
    this.rotationAngle = init.rotationAngle || 0
    this.force = init.force || 0
  }
}

// Mock next-intl globally (can be overridden in individual tests)
jest.mock('next-intl', () => ({
  useTranslations: () => (key) => key,
  useLocale: () => 'en',
  useMessages: () => ({}),
  useNow: () => new Date(),
  useTimeZone: () => 'America/Los_Angeles',
  useFormatter: () => ({
    dateTime: (date) => date.toISOString(),
    number: (num) => String(num),
    relativeTime: () => 'just now',
  }),
  NextIntlClientProvider: ({ children }) => children,
}))

// Mock next-intl/server globally
jest.mock('next-intl/server', () => ({
  getLocale: () => Promise.resolve('en'),
  getMessages: () => Promise.resolve({}),
  getTranslations: () => Promise.resolve((key) => key),
  getNow: () => Promise.resolve(new Date()),
  getTimeZone: () => Promise.resolve('America/Los_Angeles'),
  getFormatter: () => Promise.resolve({}),
  setRequestLocale: () => {},
  getRequestConfig: (configFn) => configFn,
  getExtracted: () => {},
}))

// Mock i18n/request to avoid importing next-intl/server in tests
jest.mock('@/i18n/request', () => ({
  locales: ['en', 'fr', 'es'],
  defaultLocale: 'en',
  localeNames: { en: 'English', fr: 'Français', es: 'Español' },
  default: async () => ({ locale: 'en', messages: {} }),
}))

// Mock canvas for signature tests
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: [] })),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
  quadraticCurveTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  lineWidth: 1,
  strokeStyle: '',
  fillStyle: '',
  lineCap: '',
  lineJoin: '',
}))

HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock')
