import { SimulationConfig } from "@/lib/api"

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  getError: (field: string) => string | undefined
}

export function validateSimulationConfig(config: SimulationConfig): ValidationResult {
  const errors: ValidationError[] = []

  // Geometry validation
  if (config.lattice_constant <= 0) {
    errors.push({ field: "lattice_constant", message: "Lattice constant must be greater than 0" })
  }
  if (config.radius <= 0) {
    errors.push({ field: "radius", message: "Hole radius must be greater than 0" })
  }
  if (config.radius >= config.lattice_constant / 2) {
    errors.push({ field: "radius", message: "Hole radius must be less than half the lattice constant" })
  }
  if (config.thickness <= 0) {
    errors.push({ field: "thickness", message: "PCS thickness must be greater than 0" })
  }
  if (config.glass_thickness < 0) {
    errors.push({ field: "glass_thickness", message: "Glass thickness cannot be negative" })
  }

  // Materials validation
  if (config.n_silicon < 1) {
    errors.push({ field: "n_silicon", message: "Refractive index must be at least 1" })
  }
  if (config.k_silicon < 0) {
    errors.push({ field: "k_silicon", message: "Extinction coefficient cannot be negative" })
  }
  if (config.n_glass < 1) {
    errors.push({ field: "n_glass", message: "Glass refractive index must be at least 1" })
  }
  if (config.num_basis < 1) {
    errors.push({ field: "num_basis", message: "Number of Fourier basis terms must be at least 1" })
  }
  if (config.num_basis > 100) {
    errors.push({ field: "num_basis", message: "Number of Fourier basis terms should not exceed 100" })
  }

  // Excitation validation
  if (config.excitation.theta < 0 || config.excitation.theta > 90) {
    errors.push({ field: "excitation.theta", message: "Polar angle must be between 0° and 90°" })
  }
  if (config.excitation.phi < 0 || config.excitation.phi > 360) {
    errors.push({ field: "excitation.phi", message: "Azimuthal angle must be between 0° and 360°" })
  }
  if (config.excitation.s_amplitude < 0 || config.excitation.s_amplitude > 1) {
    errors.push({ field: "excitation.s_amplitude", message: "s-polarization amplitude must be between 0 and 1" })
  }
  if (config.excitation.p_amplitude < 0 || config.excitation.p_amplitude > 1) {
    errors.push({ field: "excitation.p_amplitude", message: "p-polarization amplitude must be between 0 and 1" })
  }
  if (config.excitation.s_amplitude === 0 && config.excitation.p_amplitude === 0) {
    errors.push({ field: "excitation.s_amplitude", message: "At least one polarization amplitude must be non-zero" })
  }

  // Wavelength validation
  if (config.wavelength.start <= 0) {
    errors.push({ field: "wavelength.start", message: "Start wavelength must be greater than 0" })
  }
  if (config.wavelength.end <= 0) {
    errors.push({ field: "wavelength.end", message: "End wavelength must be greater than 0" })
  }
  if (config.wavelength.start >= config.wavelength.end) {
    errors.push({ field: "wavelength.start", message: "Start wavelength must be less than end wavelength" })
  }
  if (config.wavelength.step <= 0) {
    errors.push({ field: "wavelength.step", message: "Wavelength step must be greater than 0" })
  }
  if (config.wavelength.step > (config.wavelength.end - config.wavelength.start)) {
    errors.push({ field: "wavelength.step", message: "Step size is larger than the wavelength range" })
  }

  // Check for excessive number of wavelength points (warn if > 10000)
  const numPoints = Math.floor((config.wavelength.end - config.wavelength.start) / config.wavelength.step) + 1
  if (numPoints > 10000) {
    errors.push({ field: "wavelength.step", message: `This will compute ${numPoints} points. Consider using a larger step.` })
  }

  return {
    isValid: errors.length === 0,
    errors,
    getError: (field: string) => errors.find(e => e.field === field)?.message,
  }
}

// Helper tooltips for each field
export const fieldTooltips: Record<string, string> = {
  lattice_constant: "The period of the photonic crystal lattice. Typically 0.3-1.0 µm for optical/NIR applications.",
  radius: "Radius of the circular holes in the photonic crystal slab. The r/a ratio affects the photonic band structure.",
  thickness: "Thickness of the photonic crystal slab (PCS layer). Affects resonance wavelengths and Q-factors.",
  glass_thickness: "Thickness of the buried oxide (BOX) layer. Set to 0 for suspended membranes.",
  n_silicon: "Real part of the refractive index for the PCS material (typically silicon, n≈3.5-3.7).",
  k_silicon: "Imaginary part of the refractive index (extinction coefficient). Non-zero values add absorption.",
  n_glass: "Refractive index of the glass/oxide substrate (SiO₂ ≈ 1.45-1.55).",
  num_basis: "Number of Fourier terms in the RCWA expansion. Higher values = more accuracy but slower. 32-50 recommended.",
  "excitation.theta": "Polar angle of incidence measured from surface normal. 0° = normal incidence.",
  "excitation.phi": "Azimuthal angle of incidence. Rotates the plane of incidence around the surface normal.",
  "excitation.s_amplitude": "Amplitude of s-polarized (TE) component. Electric field perpendicular to plane of incidence.",
  "excitation.p_amplitude": "Amplitude of p-polarized (TM) component. Electric field parallel to plane of incidence.",
  "wavelength.start": "Starting wavelength for the spectral sweep in nanometers.",
  "wavelength.end": "Ending wavelength for the spectral sweep in nanometers.",
  "wavelength.step": "Wavelength step size. Smaller steps give finer resolution but take longer to compute.",
  compute_power: "Calculate transmission (T), reflection (R), and absorption (A) spectra.",
  compute_fields: "Calculate electric field distributions. Required for phase plots and field maps.",
}
