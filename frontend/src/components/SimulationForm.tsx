import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { HelpTooltip } from '@/components/ui/tooltip'
import { SimulationConfig } from '@/lib/api'
import { validateSimulationConfig, fieldTooltips, ValidationResult } from '@/lib/validation'
import { Layers, Zap, Waves, Settings2 } from 'lucide-react'

interface SimulationFormProps {
  config: SimulationConfig
  onChange: (config: SimulationConfig) => void
  disabled?: boolean
  onValidationChange?: (validation: ValidationResult) => void
}

export default function SimulationForm({ config, onChange, disabled, onValidationChange }: SimulationFormProps) {
  // Validation
  const validation = useMemo(() => {
    const result = validateSimulationConfig(config)
    onValidationChange?.(result)
    return result
  }, [config, onValidationChange])

  const updateConfig = <K extends keyof SimulationConfig>(
    key: K,
    value: SimulationConfig[K]
  ) => {
    onChange({ ...config, [key]: value })
  }

  const updateExcitation = <K extends keyof SimulationConfig['excitation']>(
    key: K,
    value: SimulationConfig['excitation'][K]
  ) => {
    onChange({
      ...config,
      excitation: { ...config.excitation, [key]: value }
    })
  }

  const updateWavelength = <K extends keyof SimulationConfig['wavelength']>(
    key: K,
    value: SimulationConfig['wavelength'][K]
  ) => {
    onChange({
      ...config,
      wavelength: { ...config.wavelength, [key]: value }
    })
  }

  const numWavelengths = Math.floor(
    Math.abs(config.wavelength.end - config.wavelength.start) / config.wavelength.step
  ) + 1

  return (
    <Tabs defaultValue="geometry" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="geometry" className="flex items-center gap-1">
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Geometry</span>
        </TabsTrigger>
        <TabsTrigger value="materials" className="flex items-center gap-1">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Materials</span>
        </TabsTrigger>
        <TabsTrigger value="excitation" className="flex items-center gap-1">
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Excitation</span>
        </TabsTrigger>
        <TabsTrigger value="wavelength" className="flex items-center gap-1">
          <Waves className="h-4 w-4" />
          <span className="hidden sm:inline">Wavelength</span>
        </TabsTrigger>
      </TabsList>

      {/* Geometry Tab */}
      <TabsContent value="geometry">
        <Card>
          <CardHeader>
            <CardTitle>Geometry Parameters</CardTitle>
            <CardDescription>
              Define the lattice and layer structure of your photonic crystal slab
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Lattice Constant (a) [µm]</span>
                  <HelpTooltip content={fieldTooltips.lattice_constant} />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={config.lattice_constant}
                  onChange={(e) => updateConfig('lattice_constant', parseFloat(e.target.value) || 0.5)}
                  disabled={disabled}
                  error={validation.getError('lattice_constant')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Hole Radius (r) [µm]</span>
                  <HelpTooltip content={fieldTooltips.radius} />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={config.radius}
                  onChange={(e) => updateConfig('radius', parseFloat(e.target.value) || 0.15)}
                  disabled={disabled}
                  error={validation.getError('radius')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">PCS Thickness (t) [µm]</span>
                  <HelpTooltip content={fieldTooltips.thickness} />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={config.thickness}
                  onChange={(e) => updateConfig('thickness', parseFloat(e.target.value) || 0.16)}
                  disabled={disabled}
                  error={validation.getError('thickness')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Glass/BOX Thickness (h) [µm]</span>
                  <HelpTooltip content={fieldTooltips.glass_thickness} />
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={config.glass_thickness}
                  onChange={(e) => updateConfig('glass_thickness', parseFloat(e.target.value) || 3)}
                  disabled={disabled}
                  error={validation.getError('glass_thickness')}
                />
              </div>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Layer Stack:</strong> Air → PCS (Silicon with holes) → BOX (Glass) → Substrate (Glass)
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                r/a ratio: {(config.radius / config.lattice_constant).toFixed(3)}
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Materials Tab */}
      <TabsContent value="materials">
        <Card>
          <CardHeader>
            <CardTitle>Material Properties</CardTitle>
            <CardDescription>
              Set the refractive indices and simulation accuracy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Silicon Refractive Index (n)</span>
                  <HelpTooltip content={fieldTooltips.n_silicon} />
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={config.n_silicon}
                  onChange={(e) => updateConfig('n_silicon', parseFloat(e.target.value) || 3.68)}
                  disabled={disabled}
                  error={validation.getError('n_silicon')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Silicon Extinction Coefficient (k)</span>
                  <HelpTooltip content={fieldTooltips.k_silicon} />
                </div>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={config.k_silicon}
                  onChange={(e) => updateConfig('k_silicon', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  error={validation.getError('k_silicon')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Glass Refractive Index (SiO₂)</span>
                  <HelpTooltip content={fieldTooltips.n_glass} />
                </div>
                <Input
                  type="number"
                  step="0.001"
                  min="1"
                  value={config.n_glass}
                  onChange={(e) => updateConfig('n_glass', parseFloat(e.target.value) || 1.535)}
                  disabled={disabled}
                  error={validation.getError('n_glass')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Number of Fourier Basis Terms</span>
                  <HelpTooltip content={fieldTooltips.num_basis} />
                </div>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={config.num_basis}
                  onChange={(e) => updateConfig('num_basis', parseInt(e.target.value) || 32)}
                  disabled={disabled}
                  error={validation.getError('num_basis')}
                />
              </div>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Higher NumBasis = more accurate but slower. 32 is recommended for most cases.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Silicon ε = {(config.n_silicon ** 2 - config.k_silicon ** 2).toFixed(3)} + {(2 * config.n_silicon * config.k_silicon).toFixed(3)}i
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Excitation Tab */}
      <TabsContent value="excitation">
        <Card>
          <CardHeader>
            <CardTitle>Plane Wave Excitation</CardTitle>
            <CardDescription>
              Configure the incident light properties
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Polar Angle θ [degrees]</span>
                  <HelpTooltip content={fieldTooltips["excitation.theta"]} />
                </div>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="90"
                  value={config.excitation.theta}
                  onChange={(e) => updateExcitation('theta', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  error={validation.getError('excitation.theta')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Azimuthal Angle φ [degrees]</span>
                  <HelpTooltip content={fieldTooltips["excitation.phi"]} />
                </div>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="360"
                  value={config.excitation.phi}
                  onChange={(e) => updateExcitation('phi', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  error={validation.getError('excitation.phi')}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">s-Polarization Amplitude</span>
                  <HelpTooltip content={fieldTooltips["excitation.s_amplitude"]} />
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config.excitation.s_amplitude}
                  onChange={(e) => updateExcitation('s_amplitude', parseFloat(e.target.value) || 0)}
                  disabled={disabled}
                  error={validation.getError('excitation.s_amplitude')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">p-Polarization Amplitude</span>
                  <HelpTooltip content={fieldTooltips["excitation.p_amplitude"]} />
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config.excitation.p_amplitude}
                  onChange={(e) => updateExcitation('p_amplitude', parseFloat(e.target.value) || 1)}
                  disabled={disabled}
                  error={validation.getError('excitation.p_amplitude')}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateExcitation('s_amplitude', 0)
                  updateExcitation('p_amplitude', 1)
                }}
                disabled={disabled}
              >
                p-Polarized
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateExcitation('s_amplitude', 1)
                  updateExcitation('p_amplitude', 0)
                }}
                disabled={disabled}
              >
                s-Polarized
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateExcitation('s_amplitude', 0.707)
                  updateExcitation('p_amplitude', 0.707)
                }}
                disabled={disabled}
              >
                45° Linear
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Wavelength Tab */}
      <TabsContent value="wavelength">
        <Card>
          <CardHeader>
            <CardTitle>Wavelength Range</CardTitle>
            <CardDescription>
              Define the spectral range for simulation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Start [nm]</span>
                  <HelpTooltip content={fieldTooltips["wavelength.start"]} />
                </div>
                <Input
                  type="number"
                  step="1"
                  min="100"
                  value={config.wavelength.start}
                  onChange={(e) => updateWavelength('start', parseFloat(e.target.value) || 800)}
                  disabled={disabled}
                  error={validation.getError('wavelength.start')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">End [nm]</span>
                  <HelpTooltip content={fieldTooltips["wavelength.end"]} />
                </div>
                <Input
                  type="number"
                  step="1"
                  min="100"
                  value={config.wavelength.end}
                  onChange={(e) => updateWavelength('end', parseFloat(e.target.value) || 1200)}
                  disabled={disabled}
                  error={validation.getError('wavelength.end')}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium">Step [nm]</span>
                  <HelpTooltip content={fieldTooltips["wavelength.step"]} />
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0.01"
                  value={config.wavelength.step}
                  onChange={(e) => updateWavelength('step', parseFloat(e.target.value) || 1)}
                  disabled={disabled}
                  error={validation.getError('wavelength.step')}
                />
              </div>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Total wavelength points:</strong> {numWavelengths}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Range:</strong> {config.wavelength.start} - {config.wavelength.end} nm
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={config.compute_power}
                  onCheckedChange={(checked) => updateConfig('compute_power', checked)}
                  disabled={disabled}
                  label="Compute T/R/A"
                />
                <HelpTooltip content={fieldTooltips.compute_power} />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={config.compute_fields}
                  onCheckedChange={(checked) => updateConfig('compute_fields', checked)}
                  disabled={disabled}
                  label="Compute E-Fields (Phase)"
                />
                <HelpTooltip content={fieldTooltips.compute_fields} />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
