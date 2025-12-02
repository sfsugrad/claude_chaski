// Phone number utilities
// Derived from backend/app/utils/phone_validator.py

const US_PHONE_PATTERN = /^\+1[2-9]\d{9}$/

/**
 * Validate a US phone number in E.164 format
 */
export function isValidUSPhone(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) return false
  return US_PHONE_PATTERN.test(phoneNumber.trim())
}

/**
 * Format a phone number for display
 * +12125551234 -> (212) 555-1234
 */
export function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const area = cleaned.substring(1, 4)
    const exchange = cleaned.substring(4, 7)
    const subscriber = cleaned.substring(7, 11)
    return `(${area}) ${exchange}-${subscriber}`
  }
  return phone
}

/**
 * Convert a 10-digit US phone number to E.164 format
 * 2125551234 -> +12125551234
 */
export function toE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `+1${cleaned}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`
  }
  return phone
}

/**
 * Parse a phone number input and return a clean version or null if invalid
 */
export function parsePhoneInput(input: string): string | null {
  const cleaned = input.replace(/\D/g, '')

  // Handle 10-digit US number
  if (cleaned.length === 10 && /^[2-9]/.test(cleaned)) {
    return `+1${cleaned}`
  }

  // Handle 11-digit number starting with 1
  if (cleaned.length === 11 && cleaned.startsWith('1') && /^1[2-9]/.test(cleaned)) {
    return `+${cleaned}`
  }

  // Already in E.164 format
  if (input.startsWith('+1') && isValidUSPhone(input)) {
    return input
  }

  return null
}
