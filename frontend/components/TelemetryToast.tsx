'use client'

import { useEffect, useState } from 'react'
import { XCircle, CheckCircle2, AlertTriangle, Loader } from 'lucide-react'

export interface TelemetryEvent {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timestamp: number
}

const TelemetryToast = () => {
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [listening, setListening] = useState(false)

  useEffect(() => {
    // Listen for custom telemetry events
    const handler = (e: CustomEvent<TelemetryEvent>) => {
      setEvents(prev => [...prev, e.detail])
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setEvents(prev => prev.filter(ev => ev.timestamp !== e.detail.timestamp))
      }, 5000)
    }

    window.addEventListener('telemetry', handler as EventListener)
    setListening(true)

    return () => {
      window.removeEventListener('telemetry', handler as EventListener)
    }
  }, [])

  if (!listening || events.length === 0) return null

  const getIcon = (type: TelemetryEvent['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Loader className="h-5 w-5 text-blue-500" />
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {events.map((event) => (
        <div
          key={event.timestamp}
          className="bg-background border rounded-lg shadow-lg p-3 flex items-start gap-3 animate-in slide-in-from-bottom"
        >
          {getIcon(event.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{event.message}</p>
          </div>
          <button
            onClick={() => setEvents(prev => prev.filter(e => e.timestamp !== event.timestamp))}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// Helper function to emit telemetry events
export const emitTelemetry = (type: TelemetryEvent['type'], message: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('telemetry', {
      detail: {
        type,
        message,
        timestamp: Date.now()
      }
    }))
  }
}

export default TelemetryToast



