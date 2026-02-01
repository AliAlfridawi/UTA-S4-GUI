import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import {
  GripVertical,
  Plus,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Square,
  Hexagon,
  Info,
} from 'lucide-react'

// Material types matching backend
export type MaterialType =
  | 'Vacuum'
  | 'Silicon'
  | 'Glass'
  | 'Gold'
  | 'PMMA'
  | 'Graphene'
  | 'GaAs'
  | 'SiliconSubstrate'
  | 'Custom'

// Material info for display
const MATERIAL_INFO: Record<MaterialType, { color: string; description: string }> = {
  Vacuum: { color: '#e2e8f0', description: 'Free space / Air (n=1)' },
  Silicon: { color: '#6366f1', description: 'Crystalline Si (n≈3.48)' },
  Glass: { color: '#06b6d4', description: 'Fused Silica SiO₂ (n≈1.535)' },
  Gold: { color: '#f59e0b', description: 'Gold - Drude model' },
  PMMA: { color: '#ec4899', description: 'Poly(methyl methacrylate) (n≈1.49)' },
  Graphene: { color: '#374151', description: 'Graphene monolayer' },
  GaAs: { color: '#8b5cf6', description: 'Gallium Arsenide (n≈3.59)' },
  SiliconSubstrate: { color: '#4f46e5', description: 'Bulk Silicon substrate (n≈3.42)' },
  Custom: { color: '#9ca3af', description: 'Custom material properties' },
}

// Pattern types
export type PatternType = 'circle' | 'rectangle' | 'hexagonal'

// Layer definition
export interface LayerDefinition {
  id: string
  name: string
  material: MaterialType
  thickness: number
  hasPattern: boolean
  patternType: PatternType
  patternMaterial: MaterialType
  patternRadius?: number
  patternFillFactor?: number
  customN?: number
  customK?: number
  order: number
}

// Layer stack configuration
export interface LayerStackConfig {
  layers: LayerDefinition[]
  superstrate: MaterialType
  substrate: MaterialType
  includeBackReflector: boolean
  backReflectorMaterial: MaterialType
  backReflectorThickness: number
}

// Presets
const PRESETS: Record<string, { name: string; description: string; config: Partial<LayerStackConfig> }> = {
  basic_pcs: {
    name: 'Basic PCS',
    description: 'Simple photonic crystal slab on glass',
    config: {
      layers: [
        {
          id: 'pcs-1',
          name: 'PCS',
          material: 'Silicon',
          thickness: 0.16,
          hasPattern: true,
          patternType: 'circle',
          patternMaterial: 'Vacuum',
          order: 0,
        },
      ],
      substrate: 'Glass',
      superstrate: 'Vacuum',
      includeBackReflector: false,
    },
  },
  design_005: {
    name: 'Design 005',
    description: 'PMMA/Graphene/Si-PCS/SiO₂ structure',
    config: {
      layers: [
        {
          id: 'pmma-1',
          name: 'PMMA',
          material: 'PMMA',
          thickness: 0.05,
          hasPattern: false,
          patternType: 'circle',
          patternMaterial: 'Vacuum',
          order: 0,
        },
        {
          id: 'graphene-1',
          name: 'Graphene',
          material: 'Graphene',
          thickness: 0.00034,
          hasPattern: false,
          patternType: 'circle',
          patternMaterial: 'Vacuum',
          order: 1,
        },
        {
          id: 'pcs-1',
          name: 'Si-PCS',
          material: 'Silicon',
          thickness: 0.16,
          hasPattern: true,
          patternType: 'circle',
          patternMaterial: 'Vacuum',
          order: 2,
        },
      ],
      substrate: 'Glass',
      superstrate: 'Vacuum',
      includeBackReflector: false,
    },
  },
  design_007: {
    name: 'Design 007',
    description: 'PCS with gold back reflector',
    config: {
      layers: [
        {
          id: 'pcs-1',
          name: 'Si-PCS',
          material: 'Silicon',
          thickness: 0.16,
          hasPattern: true,
          patternType: 'circle',
          patternMaterial: 'Vacuum',
          order: 0,
        },
        {
          id: 'spacer-1',
          name: 'SiO₂ Spacer',
          material: 'Glass',
          thickness: 0.5,
          hasPattern: false,
          patternType: 'circle',
          patternMaterial: 'Vacuum',
          order: 1,
        },
      ],
      substrate: 'Glass',
      superstrate: 'Vacuum',
      includeBackReflector: true,
      backReflectorMaterial: 'Gold',
      backReflectorThickness: 0.1,
    },
  },
}

