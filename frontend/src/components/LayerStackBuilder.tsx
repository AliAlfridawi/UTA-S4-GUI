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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Plus,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Info,
  Circle,
  RectangleHorizontal,
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

// Default material n/k values for reference
const MATERIAL_DEFAULTS: Record<MaterialType, { n: number; k: number }> = {
  Vacuum: { n: 1.0, k: 0 },
  Silicon: { n: 3.48, k: 0 },
  Glass: { n: 1.535, k: 0 },
  Gold: { n: 0.18, k: 3.0 },
  PMMA: { n: 1.49, k: 0 },
  Graphene: { n: 2.7, k: 1.4 },
  GaAs: { n: 3.59, k: 0 },
  SiliconSubstrate: { n: 3.42, k: 0 },
  Custom: { n: 1.5, k: 0 },
}

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

// Pattern/hole shape types
export type HoleShape = 'circle' | 'rectangle' | 'ellipse'

// Pattern types (lattice arrangement)
export type PatternType = 'circle' | 'rectangle' | 'hexagonal'

// Extended Layer definition with all optical parameters
export interface LayerDefinition {
  id: string
  name: string
  material: MaterialType
  thickness: number  // t in µm
  
  // Optical properties (n, k) - can override material defaults
  n?: number         // Refractive index override
  k?: number         // Extinction coefficient override
  
  // Computed epsilon (for display): ε = n² - k² + 2nki
  // These are optional overrides if user wants to set epsilon directly
  epsilonReal?: number
  epsilonImag?: number
  
  // Pattern/hole configuration
  hasPattern: boolean
  patternType: PatternType        // Lattice arrangement
  holeShape: HoleShape            // Shape of holes
  patternMaterial: MaterialType   // Material inside holes
  
  // Pattern dimensions
  patternRadius?: number          // r for circles (µm)
  patternWidth?: number           // For rectangles (µm)
  patternHeight?: number          // For rectangles (µm)
  patternFillFactor?: number      // 0-1 fill factor
  
  order: number
}

