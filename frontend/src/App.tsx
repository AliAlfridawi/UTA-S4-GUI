import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Moon, Sun, Atom, BarChart3, Settings, Menu, X } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { SimulationProvider } from '@/context/SimulationContext'
import HomePage from './pages/Home'
import ResultsPage from './pages/Results'

function NavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  const location = useLocation()
  const isActive = location.pathname === to
  
  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={cn(
        "text-sm transition-colors flex items-center gap-1 px-3 py-2 rounded-md",
        isActive 
          ? "text-foreground bg-accent font-medium" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      {children}
    </Link>
  )
}

function AppContent() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : true
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
              <Atom className="h-6 w-6 text-primary" />
              <span>S4 Simulation</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/">
                <Settings className="h-4 w-4" />
                Simulation
              </NavLink>
              <NavLink to="/results">
                <BarChart3 className="h-4 w-4" />
                Results
              </NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md hover:bg-accent transition-colors md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              <NavLink to="/" onClick={closeMobileMenu}>
                <Settings className="h-4 w-4" />
                Simulation
              </NavLink>
              <NavLink to="/results" onClick={closeMobileMenu}>
                <BarChart3 className="h-4 w-4" />
                Results
              </NavLink>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          S4 Photonic Simulation GUI • Stanford S4 Library
        </div>
      </footer>
      
      {/* Toast Notifications */}
      <Toaster />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <SimulationProvider>
        <AppContent />
      </SimulationProvider>
    </BrowserRouter>
  )
}

export default App
