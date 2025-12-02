// Distance conversion utilities
// Backend stores distance in kilometers, frontend displays in miles

const KM_TO_MILES = 0.621371
const MILES_TO_KM = 1.60934

/**
 * Convert kilometers to miles for display
 */
export function kmToMiles(km: number): number {
  return km * KM_TO_MILES
}

/**
 * Convert miles to kilometers for storage
 */
export function milesToKm(miles: number): number {
  return miles * MILES_TO_KM
}

/**
 * Format distance in miles with unit
 */
export function formatMiles(km: number, decimals: number = 1): string {
  return `${kmToMiles(km).toFixed(decimals)} mi`
}

/**
 * Format distance in kilometers with unit
 */
export function formatKm(km: number, decimals: number = 1): string {
  return `${km.toFixed(decimals)} km`
}