interface LayerStackBuilderProps {
  config: LayerStackConfig
  onChange: (config: LayerStackConfig) => void
  disabled?: boolean
}

// Single layer item component
function LayerItem({
  layer,
  index,
  totalLayers,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  layer: LayerDefinition
  index: number
  totalLayers: number
  onUpdate: (layer: LayerDefinition) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const materialInfo = MATERIAL_INFO[layer.material]

  const PatternIcon = {
    circle: CircleDot,
    rectangle: Square,
    hexagonal: Hexagon,
  }[layer.patternType]

  return (
    <div
      className="border rounded-lg p-3 bg-card"
      style={{ borderLeftColor: materialInfo.color, borderLeftWidth: 4 }}
    >
      {/* Header Row */}
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />

        <div className="flex-1 min-w-0">
          <Input
            value={layer.name}
            onChange={(e) => onUpdate({ ...layer, name: e.target.value })}
            className="h-7 text-sm font-medium"
            disabled={disabled}
          />
        </div>

        <Select
          value={layer.material}
          onValueChange={(v) => onUpdate({ ...layer, material: v as MaterialType })}
          disabled={disabled}
        >
          <SelectTrigger className="w-32 h-7">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATERIAL_INFO).map(([mat, info]) => (
              <SelectItem key={mat} value={mat}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: info.color }}
                  />
                  {mat}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={layer.thickness}
            onChange={(e) =>
              onUpdate({ ...layer, thickness: parseFloat(e.target.value) || 0 })
            }
            className="w-20 h-7 text-sm"
            step="0.01"
            min="0"
            disabled={disabled}
          />
          <span className="text-xs text-muted-foreground">µm</span>
        </div>

        <Tooltip content={layer.hasPattern ? 'Has pattern' : 'No pattern'}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onUpdate({ ...layer, hasPattern: !layer.hasPattern })}
            disabled={disabled}
          >
            <PatternIcon
              className={`h-4 w-4 ${layer.hasPattern ? 'text-primary' : 'text-muted-foreground'}`}
            />
          </Button>
        </Tooltip>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onMoveUp}
            disabled={disabled || index === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onMoveDown}
            disabled={disabled || index === totalLayers - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={onDelete}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Pattern Settings */}
          {layer.hasPattern && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Pattern Type</label>
                <Select
                  value={layer.patternType}
                  onValueChange={(v) =>
                    onUpdate({ ...layer, patternType: v as PatternType })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="rectangle">Rectangle</SelectItem>
                    <SelectItem value="hexagonal">Hexagonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Hole Material</label>
                <Select
                  value={layer.patternMaterial}
                  onValueChange={(v) =>
                    onUpdate({ ...layer, patternMaterial: v as MaterialType })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(MATERIAL_INFO).map((mat) => (
                      <SelectItem key={mat} value={mat}>
                        {mat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Radius (µm)</label>
                <Input
                  type="number"
                  value={layer.patternRadius ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      patternRadius: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.01"
                  placeholder="From config"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Fill Factor</label>
                <Input
                  type="number"
                  value={layer.patternFillFactor ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      patternFillFactor: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="h-8"
                  step="0.01"
                  min="0"
                  max="1"
                  placeholder="Auto"
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {/* Custom Material Overrides */}
          {layer.material === 'Custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  Custom n (refractive index)
                </label>
                <Input
                  type="number"
                  value={layer.customN ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      customN: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.01"
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Custom k (extinction)
                </label>
                <Input
                  type="number"
                  value={layer.customK ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      customK: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.001"
                  min="0"
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {/* Material Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            {materialInfo.description}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LayerStackBuilder({
  config,
  onChange,
  disabled = false,
}: LayerStackBuilderProps) {
  const [showPresets, setShowPresets] = useState(false)

  const generateId = () => `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const addLayer = useCallback(() => {
    const newLayer: LayerDefinition = {
      id: generateId(),
      name: `Layer ${config.layers.length + 1}`,
      material: 'Silicon',
      thickness: 0.1,
      hasPattern: false,
      patternType: 'circle',
      patternMaterial: 'Vacuum',
      order: config.layers.length,
    }
    onChange({ ...config, layers: [...config.layers, newLayer] })
  }, [config, onChange])

  const updateLayer = useCallback(
    (id: string, updated: LayerDefinition) => {
      onChange({
        ...config,
        layers: config.layers.map((l) => (l.id === id ? updated : l)),
      })
    },
    [config, onChange]
  )

  const deleteLayer = useCallback(
    (id: string) => {
      onChange({
        ...config,
        layers: config.layers.filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i })),
      })
    },
    [config, onChange]
  )

  const moveLayer = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const index = config.layers.findIndex((l) => l.id === id)
      if (index === -1) return

      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= config.layers.length) return

      const newLayers = [...config.layers]
      ;[newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]]

      onChange({
        ...config,
        layers: newLayers.map((l, i) => ({ ...l, order: i })),
      })
    },
    [config, onChange]
  )

  const applyPreset = useCallback(
    (presetKey: string) => {
      const preset = PRESETS[presetKey]
      if (!preset) return

      onChange({
        ...config,
        ...preset.config,
        layers: (preset.config.layers || []).map((l) => ({
          ...l,
          id: generateId(),
        })),
      })
      setShowPresets(false)
    },
    [config, onChange]
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Layer Stack Builder
            </CardTitle>
            <CardDescription>
              Define multi-layer photonic structures with custom materials
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
              disabled={disabled}
            >
              Load Preset
            </Button>
            <Button size="sm" onClick={addLayer} disabled={disabled}>
              <Plus className="h-4 w-4 mr-1" />
              Add Layer
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Presets Dropdown */}
        {showPresets && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <Button
                key={key}
                variant="outline"
                className="justify-start h-auto py-2"
                onClick={() => applyPreset(key)}
              >
                <div className="text-left">
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                </div>
              </Button>
            ))}
          </div>
        )}

        {/* Superstrate */}
        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground w-24">Superstrate:</span>
          <Select
            value={config.superstrate}
            onValueChange={(v) => onChange({ ...config, superstrate: v as MaterialType })}
            disabled={disabled}
          >
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(MATERIAL_INFO).map((mat) => (
                <SelectItem key={mat} value={mat}>
                  {mat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">↓ Light enters here</span>
        </div>

        {/* Layer Stack */}
        <div className="space-y-2">
          {config.layers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              No layers defined. Click "Add Layer" to start building your structure.
            </div>
          ) : (
            config.layers
              .sort((a, b) => a.order - b.order)
              .map((layer, index) => (
                <LayerItem
                  key={layer.id}
                  layer={layer}
                  index={index}
                  totalLayers={config.layers.length}
                  onUpdate={(updated) => updateLayer(layer.id, updated)}
                  onDelete={() => deleteLayer(layer.id)}
                  onMoveUp={() => moveLayer(layer.id, 'up')}
                  onMoveDown={() => moveLayer(layer.id, 'down')}
                  disabled={disabled}
                />
              ))
          )}
        </div>

        {/* Substrate */}
        <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
          <span className="text-sm text-muted-foreground w-24">Substrate:</span>
          <Select
            value={config.substrate}
            onValueChange={(v) => onChange({ ...config, substrate: v as MaterialType })}
            disabled={disabled}
          >
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(MATERIAL_INFO).map((mat) => (
                <SelectItem key={mat} value={mat}>
                  {mat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Back Reflector Option */}
        <div className="flex items-center gap-4 p-3 border rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.includeBackReflector}
              onCheckedChange={(checked) =>
                onChange({ ...config, includeBackReflector: checked === true })
              }
              disabled={disabled}
            />
            <span className="text-sm">Include Back Reflector</span>
          </label>

          {config.includeBackReflector && (
            <>
              <Select
                value={config.backReflectorMaterial}
                onValueChange={(v) =>
                  onChange({ ...config, backReflectorMaterial: v as MaterialType })
                }
                disabled={disabled}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silicon">Silicon</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={config.backReflectorThickness}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      backReflectorThickness: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-20 h-8"
                  step="0.01"
                  min="0"
                  disabled={disabled}
                />
                <span className="text-xs text-muted-foreground">µm</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Default config export
export const defaultLayerStackConfig: LayerStackConfig = {
  layers: [],
  superstrate: 'Vacuum',
  substrate: 'Glass',
  includeBackReflector: false,
  backReflectorMaterial: 'Gold',
  backReflectorThickness: 0.1,
}
