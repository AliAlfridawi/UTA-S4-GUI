import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { SimulationConfig, SimulationResult, defaultConfig } from '@/lib/api'
import type { LayerStackConfig } from '@/components/LayerStackBuilder'

// Default layer stack config
const defaultLayerStackConfig: LayerStackConfig = {
  latticeConstant: 0.5,
  latticeType: 'square',
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
  GRAPH_SETTINGS: 'graph_settings',
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
  graphSettings: GraphSettings
  layerStackConfig: LayerStackConfig
  
  // Actions
  setConfig: (config: SimulationConfig) => void
  setResult: (result: SimulationResult | null) => void
  setGraphSettings: (settings: GraphSettings) => void
  updateGraphSettings: (partial: Partial<GraphSettings>) => void
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
  const [graphSettings, setGraphSettingsState] = useState<GraphSettings>(() =>
    loadFromStorage(STORAGE_KEYS.GRAPH_SETTINGS, defaultGraphSettings)
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

  // Persist layer stack config to sessionStorage
  const setLayerStackConfig = useCallback((newConfig: LayerStackConfig) => {
    setLayerStackConfigState(newConfig)
    saveToStorage(STORAGE_KEYS.LAYER_STACK_CONFIG, newConfig)
  }, [])

  // Clear results but keep config
  const clearResults = useCallback(() => {
    setResultState(null)
    sessionStorage.removeItem(STORAGE_KEYS.RESULT)
  }, [])

  // Reset everything to defaults
  const resetAll = useCallback(() => {
    setConfigState(defaultConfig)
    setResultState(null)
    setGraphSettingsState(defaultGraphSettings)
    setLayerStackConfigState(defaultLayerStackConfig)
    Object.values(STORAGE_KEYS).forEach(key => sessionStorage.removeItem(key))
  }, [])

  const value: SimulationState = {
    config,
    result,
    graphSettings,
    layerStackConfig,
    setConfig,
    setResult,
    setGraphSettings,
    updateGraphSettings,
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
