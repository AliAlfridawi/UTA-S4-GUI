import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LayerStackBuilder from '@/components/LayerStackBuilder'
import SimulationSettings from '@/components/SimulationSettings'
import SpectraPlot from '@/components/SpectraPlot'
import PhasePlot from '@/components/PhasePlot'
import { toast } from '@/hooks/use-toast'
import { useSimulation } from '@/context/SimulationContext'
import { createAdvancedSimRequest, convertLayerStackToSimConfig } from '@/lib/utils'
import {
  runAdvancedSimulation,
  saveConfig,
  loadConfig,
  listConfigs,
  saveResults,
  checkHealth,
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
    graphSettings,
    updateGraphSettings,
    layerStackConfig,
    setLayerStackConfig,
    clearResults: _clearResults,
  } = useSimulation()
  
  // UI State (local only)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cpuCount, setCpuCount] = useState<number>(0)
  const [configName, setConfigName] = useState('')
  const [savedConfigs, setSavedConfigs] = useState<{ name: string; path: string }[]>([])
  
  // Ref for scrolling to results
  const resultsRef = useRef<HTMLDivElement>(null)
  
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
    // Create advanced simulation request from layer stack
    const simRequest = createAdvancedSimRequest(
      layerStackConfig,
      config.wavelength,
      {
        theta: config.excitation.theta,
        phi: config.excitation.phi,
        s_amplitude: config.excitation.s_amplitude,
        p_amplitude: config.excitation.p_amplitude,
        num_basis: config.num_basis,
      }
    )
    
    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const simResult = await runAdvancedSimulation(simRequest)
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

  // Save configuration (converts layer stack to sim config for storage)
  const handleSaveConfig = async () => {
    try {
      const configToSave = convertLayerStackToSimConfig(layerStackConfig, config)
      await saveConfig(configToSave, configName || undefined)
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

  // Calculate preview info from layer stack
  const numWavelengths = Math.floor(
    Math.abs(config.wavelength.end - config.wavelength.start) / config.wavelength.step
  ) + 1

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
          <LayerStackBuilder
            config={layerStackConfig}
            onChange={setLayerStackConfig}
            disabled={isRunning}
          />
          
          <SimulationSettings
            config={config}
            onConfigChange={setConfig}
          />
        </div>

        {/* Right Column: Actions & Status */}
        <div className="space-y-6">
          {/* Run Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Run Simulation</CardTitle>
              <CardDescription>
                {`Single: ${numWavelengths} wavelength points`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                size="lg"
                onClick={handleRunSimulation}
                disabled={isRunning}
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
    </div>
  )
}
