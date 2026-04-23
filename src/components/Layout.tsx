import { ReactNode, useState, useEffect } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <Header onToggleSidebar={toggleSidebar} isMobile={isMobile} />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <main
        className={`pt-20 transition-all duration-300 ${
          sidebarOpen && !isMobile ? 'pl-64' : 'pl-0'
        } px-4 md:px-8`}
      >
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <Footer />
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}
    </div>
  )
}
