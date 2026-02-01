import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SimulationConfig, AdvancedLayerStack, LayerDefinitionAPI, AdvancedSimulationRequest, WavelengthRange } from '@/lib/api'
import type { LayerStackConfig, LayerDefinition, MaterialType, HoleShape } from '@/components/LayerStackBuilder'
import { MATERIAL_DEFAULTS, computeEpsilon, getEffectiveNK } from '@/components/LayerStackBuilder'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export for convenience  
export { MATERIAL_DEFAULTS, computeEpsilon, getEffectiveNK }
export type { HoleShape }

/**
 * Convert a frontend LayerStackConfig to the backend AdvancedLayerStack format.
 * This is the primary conversion for the new advanced simulation API.
 */
export function convertToAdvancedLayerStack(layerStack: LayerStackConfig): AdvancedLayerStack {
  const layers: LayerDefinitionAPI[] = layerStack.layers.map((layer, index) => {
    const { n, k } = getEffectiveNK(layer)
    const eps = computeEpsilon(n, k)
    
    return {
      name: layer.name,
      material: layer.material,
      thickness: layer.thickness,
      n: layer.n ?? n,
      k: layer.k ?? k,
      epsilon_real: layer.epsilonReal ?? eps.real,
      epsilon_imag: layer.epsilonImag ?? eps.imag,
      has_pattern: layer.hasPattern,
      pattern_type: layer.patternType,
      hole_shape: layer.holeShape,
      pattern_material: layer.hasPattern ? layer.patternMaterial : undefined,
      pattern_radius: layer.patternRadius,
      pattern_width: layer.patternWidth,
      pattern_height: layer.patternHeight,
      pattern_fill_factor: layer.patternFillFactor,
      order: layer.order ?? index,
    }
  })
  
  return {
    lattice_constant: layerStack.latticeConstant,
    layers,
    superstrate: layerStack.superstrate,
    substrate: layerStack.substrate,
    include_back_reflector: layerStack.includeBackReflector,
    back_reflector_material: layerStack.backReflectorMaterial,
    back_reflector_thickness: layerStack.backReflectorThickness,
  }
}

/**
 * Create an AdvancedSimulationRequest from a LayerStackConfig and simulation settings.
 */
export function createAdvancedSimRequest(
  layerStack: LayerStackConfig,
  wavelengthRange: WavelengthRange,
  options?: {
    theta?: number;
    phi?: number;
    s_amplitude?: number;
    p_amplitude?: number;
    num_basis?: number;
  }
): AdvancedSimulationRequest {
  return {
    layer_stack: convertToAdvancedLayerStack(layerStack),
    wavelength: wavelengthRange,
    excitation_theta: options?.theta ?? 0,
    excitation_phi: options?.phi ?? 0,
    s_amplitude: options?.s_amplitude ?? 0,
    p_amplitude: options?.p_amplitude ?? 1,
    num_basis: options?.num_basis ?? 100,
    compute_power: true,
    compute_fields: true,
  }
}

/**
 * Convert a LayerStackConfig to a SimulationConfig for API calls.
 * Extracts PCS layer parameters and maps them to the simple config format.
 * Note: This provides basic compatibility - full layer stack should use the advanced API.
 */
export function convertLayerStackToSimConfig(
  layerStack: LayerStackConfig,
  baseConfig: SimulationConfig
): SimulationConfig {
  // Find the first layer with a pattern (the PCS layer)
  const pcsLayer = layerStack.layers.find(l => l.hasPattern)
  
  // Find substrate material properties
  const substrateDefaults = MATERIAL_DEFAULTS[layerStack.substrate] || MATERIAL_DEFAULTS.Glass
  const substrateN = substrateDefaults.n
  
  if (!pcsLayer) {
    // No PCS layer found, return base config with substrate adjustment
    return {
      ...baseConfig,
      n_glass: substrateN,
      period: layerStack.latticeConstant,
    }
  }
  
  // Get PCS material properties - use layer overrides or material defaults
  const { n: pcsN, k: pcsK } = getEffectiveNK(pcsLayer)
  
  // Get pattern radius - handle different hole shapes
  let effectiveRadius = pcsLayer.patternRadius ?? baseConfig.radius
  if (pcsLayer.holeShape === 'rectangle' && pcsLayer.patternWidth && pcsLayer.patternHeight) {
    // For rectangles, compute equivalent circular radius
    effectiveRadius = Math.sqrt((pcsLayer.patternWidth * pcsLayer.patternHeight) / Math.PI)
  } else if (pcsLayer.holeShape === 'ellipse' && pcsLayer.patternWidth && pcsLayer.patternHeight) {
    // For ellipses, patternWidth/Height are semi-major/minor axes
    effectiveRadius = Math.sqrt(pcsLayer.patternWidth * pcsLayer.patternHeight)
  }
  
  // Calculate total glass thickness (sum of non-PCS layers below PCS + substrate)
  const pcsIndex = layerStack.layers.findIndex(l => l.id === pcsLayer.id)
  const layersBelow = layerStack.layers.filter((l, i) => i > pcsIndex && !l.hasPattern)
  const glassThickness = layersBelow.reduce((sum, l) => sum + l.thickness, 0) + 3.0
  
  return {
    ...baseConfig,
    // Global parameters
    period: layerStack.latticeConstant,
    // PCS parameters
    thickness: pcsLayer.thickness,
    radius: effectiveRadius,
    n_silicon: pcsN,
    k_silicon: pcsK,
    // Substrate
    n_glass: substrateN,
    glass_thickness: glassThickness,
  }
}

/**
 * Convert a SimulationConfig to a LayerStackConfig for the builder.
 * Creates a simple PCS layer matching the config parameters.
 */
export function convertSimConfigToLayerStack(
  config: SimulationConfig
): LayerStackConfig {
  const pcsLayer: LayerDefinition = {
    id: `pcs-${Date.now()}`,
    name: 'Si-PCS',
    material: 'Silicon',
    thickness: config.thickness,
    hasPattern: true,
    patternType: 'circle',
    holeShape: 'circle',
    patternMaterial: 'Vacuum',
    patternRadius: config.radius,
    n: config.n_silicon,
    k: config.k_silicon > 0 ? config.k_silicon : undefined,
    order: 0,
  }
  
  return {
    latticeConstant: config.period || 0.5,
    layers: [pcsLayer],
    superstrate: 'Vacuum',
    substrate: 'Glass',
    includeBackReflector: false,
    backReflectorMaterial: 'Gold',
    backReflectorThickness: 0.1,
  }
}
