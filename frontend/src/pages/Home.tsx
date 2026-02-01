import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SimulationForm from '@/components/SimulationForm'
import SweepConfigComponent from '@/components/SweepConfig'
import SpectraPlot from '@/components/SpectraPlot'
import PhasePlot from '@/components/PhasePlot'
import { toast } from '@/hooks/use-toast'
import { ValidationResult } from '@/lib/validation'
import { useSimulation } from '@/context/SimulationContext'
import {
  JobInfo,
  SimulationResult,
  runSimulation,
  startSweep,
  getSweepResults,
  saveConfig,
  loadConfig,
  listConfigs,
  saveResults,
  checkHealth,
  connectToProgress,
} from '@/lib/api'
import {
  Play,
  Save,
  FolderOpen,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Cpu,
} from 'lucide-react'

export default function HomePage() {
  // Use global state from context
  const {
    config,
    setConfig,
    result,
    setResult,
    sweepResults,
    setSweepResults,
    sweeps,
    setSweeps,
    graphSettings,
    updateGraphSettings,
    clearResults: _clearResults,
  } = useSimulation()
  
  // UI State (local only)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<JobInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cpuCount, setCpuCount] = useState<number>(0)
  const [configName, setConfigName] = useState('')
  const [savedConfigs, setSavedConfigs] = useState<{ name: string; path: string }[]>([])
  
  // Validation state
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  
  // Ref for scrolling to results
  const resultsRef = useRef<HTMLDivElement>(null)
  
  // Validation callback
  const handleValidationChange = useCallback((v: ValidationResult) => {
    setValidation(v)
  }, [])
  
  // Check backend health on mount
  useEffect(() => {
    checkHealth()
      .then((data) => setCpuCount(data.cpu_count))
      .catch(() => setError('Backend not running. Start the server with: uvicorn main:app'))
  }, [])

  // Load saved configs
  useEffect(() => {
    listConfigs()
      .then((data) => setSavedConfigs(data.configs))
      .catch(() => {})
  }, [])

  // Check if dark mode is enabled
  const isDarkMode = document.documentElement.classList.contains('dark')

  // Auto-scroll to results when available
  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  // Run single simulation
  const handleRunSimulation = async () => {
    if (validation && !validation.isValid) {
      toast.error('Invalid Configuration', 'Please fix the errors before running')
      return
    }
    
    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const simResult = await runSimulation(config)
      setResult(simResult)
      toast.success('Simulation Complete', 'Results are ready to view')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Simulation failed'
      setError(errorMsg)
      toast.error('Simulation Failed', errorMsg)
    } finally {
      setIsRunning(false)
    }
  }

  // Run parameter sweep
  const handleRunSweep = async () => {
    if (validation && !validation.isValid) {
      toast.error('Invalid Configuration', 'Please fix the errors before running')
      return
    }
    
    setIsRunning(true)
    setError(null)
    setSweepResults([])
    setProgress(null)

    try {
      const sweepConfig = {
        base_config: config,
        sweeps: sweeps,
      }

      const { job_id } = await startSweep(sweepConfig)
      toast.info('Sweep Started', `Running ${sweeps.length} parameter sweep`)

      // Connect to WebSocket for progress updates
      connectToProgress(
        job_id,
        (info) => {
          setProgress(info)
          if (info.status === 'completed') {
            // Fetch results
            getSweepResults(job_id).then((data) => {
              setSweepResults(data.results)
              setIsRunning(false)
              toast.success('Sweep Complete', `${data.results.length} configurations processed`)
            })
          } else if (info.status === 'failed') {
            setError(info.error || 'Sweep failed')
            setIsRunning(false)
            toast.error('Sweep Failed', info.error || 'An error occurred')
          }
        },
        () => {
          setError('WebSocket connection failed')
          toast.error('Connection Failed', 'WebSocket connection lost')
        },
        () => {}
      )

      // Cleanup on unmount would go here
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start sweep'
      setError(errorMsg)
      setIsRunning(false)
      toast.error('Failed to Start Sweep', errorMsg)
    }
  }

  // Save configuration
  const handleSaveConfig = async () => {
    try {
      await saveConfig(config, configName || undefined)
      const data = await listConfigs()
      setSavedConfigs(data.configs)
      setConfigName('')
      toast.success('Configuration Saved', configName || 'Config saved successfully')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save config'
      setError(errorMsg)
      toast.error('Save Failed', errorMsg)
    }
  }

  // Load configuration
  const handleLoadConfig = async (name: string) => {
    try {
      const loaded = await loadConfig(name)
      setConfig(loaded)
      toast.success('Configuration Loaded', name)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load config'
      setError(errorMsg)
      toast.error('Load Failed', errorMsg)
    }
  }

  // Save results
  const handleSaveResults = async (format: 'json' | 'csv') => {
    if (!result) return
    try {
      await saveResults(result, format)
      toast.success('Results Saved', `Saved as ${format.toUpperCase()}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save results'
      setError(errorMsg)
      toast.error('Save Failed', errorMsg)
    }
  }

  // Calculate preview info
  const numWavelengths = Math.floor(
    Math.abs(config.wavelength.end - config.wavelength.start) / config.wavelength.step
  ) + 1
  
  const numSweepConfigs = sweeps.reduce((total, sweep) => {
    const points = Math.floor(Math.abs(sweep.end - sweep.start) / sweep.step) + 1
    return total * points
  }, 1)

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulation Builder</h1>
          <p className="text-muted-foreground">
            Configure and run S4 photonic crystal slab simulations
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Cpu className="h-4 w-4" />
          <span>{cpuCount} CPU cores available</span>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive rounded-md text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Simulation Form */}
          <SimulationForm
            config={config}
            onChange={setConfig}
            disabled={isRunning}
            onValidationChange={handleValidationChange}
          />

          {/* Parameter Sweep */}
          <SweepConfigComponent
            sweeps={sweeps}
            onChange={setSweeps}
            disabled={isRunning}
          />
        </div>

        {/* Right Column: Actions & Status */}
        <div className="space-y-6">
          {/* Run Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Run Simulation</CardTitle>
              <CardDescription>
                {sweeps.length > 0
                  ? `Sweep: ${numSweepConfigs} configs × ${numWavelengths} wavelengths`
                  : `Single: ${numWavelengths} wavelength points`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sweeps.length === 0 ? (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRunSimulation}
                  disabled={isRunning || (validation !== null && !validation.isValid)}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Simulation
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRunSweep}
                  disabled={isRunning || (validation !== null && !validation.isValid)}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sweeping...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Sweep ({numSweepConfigs} configs)
                    </>
                  )}
                </Button>
              )}

              {/* Progress */}
              {progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{progress.progress?.message}</span>
                    <span>{progress.progress?.percent.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress.progress?.percent || 0} />
                  {progress.progress?.estimated_remaining_seconds && (
                    <p className="text-xs text-muted-foreground">
                      Est. remaining: {Math.ceil(progress.progress.estimated_remaining_seconds)}s
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save/Load Config */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Save and load simulation setups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Config name"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                />
                <Button onClick={handleSaveConfig} variant="outline">
                  <Save className="h-4 w-4" />
                </Button>
              </div>

              {savedConfigs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Saved configs:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {savedConfigs.map((cfg) => (
                      <Button
                        key={cfg.name}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleLoadConfig(cfg.name)}
                      >
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {cfg.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Export Results */}
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Results Ready
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSaveResults('json')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Save as JSON
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSaveResults('csv')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Save as CSV
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Results Visualization */}
      {result && (
        <Card ref={resultsRef}>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              n={result.config.n_silicon}, a={result.config.lattice_constant}µm, 
              r={result.config.radius}µm, t={result.config.thickness}µm
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="spectra">
              <TabsList>
                <TabsTrigger value="spectra">Spectra (T/R/A)</TabsTrigger>
                <TabsTrigger value="phase">Phase</TabsTrigger>
              </TabsList>
              <TabsContent value="spectra">
                <SpectraPlot
                  result={result}
                  darkMode={isDarkMode}
                  title={graphSettings.spectraTitle}
                  onTitleChange={(title) => updateGraphSettings({ spectraTitle: title })}
                  visibleTraces={{
                    transmittance: graphSettings.visibleTraces.transmittance,
                    reflectance: graphSettings.visibleTraces.reflectance,
                    absorptance: graphSettings.visibleTraces.absorptance,
                  }}
                  onVisibleTracesChange={(traces) =>
                    updateGraphSettings({
                      visibleTraces: { ...graphSettings.visibleTraces, ...traces },
                    })
                  }
                  wavelengthMin={graphSettings.wavelengthRange.min}
                  wavelengthMax={graphSettings.wavelengthRange.max}
                  onWavelengthRangeChange={(min, max) =>
                    updateGraphSettings({ wavelengthRange: { min, max } })
                  }
                />
              </TabsContent>
              <TabsContent value="phase">
                <PhasePlot
                  result={result}
                  darkMode={isDarkMode}
                  title={graphSettings.phaseTitle}
                  onTitleChange={(title) => updateGraphSettings({ phaseTitle: title })}
                  visibleTraces={{
                    transmissionPhase: graphSettings.visibleTraces.transmissionPhase,
                    reflectionPhase: graphSettings.visibleTraces.reflectionPhase,
                  }}
                  onVisibleTracesChange={(traces) =>
                    updateGraphSettings({
                      visibleTraces: { ...graphSettings.visibleTraces, ...traces },
                    })
                  }
                  wavelengthMin={graphSettings.wavelengthRange.min}
                  wavelengthMax={graphSettings.wavelengthRange.max}
                  onWavelengthRangeChange={(min, max) =>
                    updateGraphSettings({ wavelengthRange: { min, max } })
                  }
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Sweep Results */}
      {sweepResults.length > 0 && (
        <SweepResultsPanel 
          sweepResults={sweepResults} 
          isDarkMode={isDarkMode} 
        />
      )}
    </div>
  )
}

// Separate component for sweep results with expand functionality
function SweepResultsPanel({ 
  sweepResults, 
  isDarkMode 
}: { 
  sweepResults: SimulationResult[]
  isDarkMode: boolean 
}) {
  const [showAll, setShowAll] = useState(false)
  const displayResults = showAll ? sweepResults : sweepResults.slice(0, 4)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Sweep Results ({sweepResults.length} configurations)</CardTitle>
          {sweepResults.length > 4 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show Less' : `Show All (${sweepResults.length})`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayResults.map((res, idx) => (
            <div key={idx} className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">
                n={res.config.n_silicon}, r={res.config.radius}µm
              </p>
              <SpectraPlot result={res} darkMode={isDarkMode} compact />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
