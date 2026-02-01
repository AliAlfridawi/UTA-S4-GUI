import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SpectraPlot from '@/components/SpectraPlot'
import PhasePlot from '@/components/PhasePlot'
import { toast } from '@/hooks/use-toast'
import {
  SimulationResult,
  listResults,
  loadResults,
  getDownloadUrl,
  deleteResults,
} from '@/lib/api'
import {
  FolderOpen,
  Download,
  Trash2,
  FileJson,
  BarChart3,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

interface SavedResult {
  name: string
  path: string
  modified: string
  size: number
}

export default function ResultsPage() {
  const [savedResults, setSavedResults] = useState<SavedResult[]>([])
  const [selectedResult, setSelectedResult] = useState<SimulationResult | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Check if dark mode is enabled
  const isDarkMode = document.documentElement.classList.contains('dark')

  // Filter results by search query
  const filteredResults = savedResults.filter(result => 
    result.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Load saved results list
  const refreshResults = async () => {
    try {
      const data = await listResults()
      setSavedResults(data.results)
    } catch (err) {
      setError('Failed to load results list')
    }
  }

  useEffect(() => {
    refreshResults()
  }, [])

  // Load a specific result
  const handleLoadResult = async (name: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await loadResults(name)
      setSelectedResult(result)
      setSelectedName(name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load result')
      toast.error('Failed to Load', 'Could not load the selected result')
    } finally {
      setIsLoading(false)
    }
  }

  // Delete a result
  const handleDeleteResult = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the load action
    try {
      await deleteResults(name)
      await refreshResults()
      if (selectedName === name) {
        setSelectedResult(null)
        setSelectedName('')
      }
      toast.success('Deleted', `${name} has been removed`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete result'
      setError(errorMsg)
      toast.error('Delete Failed', errorMsg)
    }
  }

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // Format date
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saved Results</h1>
          <p className="text-muted-foreground">
            View and export previous simulation results
          </p>
        </div>
        <Button variant="outline" onClick={refreshResults}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive rounded-md text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Results List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Results
              </CardTitle>
              <CardDescription>
                {savedResults.length} saved simulation{savedResults.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search results..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              {savedResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No saved results yet. Run a simulation first!
                </p>
              ) : filteredResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No results match "{searchQuery}"
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredResults.map((result) => (
                    <div
                      key={result.name}
                      onClick={() => handleLoadResult(result.name)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer group ${
                        selectedName === result.name
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{result.name}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                            <span>{formatDate(result.modified)}</span>
                            <span>{formatSize(result.size)}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteResult(result.name, e)}
                          className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Delete result"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Result Viewer */}
        <div className="lg:col-span-3">
          {!selectedResult ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No result selected</p>
                <p className="text-sm text-muted-foreground">
                  Select a result from the list to view its data
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Result Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedName}</CardTitle>
                      <CardDescription className="mt-2">
                        <span className="inline-flex items-center gap-4 flex-wrap">
                          <span>n = {selectedResult.config.n_silicon}</span>
                          <span>a = {selectedResult.config.lattice_constant} µm</span>
                          <span>r = {selectedResult.config.radius} µm</span>
                          <span>t = {selectedResult.config.thickness} µm</span>
                          <span>h = {selectedResult.config.glass_thickness} µm</span>
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={getDownloadUrl(selectedName, 'json')}
                        download
                        className="inline-flex"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          JSON
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-muted-foreground">Wavelength Range</p>
                      <p className="font-medium">
                        {selectedResult.config.wavelength.start} - {selectedResult.config.wavelength.end} nm
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-muted-foreground">Step Size</p>
                      <p className="font-medium">{selectedResult.config.wavelength.step} nm</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-muted-foreground">Data Points</p>
                      <p className="font-medium">{selectedResult.wavelengths.length}</p>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-muted-foreground">NumBasis</p>
                      <p className="font-medium">{selectedResult.config.num_basis}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Plots */}
              <Card>
                <CardContent className="pt-6">
                  <Tabs defaultValue="spectra">
                    <TabsList className="mb-4">
                      <TabsTrigger value="spectra">Spectra (T/R/A)</TabsTrigger>
                      <TabsTrigger value="phase">Phase</TabsTrigger>
                      <TabsTrigger value="data">Raw Data</TabsTrigger>
                    </TabsList>

                    <TabsContent value="spectra">
                      <SpectraPlot result={selectedResult} darkMode={isDarkMode} />
                    </TabsContent>

                    <TabsContent value="phase">
                      <PhasePlot result={selectedResult} darkMode={isDarkMode} />
                    </TabsContent>

                    <TabsContent value="data">
                      <div className="max-h-[400px] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="text-left p-2">Wavelength (nm)</th>
                              {selectedResult.transmittance && (
                                <th className="text-left p-2">T</th>
                              )}
                              {selectedResult.reflectance && (
                                <th className="text-left p-2">R</th>
                              )}
                              {selectedResult.absorptance && (
                                <th className="text-left p-2">A</th>
                              )}
                              {selectedResult.transmission_phase && (
                                <th className="text-left p-2">Phase T (π)</th>
                              )}
                              {selectedResult.reflection_phase && (
                                <th className="text-left p-2">Phase R (π)</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedResult.wavelengths.slice(0, 100).map((wvl, i) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="p-2">{wvl.toFixed(2)}</td>
                                {selectedResult.transmittance && (
                                  <td className="p-2">{selectedResult.transmittance[i]?.toFixed(6)}</td>
                                )}
                                {selectedResult.reflectance && (
                                  <td className="p-2">{selectedResult.reflectance[i]?.toFixed(6)}</td>
                                )}
                                {selectedResult.absorptance && (
                                  <td className="p-2">{selectedResult.absorptance[i]?.toFixed(6)}</td>
                                )}
                                {selectedResult.transmission_phase && (
                                  <td className="p-2">{selectedResult.transmission_phase[i]?.toFixed(6)}</td>
                                )}
                                {selectedResult.reflection_phase && (
                                  <td className="p-2">{selectedResult.reflection_phase[i]?.toFixed(6)}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {selectedResult.wavelengths.length > 100 && (
                          <p className="text-center text-muted-foreground py-4">
                            Showing first 100 of {selectedResult.wavelengths.length} rows
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
