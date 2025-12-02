// Shared validation utilities

export const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address',
  },
  password: {
    minLength: 8,
    message: 'Password must be at least 8 characters',
  },
  phone: {
    // US phone number in E.164 format
    pattern: /^\+1[2-9]\d{9}$/,
    message: 'Please enter a valid US phone number (+1XXXXXXXXXX)',
  },
  weight: {
    min: 0.1,
    max: 100,
    message: 'Weight must be between 0.1 and 100 kg',
  },
  deviation: {
    min: 1,
    max: 50,
    message: 'Deviation must be between 1 and 50 km',
  },
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Email is required'
  if (!validationRules.email.pattern.test(email)) {
    return validationRules.email.message
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required'
  if (password.length < validationRules.password.minLength) {
    return validationRules.password.message
  }
  return null
}

export function validatePhone(phone: string | null | undefined): string | null {
  if (!phone) return null // Phone is optional
  if (!validationRules.phone.pattern.test(phone.trim())) {
    return validationRules.phone.message
  }
  return null
}

export function validateWeight(weight: number): string | null {
  if (weight < validationRules.weight.min || weight > validationRules.weight.max) {
    return validationRules.weight.message
  }
  return null
}

export function validateDeviation(km: number): string | null {
  if (km < validationRules.deviation.min || km > validationRules.deviation.max) {
    return validationRules.deviation.message
  }
  return null
}

export function validateRequired(value: string | null | undefined, fieldName: string): string | null {
  if (!value || value.trim() === '') {
    return `${fieldName} is required`
  }
  return null
}
