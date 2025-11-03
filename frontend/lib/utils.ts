import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatLatency(latency?: number | null): string {
  if (typeof latency === 'number' && Number.isFinite(latency)) {
    if (latency <= 0) {
      return 'sub 0ms'
    }

    if (latency < 1) {
      return '<1ms'
    }

    const displayValue = Number.isInteger(latency)
      ? latency.toString()
      : latency.toFixed(1)

    return `${displayValue}ms`
  }

  return 'sub 0ms'
}



