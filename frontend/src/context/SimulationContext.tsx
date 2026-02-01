import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { SimulationConfig, SimulationResult, SweepParameter, defaultConfig } from '@/lib/api'
import type { LayerStackConfig } from '@/components/LayerStackBuilder'

// Input mode type
export type InputMode = 'simple' | 'advanced'

// Default layer stack config
const defaultLayerStackConfig: LayerStackConfig = {
  layers: [],
  superstrate: 'Vacuum',
  substrate: 'Glass',
  includeBackReflector: false,
  backReflectorMaterial: 'Gold',
  backReflectorThickness: 0.1,
}

// Session storage keys
const STORAGE_KEYS = {
  CONFIG: 'simulation_config',
  RESULT: 'simulation_result',
  SWEEP_RESULTS: 'simulation_sweep_results',
  SWEEPS: 'simulation_sweeps',
  GRAPH_SETTINGS: 'graph_settings',
  INPUT_MODE: 'input_mode',
  LAYER_STACK_CONFIG: 'layer_stack_config',
}

// Graph customization settings
export interface GraphSettings {
  spectraTitle: string
  phaseTitle: string
  visibleTraces: {
    transmittance: boolean
    reflectance: boolean
    absorptance: boolean
    transmissionPhase: boolean
    reflectionPhase: boolean
  }
  wavelengthRange: {
    min: number | null
    max: number | null
  }
}

const defaultGraphSettings: GraphSettings = {
  spectraTitle: 'Transmission / Reflection / Absorption Spectra',
  phaseTitle: 'Phase Response',
  visibleTraces: {
    transmittance: true,
    reflectance: true,
    absorptance: true,
    transmissionPhase: true,
    reflectionPhase: true,
  },
  wavelengthRange: {
    min: null,
    max: null,
  },
}

// Context state interface
interface SimulationState {
  // Data
  config: SimulationConfig
  result: SimulationResult | null
  sweepResults: SimulationResult[]
  sweeps: SweepParameter[]
  graphSettings: GraphSettings
  inputMode: InputMode
  layerStackConfig: LayerStackConfig
  
  // Actions
  setConfig: (config: SimulationConfig) => void
  setResult: (result: SimulationResult | null) => void
  setSweepResults: (results: SimulationResult[]) => void
  setSweeps: (sweeps: SweepParameter[]) => void
  setGraphSettings: (settings: GraphSettings) => void
  updateGraphSettings: (partial: Partial<GraphSettings>) => void
  setInputMode: (mode: InputMode) => void
  setLayerStackConfig: (config: LayerStackConfig) => void
  clearResults: () => void
  resetAll: () => void
}

const SimulationContext = createContext<SimulationState | undefined>(undefined)

// Helper to safely parse JSON from sessionStorage
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = sessionStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.warn(`Failed to load ${key} from storage:`, e)
  }
  return fallback
}

// Helper to save to sessionStorage
function saveToStorage<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn(`Failed to save ${key} to storage:`, e)
  }
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  // Initialize state from sessionStorage
  const [config, setConfigState] = useState<SimulationConfig>(() =>
    loadFromStorage(STORAGE_KEYS.CONFIG, defaultConfig)
  )
  const [result, setResultState] = useState<SimulationResult | null>(() =>
    loadFromStorage(STORAGE_KEYS.RESULT, null)
  )
  const [sweepResults, setSweepResultsState] = useState<SimulationResult[]>(() =>
    loadFromStorage(STORAGE_KEYS.SWEEP_RESULTS, [])
  )
  const [sweeps, setSweepsState] = useState<SweepParameter[]>(() =>
    loadFromStorage(STORAGE_KEYS.SWEEPS, [])
  )
  const [graphSettings, setGraphSettingsState] = useState<GraphSettings>(() =>
    loadFromStorage(STORAGE_KEYS.GRAPH_SETTINGS, defaultGraphSettings)
  )
  const [inputMode, setInputModeState] = useState<InputMode>(() =>
    loadFromStorage(STORAGE_KEYS.INPUT_MODE, 'simple')
  )
  const [layerStackConfig, setLayerStackConfigState] = useState<LayerStackConfig>(() =>
    loadFromStorage(STORAGE_KEYS.LAYER_STACK_CONFIG, defaultLayerStackConfig)
  )

  // Persist config to sessionStorage
  const setConfig = useCallback((newConfig: SimulationConfig) => {
    setConfigState(newConfig)
    saveToStorage(STORAGE_KEYS.CONFIG, newConfig)
  }, [])

  // Persist result to sessionStorage
  const setResult = useCallback((newResult: SimulationResult | null) => {
    setResultState(newResult)
    saveToStorage(STORAGE_KEYS.RESULT, newResult)
  }, [])

  // Persist sweep results to sessionStorage
  const setSweepResults = useCallback((newResults: SimulationResult[]) => {
    setSweepResultsState(newResults)
    saveToStorage(STORAGE_KEYS.SWEEP_RESULTS, newResults)
  }, [])

  // Persist sweeps to sessionStorage
  const setSweeps = useCallback((newSweeps: SweepParameter[]) => {
    setSweepsState(newSweeps)
    saveToStorage(STORAGE_KEYS.SWEEPS, newSweeps)
  }, [])

  // Persist graph settings to sessionStorage
  const setGraphSettings = useCallback((newSettings: GraphSettings) => {
    setGraphSettingsState(newSettings)
    saveToStorage(STORAGE_KEYS.GRAPH_SETTINGS, newSettings)
  }, [])

  // Partial update for graph settings
  const updateGraphSettings = useCallback((partial: Partial<GraphSettings>) => {
    setGraphSettingsState(prev => {
      const updated = { ...prev, ...partial }
      saveToStorage(STORAGE_KEYS.GRAPH_SETTINGS, updated)
      return updated
    })
  }, [])

  // Persist input mode to sessionStorage
  const setInputMode = useCallback((newMode: InputMode) => {
    setInputModeState(newMode)
    saveToStorage(STORAGE_KEYS.INPUT_MODE, newMode)
  }, [])

  // Persist layer stack config to sessionStorage
  const setLayerStackConfig = useCallback((newConfig: LayerStackConfig) => {
    setLayerStackConfigState(newConfig)
    saveToStorage(STORAGE_KEYS.LAYER_STACK_CONFIG, newConfig)
  }, [])

  // Clear results but keep config
  const clearResults = useCallback(() => {
    setResultState(null)
    setSweepResultsState([])
    sessionStorage.removeItem(STORAGE_KEYS.RESULT)
    sessionStorage.removeItem(STORAGE_KEYS.SWEEP_RESULTS)
  }, [])

  // Reset everything to defaults
  const resetAll = useCallback(() => {
    setConfigState(defaultConfig)
    setResultState(null)
    setSweepResultsState([])
    setSweepsState([])
    setGraphSettingsState(defaultGraphSettings)
    setInputModeState('simple')
    setLayerStackConfigState(defaultLayerStackConfig)
    Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key))
  }, [])

  const value: SimulationState = {
    config,
    result,
    sweepResults,
    sweeps,
    graphSettings,
    inputMode,
    layerStackConfig,
    setConfig,
    setResult,
    setSweepResults,
    setSweeps,
    setGraphSettings,
    updateGraphSettings,
    setInputMode,
    setLayerStackConfig,
    clearResults,
    resetAll,
  }

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  )
}

export function useSimulation() {
  const context = useContext(SimulationContext)
  if (context === undefined) {
    throw new Error('useSimulation must be used within a SimulationProvider')
  }
  return context
}

export { defaultGraphSettings, defaultLayerStackConfig }
export type { LayerStackConfig }
