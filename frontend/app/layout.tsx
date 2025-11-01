import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import TelemetryToast from "@/components/TelemetryToast"
import { SidebarProvider } from "@/contexts/SidebarContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Network Link Map Monitor",
  description: "Real-time network monitoring with geographic visualization",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            
            {/* Main Content */}
            <main className="flex-1 overflow-auto lg:ml-0 pt-14 lg:pt-0">
              {children}
            </main>
            
            {/* Telemetry Toast */}
            <TelemetryToast />
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}

