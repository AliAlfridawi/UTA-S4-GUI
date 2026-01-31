import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Moon, Sun, Atom, BarChart3, Settings } from 'lucide-react'
import HomePage from './pages/Home'
import ResultsPage from './pages/Results'

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : true // Default to dark mode
  })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        {/* Navigation Header */}
        <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
                <Atom className="h-6 w-6 text-primary" />
                <span>S4 Simulation</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-4">
                <Link 
                  to="/" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Settings className="h-4 w-4" />
                  Simulation
                </Link>
                <Link 
                  to="/results" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <BarChart3 className="h-4 w-4" />
                  Results
                </Link>
              </nav>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/results" element={<ResultsPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-auto py-4">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            S4 Photonic Simulation GUI • Stanford S4 Library
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
