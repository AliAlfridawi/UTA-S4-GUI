import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip } from '@/components/ui/tooltip'
import {
  ChevronDown,
  ChevronUp,
  Waves,
  Sun,
  Info,
  AlertTriangle,
  Settings2,
} from 'lucide-react'
import type { SimulationConfig, ExcitationConfig, WavelengthRange } from '@/lib/api'

interface SimulationSettingsProps {
  config: SimulationConfig
  onConfigChange: (config: SimulationConfig) => void
}

// Polarization presets
const POLARIZATION_PRESETS = [
  { name: 'TE', s: 1, p: 0, description: 'Transverse Electric (s-polarized)' },
  { name: 'TM', s: 0, p: 1, description: 'Transverse Magnetic (p-polarized)' },
  { name: 'Unpolarized', s: 1, p: 1, description: 'Equal s and p components' },
]

export default function SimulationSettings({ config, onConfigChange }: SimulationSettingsProps) {
  const [excitationExpanded, setExcitationExpanded] = useState(true)
  const [wavelengthExpanded, setWavelengthExpanded] = useState(true)
  const [advancedExpanded, setAdvancedExpanded] = useState(false)

  // Calculate number of wavelength points
  const wavelengthPoints = Math.max(1, Math.floor((config.wavelength.end - config.wavelength.start) / config.wavelength.step) + 1)
  const showWavelengthWarning = wavelengthPoints > 1000

  // Update excitation config
  const updateExcitation = (updates: Partial<ExcitationConfig>) => {
    onConfigChange({
      ...config,
      excitation: { ...config.excitation, ...updates },
    })
  }

  // Update wavelength config
  const updateWavelength = (updates: Partial<WavelengthRange>) => {
    onConfigChange({
      ...config,
      wavelength: { ...config.wavelength, ...updates },
    })
  }

  // Apply polarization preset
  const applyPreset = (preset: typeof POLARIZATION_PRESETS[number]) => {
    updateExcitation({
      s_amplitude: preset.s,
      p_amplitude: preset.p,
    })
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings2 className="h-5 w-5 text-primary" />
          Simulation Settings
        </CardTitle>
        <CardDescription>
          Configure excitation plane wave and wavelength range
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Excitation Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => setExcitationExpanded(!excitationExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="font-medium">Excitation Plane Wave</span>
            </div>
            {excitationExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {excitationExpanded && (
            <div className="p-3 pt-0 space-y-4">
              {/* Polarization Presets */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Polarization Presets</label>
                <div className="flex gap-2">
                  {POLARIZATION_PRESETS.map((preset) => (
                    <Tooltip key={preset.name} content={preset.description}>
                      <Button
                        variant={
                          config.excitation.s_amplitude === preset.s &&
                          config.excitation.p_amplitude === preset.p
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => applyPreset(preset)}
                      >
                        {preset.name}
                      </Button>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Angle Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium">θ (Theta)</label>
                    <Tooltip content="Polar angle of incidence (0° = normal incidence, 90° = grazing)">
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={90}
                      step={1}
                      value={config.excitation.theta}
                      onChange={(e) => updateExcitation({ theta: Math.min(90, Math.max(0, parseFloat(e.target.value) || 0)) })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">°</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium">φ (Phi)</label>
                    <Tooltip content="Azimuthal angle of incidence (rotation around z-axis)">
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={360}
                      step={1}
                      value={config.excitation.phi}
                      onChange={(e) => updateExcitation({ phi: Math.min(360, Math.max(0, parseFloat(e.target.value) || 0)) })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">°</span>
                  </div>
                </div>
              </div>

              {/* Amplitude Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium">s-Amplitude</label>
                    <Tooltip content="Amplitude of s-polarized (TE) component">
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={config.excitation.s_amplitude}
                    onChange={(e) => updateExcitation({ s_amplitude: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-24"
                  />
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium">p-Amplitude</label>
                    <Tooltip content="Amplitude of p-polarized (TM) component">
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={config.excitation.p_amplitude}
                    onChange={(e) => updateExcitation({ p_amplitude: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-24"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wavelength Range Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => setWavelengthExpanded(!wavelengthExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Waves className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Wavelength Range</span>
              <span className="text-xs text-muted-foreground">
                ({wavelengthPoints} points)
              </span>
            </div>
            {wavelengthExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {wavelengthExpanded && (
            <div className="p-3 pt-0 space-y-4">
              {/* Warning for large number of points */}
              {showWavelengthWarning && (
                <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-600 dark:text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    {wavelengthPoints.toLocaleString()} points may take longer to compute.
                    Consider increasing step size.
                  </span>
                </div>
              )}

              {/* Wavelength Inputs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={100}
                      max={10000}
                      step={10}
                      value={config.wavelength.start}
                      onChange={(e) => updateWavelength({ start: Math.max(100, parseFloat(e.target.value) || 800) })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">nm</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium">End</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={100}
                      max={10000}
                      step={10}
                      value={config.wavelength.end}
                      onChange={(e) => updateWavelength({ end: Math.max(config.wavelength.start + 1, parseFloat(e.target.value) || 1200) })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">nm</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-medium">Step</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0.001}
                      max={100}
                      step="any"
                      value={config.wavelength.step}
                      onChange={(e) => updateWavelength({ step: Math.max(0.001, parseFloat(e.target.value) || 1) })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">nm</span>
                  </div>
                </div>
              </div>

              {/* Wavelength Range Preview */}
              <div className="space-y-1">
                <div className="h-2 bg-gradient-to-r from-violet-500 via-blue-500 via-green-500 via-yellow-500 to-red-500 rounded-full opacity-70" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{config.wavelength.start} nm</span>
                  <span>{config.wavelength.end} nm</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">Advanced</span>
            </div>
            {advancedExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {advancedExpanded && (
            <div className="p-3 pt-0 space-y-4">
              {/* Substrate Refractive Index */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium">Substrate Index (n_glass)</label>
                  <Tooltip content="Refractive index of the glass/SiO₂ substrate. Typical: 1.45-1.55">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step="any"
                  value={config.n_glass}
                  onChange={(e) => onConfigChange({
                    ...config,
                    n_glass: Math.max(1, parseFloat(e.target.value) || 1.535),
                  })}
                  className="w-24"
                />
              </div>

              {/* Fourier Harmonics */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium">Fourier Harmonics (num_basis)</label>
                  <Tooltip content="Number of Fourier basis terms. Higher = more accurate but slower. Typical: 50-200">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={config.num_basis}
                  onChange={(e) => onConfigChange({
                    ...config,
                    num_basis: Math.max(10, Math.min(500, parseInt(e.target.value) || 100)),
                  })}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Higher values improve accuracy for small features but increase computation time.
                </p>
              </div>

              {/* Compute Options */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Compute Options</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.compute_power}
                      onCheckedChange={(checked) => onConfigChange({
                        ...config,
                        compute_power: !!checked,
                      })}
                    />
                    <span className="text-sm">Compute T/R/A spectra</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={config.compute_fields}
                      onCheckedChange={(checked) => onConfigChange({
                        ...config,
                        compute_fields: !!checked,
                      })}
                    />
                    <span className="text-sm">Compute phase (requires field calculation)</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Disable unused calculations for faster simulations.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