// Layer stack configuration with global lattice constant
export interface LayerStackConfig {
  // Global simulation parameters
  latticeConstant: number         // a in µm (default 0.5)
  
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
      latticeConstant: 0.5,
      layers: [
        {
          id: 'pcs-1',
          name: 'PCS',
          material: 'Silicon',
          thickness: 0.16,
          hasPattern: true,
          patternType: 'circle',
          holeShape: 'circle',
          patternMaterial: 'Vacuum',
          patternRadius: 0.15,
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
      latticeConstant: 0.5,
      layers: [
        {
          id: 'pmma-1',
          name: 'PMMA',
          material: 'PMMA',
          thickness: 0.05,
          hasPattern: false,
          patternType: 'circle',
          holeShape: 'circle',
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
          holeShape: 'circle',
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
          holeShape: 'circle',
          patternMaterial: 'Vacuum',
          patternRadius: 0.15,
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
      latticeConstant: 0.5,
      layers: [
        {
          id: 'pcs-1',
          name: 'Si-PCS',
          material: 'Silicon',
          thickness: 0.16,
          hasPattern: true,
          patternType: 'circle',
          holeShape: 'circle',
          patternMaterial: 'Vacuum',
          patternRadius: 0.15,
          order: 0,
        },
        {
          id: 'spacer-1',
          name: 'SiO₂ Spacer',
          material: 'Glass',
          thickness: 0.5,
          hasPattern: false,
          patternType: 'circle',
          holeShape: 'circle',
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

// Helper to compute epsilon from n and k
function computeEpsilon(n: number, k: number): { real: number; imag: number } {
  return {
    real: n * n - k * k,
    imag: 2 * n * k,
  }
}

// Helper to get effective n/k for a layer
function getEffectiveNK(layer: LayerDefinition): { n: number; k: number } {
  const defaults = MATERIAL_DEFAULTS[layer.material]
  return {
    n: layer.n ?? defaults.n,
    k: layer.k ?? defaults.k,
  }
}

// Sortable layer item component with drag-and-drop
function SortableLayerItem({
  layer,
  onUpdate,
  onDelete,
  disabled,
}: {
  layer: LayerDefinition
  onUpdate: (layer: LayerDefinition) => void
  onDelete: () => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const materialInfo = MATERIAL_INFO[layer.material]
  const { n, k } = getEffectiveNK(layer)
  const epsilon = computeEpsilon(n, k)
  
  // Drag-and-drop setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id })
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderLeftColor: materialInfo.color,
    borderLeftWidth: 4,
  }

  const HoleShapeIcon = {
    circle: Circle,
    rectangle: RectangleHorizontal,
    ellipse: CircleDot,
  }[layer.holeShape || 'circle']

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-3 bg-card"
    >
      {/* Header Row */}
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

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
            <HoleShapeIcon
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
          {/* Optical Properties Section */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Optical Properties</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">n (refractive index)</label>
                <Input
                  type="number"
                  value={layer.n ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      n: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.01"
                  placeholder={MATERIAL_DEFAULTS[layer.material].n.toString()}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">k (extinction)</label>
                <Input
                  type="number"
                  value={layer.k ?? ''}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      k: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.001"
                  min="0"
                  placeholder={MATERIAL_DEFAULTS[layer.material].k.toString()}
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ε (real)</label>
                <Input
                  type="number"
                  value={layer.epsilonReal ?? epsilon.real.toFixed(4)}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      epsilonReal: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.01"
                  disabled={disabled}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ε (imag)</label>
                <Input
                  type="number"
                  value={layer.epsilonImag ?? epsilon.imag.toFixed(4)}
                  onChange={(e) =>
                    onUpdate({
                      ...layer,
                      epsilonImag: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="h-8"
                  step="0.001"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
          
          {/* Pattern Settings */}
          {layer.hasPattern && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Pattern Configuration</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Hole Shape</label>
                  <Select
                    value={layer.holeShape || 'circle'}
                    onValueChange={(v) =>
                      onUpdate({ ...layer, holeShape: v as HoleShape })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circle">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3 w-3" />
                          Circle
                        </div>
                      </SelectItem>
                      <SelectItem value="rectangle">
                        <div className="flex items-center gap-2">
                          <RectangleHorizontal className="h-3 w-3" />
                          Rectangle
                        </div>
                      </SelectItem>
                      <SelectItem value="ellipse">
                        <div className="flex items-center gap-2">
                          <CircleDot className="h-3 w-3" />
                          Ellipse
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Lattice Type</label>
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
                      <SelectItem value="circle">Square Lattice</SelectItem>
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
              
              {/* Shape-specific dimensions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {(layer.holeShape === 'circle' || !layer.holeShape) && (
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
                      placeholder="0.15"
                      disabled={disabled}
                    />
                  </div>
                )}
                
                {layer.holeShape === 'rectangle' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Width (µm)</label>
                      <Input
                        type="number"
                        value={layer.patternWidth ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            ...layer,
                            patternWidth: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="h-8"
                        step="0.01"
                        placeholder="0.2"
                        disabled={disabled}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Height (µm)</label>
                      <Input
                        type="number"
                        value={layer.patternHeight ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            ...layer,
                            patternHeight: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="h-8"
                        step="0.01"
                        placeholder="0.2"
                        disabled={disabled}
                      />
                    </div>
                  </>
                )}
                
                {layer.holeShape === 'ellipse' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Semi-major (µm)</label>
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
                        placeholder="0.2"
                        disabled={disabled}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Semi-minor (µm)</label>
                      <Input
                        type="number"
                        value={layer.patternWidth ?? ''}
                        onChange={(e) =>
                          onUpdate({
                            ...layer,
                            patternWidth: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="h-8"
                        step="0.01"
                        placeholder="0.1"
                        disabled={disabled}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Material Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            {materialInfo.description} | Effective: n={n.toFixed(3)}, k={k.toFixed(4)}, ε={epsilon.real.toFixed(2)}+{epsilon.imag.toFixed(2)}i
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
  
  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const generateId = () => `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const addLayer = useCallback(() => {
    const newLayer: LayerDefinition = {
      id: generateId(),
      name: `Layer ${config.layers.length + 1}`,
      material: 'Silicon',
      thickness: 0.1,
      hasPattern: false,
      patternType: 'circle',
      holeShape: 'circle',
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

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      
      if (over && active.id !== over.id) {
        const oldIndex = config.layers.findIndex((l) => l.id === active.id)
        const newIndex = config.layers.findIndex((l) => l.id === over.id)
        
        const newLayers = arrayMove(config.layers, oldIndex, newIndex).map((l, i) => ({
          ...l,
          order: i,
        }))
        
        onChange({ ...config, layers: newLayers })
      }
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

        {/* Global Parameters */}
        <div className="flex items-center gap-4 p-3 bg-primary/5 rounded-lg border">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Lattice Constant (a):</label>
            <Input
              type="number"
              value={config.latticeConstant ?? 0.5}
              onChange={(e) =>
                onChange({ ...config, latticeConstant: parseFloat(e.target.value) || 0.5 })
              }
              className="w-24 h-8"
              step="0.01"
              min="0.01"
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground">µm</span>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            Global lattice constant for periodic structure
          </span>
        </div>

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

        {/* Layer Stack with Drag-and-Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={config.layers.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {config.layers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  No layers defined. Click "Add Layer" to start building your structure.
                </div>
              ) : (
                config.layers
                  .sort((a, b) => a.order - b.order)
                  .map((layer) => (
                    <SortableLayerItem
                      key={layer.id}
                      layer={layer}
                      onUpdate={(updated) => updateLayer(layer.id, updated)}
                      onDelete={() => deleteLayer(layer.id)}
                      disabled={disabled}
                    />
                  ))
              )}
            </div>
          </SortableContext>
        </DndContext>

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
  latticeConstant: 0.5,
  layers: [],
  superstrate: 'Vacuum',
  substrate: 'Glass',
  includeBackReflector: false,
  backReflectorMaterial: 'Gold',
  backReflectorThickness: 0.1,
}

// Export helper functions and types
export { MATERIAL_DEFAULTS, computeEpsilon, getEffectiveNK }
