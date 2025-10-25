'use client'

import Link from "next/link"
import { Map, Activity, Settings, Menu, X, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSidebar } from "@/contexts/SidebarContext"

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const { isMapPage, setIsMapPage, isCollapsed, setIsCollapsed } = useSidebar()
  const pathname = usePathname()

  // Check if we're on the map page
  useEffect(() => {
    setIsMapPage(pathname === '/')
  }, [pathname, setIsMapPage])

  // Auto-collapse sidebar on map page after a delay
  useEffect(() => {
    if (isMapPage) {
      const timer = setTimeout(() => {
        setIsCollapsed(true)
      }, 2000) // Auto-collapse after 2 seconds
      
      return () => clearTimeout(timer)
    } else {
      setIsCollapsed(false) // Always show sidebar on other pages
    }
  }, [isMapPage, setIsCollapsed])

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

      {/* Hover Arrow - Only show on map page when collapsed */}
      {isMapPage && isCollapsed && (
        <div 
          className="fixed left-0 top-1/2 transform -translate-y-1/2 z-50 bg-white dark:bg-gray-900 border-r border-border rounded-r-lg shadow-lg cursor-pointer"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className="p-2">
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          bg-gradient-to-b from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 
          border-r border-border p-4 flex flex-col
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:pt-4 pt-20
          ${isMapPage && isCollapsed && !isHovering ? 'lg:w-0 lg:overflow-hidden lg:p-0' : 'w-64'}
        `}
        onMouseEnter={() => {
          if (isMapPage && isCollapsed) {
            setIsHovering(true)
          }
        }}
        onMouseLeave={() => {
          if (isMapPage && isCollapsed) {
            setIsHovering(false)
          }
        }}
      >
        {/* Sidebar Content - Hide when collapsed on map page */}
        <div className={`${isMapPage && isCollapsed && !isHovering ? 'lg:hidden' : ''}`}>
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
        </div>
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

