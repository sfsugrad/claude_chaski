import { clsx, type ClassValue } from 'clsx'

/**
 * Combines class names using clsx
 * A utility function for constructing className strings conditionally
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
