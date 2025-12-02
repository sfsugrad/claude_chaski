// Shared utilities package
// Re-exports all utility functions for easy importing

// Distance conversion utilities
export {
  kmToMiles,
  milesToKm,
  formatMiles,
  formatKm,
} from './distance'

// Phone number utilities
export {
  isValidUSPhone,
  formatPhoneForDisplay,
  toE164,
  parsePhoneInput,
} from './phone'

// Validation utilities
export {
  validationRules,
  validateEmail,
  validatePassword,
  validatePhone,
  validateWeight,
  validateDeviation,
  validateRequired,
} from './validation'

// Package status state machine
export {
  type PackageStatus,
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  TERMINAL_STATES,
  isTerminalState,
  canCancel,
  getAllowedNextStatuses,
  isValidTransition,
  getStatusLabel,
  getStatusColor,
} from './package-status'
