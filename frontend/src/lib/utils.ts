import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SimulationConfig } from '@/lib/api'
import type { LayerStackConfig, LayerDefinition, MaterialType } from '@/components/LayerStackBuilder'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Material refractive indices (approximate values)
const MATERIAL_N: Record<MaterialType, number> = {
  Vacuum: 1.0,
  Silicon: 3.48,
  Glass: 1.535,
  Gold: 0.18,  // Complex, but use real part at ~1550nm
  PMMA: 1.49,
  Graphene: 2.6,
  GaAs: 3.59,
  SiliconSubstrate: 3.42,
  Custom: 1.0,
}

const MATERIAL_K: Record<MaterialType, number> = {
  Vacuum: 0,
  Silicon: 0,
  Glass: 0,
  Gold: 5.1,  // Imaginary part at ~1550nm
  PMMA: 0,
  Graphene: 1.3,
  GaAs: 0,
  SiliconSubstrate: 0,
  Custom: 0,
}

/**
 * Convert a LayerStackConfig to a SimulationConfig for API calls.
 * Extracts PCS layer parameters and maps them to the simple config format.
 */
export function convertLayerStackToSimConfig(
  layerStack: LayerStackConfig,
  baseConfig: SimulationConfig
): SimulationConfig {
  // Find the first layer with a pattern (the PCS layer)
  const pcsLayer = layerStack.layers.find(l => l.hasPattern)
  
  // Find substrate material n
  const substrateN = MATERIAL_N[layerStack.substrate] || 1.535
  
  if (!pcsLayer) {
    // No PCS layer found, return base config with substrate adjustment
    return {
      ...baseConfig,
      n_glass: substrateN,
    }
  }
  
  // Get PCS material properties
  const pcsN = pcsLayer.customN ?? MATERIAL_N[pcsLayer.material] ?? 3.48
  const pcsK = pcsLayer.customK ?? MATERIAL_K[pcsLayer.material] ?? 0
  
  // Calculate total glass thickness (sum of non-PCS layers below PCS + substrate)
  const pcsIndex = layerStack.layers.findIndex(l => l.id === pcsLayer.id)
  const layersBelow = layerStack.layers.filter((l, i) => i > pcsIndex && !l.hasPattern)
  const glassThickness = layersBelow.reduce((sum, l) => sum + l.thickness, 0) + 3.0
  
  return {
    ...baseConfig,
    // PCS parameters
    thickness: pcsLayer.thickness,
    radius: pcsLayer.patternRadius ?? baseConfig.radius,
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
    patternMaterial: 'Vacuum',
    patternRadius: config.radius,
    customN: config.n_silicon,
    customK: config.k_silicon > 0 ? config.k_silicon : undefined,
    order: 0,
  }
  
  return {
    layers: [pcsLayer],
    superstrate: 'Vacuum',
    substrate: 'Glass',
    includeBackReflector: false,
    backReflectorMaterial: 'Gold',
    backReflectorThickness: 0.1,
  }
}
