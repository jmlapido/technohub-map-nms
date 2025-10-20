'use client'

import Link from "next/link"
import { Map, Activity, Settings, Menu, X } from "lucide-react"
import { useState } from "react"
import { usePathname } from "next/navigation"

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          TechnoHub Network Monitor
        </h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 
        border-r border-border p-4 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:pt-4 pt-20
      `}>
        <div className="mb-8 hidden lg:block">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            TechnoHub Network Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Real-time status</p>
        </div>
        
        <nav className="space-y-2 flex-1">
          <Link 
            href="/" 
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              pathname === '/' 
                ? 'bg-white dark:bg-gray-700 shadow-md' 
                : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'
            }`}
          >
            <Map className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Network Map</span>
          </Link>
          <Link 
            href="/status" 
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              pathname === '/status' 
                ? 'bg-white dark:bg-gray-700 shadow-md' 
                : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'
            }`}
          >
            <Activity className="w-5 h-5 text-green-600" />
            <span className="font-medium">Status</span>
          </Link>
          <Link 
            href="/settings" 
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              pathname === '/settings' 
                ? 'bg-white dark:bg-gray-700 shadow-md' 
                : 'hover:bg-white dark:hover:bg-gray-700 shadow-sm'
            }`}
          >
            <Settings className="w-5 h-5 text-gray-600" />
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}

