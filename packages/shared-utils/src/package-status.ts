// Package status state machine
// Derived from backend/app/services/package_status.py

export type PackageStatus =
  | 'NEW'
  | 'OPEN_FOR_BIDS'
  | 'BID_SELECTED'
  | 'PENDING_PICKUP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELED'
  | 'FAILED'

export const ALLOWED_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  NEW: ['OPEN_FOR_BIDS', 'CANCELED'],
  OPEN_FOR_BIDS: ['BID_SELECTED', 'CANCELED'],
  BID_SELECTED: ['PENDING_PICKUP', 'OPEN_FOR_BIDS', 'CANCELED'],
  PENDING_PICKUP: ['IN_TRANSIT', 'CANCELED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  CANCELED: [],
  FAILED: ['OPEN_FOR_BIDS'], // Admin only
}

export const STATUS_LABELS: Record<PackageStatus, string> = {
  NEW: 'New',
  OPEN_FOR_BIDS: 'Open for Bids',
  BID_SELECTED: 'Bid Selected',
  PENDING_PICKUP: 'Pending Pickup',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled',
  FAILED: 'Failed',
}

export const STATUS_COLORS: Record<PackageStatus, string> = {
  NEW: 'gray',
  OPEN_FOR_BIDS: 'blue',
  BID_SELECTED: 'purple',
  PENDING_PICKUP: 'yellow',
  IN_TRANSIT: 'orange',
  DELIVERED: 'green',
  CANCELED: 'red',
  FAILED: 'red',
}

export const TERMINAL_STATES: PackageStatus[] = ['DELIVERED', 'CANCELED']

/**
 * Check if a status is a terminal state (no further transitions possible)
 */
export function isTerminalState(status: PackageStatus): boolean {
  return TERMINAL_STATES.includes(status)
}

/**
 * Check if a package can be canceled from its current status
 */
export function canCancel(status: PackageStatus, isAdmin: boolean = false): boolean {
  if (TERMINAL_STATES.includes(status)) return false
  if (isAdmin) return true
  if (status === 'FAILED' || status === 'IN_TRANSIT') return false
  return true
}

/**
 * Get the allowed next statuses for a package
 */
export function getAllowedNextStatuses(current: PackageStatus, isAdmin: boolean = false): PackageStatus[] {
  const allowed = ALLOWED_TRANSITIONS[current] || []
  if (current === 'FAILED' && !isAdmin) return []
  if (!isAdmin) {
    return allowed.filter((s) => s !== 'FAILED')
  }
  return allowed
}

/**
 * Check if a transition from one status to another is valid
 */
export function isValidTransition(from: PackageStatus, to: PackageStatus, isAdmin: boolean = false): boolean {
  const allowed = getAllowedNextStatuses(from, isAdmin)
  return allowed.includes(to)
}

/**
 * Get the human-readable label for a status
 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status.toUpperCase() as PackageStatus] || status
}

/**
 * Get the color associated with a status (for UI badges)
 */
export function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toUpperCase() as PackageStatus] || 'gray'
}
