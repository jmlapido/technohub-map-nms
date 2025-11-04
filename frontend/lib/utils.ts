import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatLatency(latency?: number | null): string {
  if (typeof latency === 'number' && Number.isFinite(latency)) {
    // For values less than 1ms, show decimal precision (e.g., 0.75ms, 0.20ms)
    if (latency < 1 && latency > 0) {
      return `${latency.toFixed(2)}ms`
    }

    // For zero or negative values, show as 0.00ms
    if (latency <= 0) {
      return '0.00ms'
    }

    // For values >= 1ms, show integer if whole number, otherwise 1 decimal place
    const displayValue = Number.isInteger(latency)
      ? latency.toString()
      : latency.toFixed(1)

    return `${displayValue}ms`
  }

  return '0.00ms'
}



